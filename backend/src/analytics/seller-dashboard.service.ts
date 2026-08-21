import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LedgerAccount,
  LedgerDirection,
  Prisma,
  UserRole,
} from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { SellerDashboardQueryDto } from './dto/seller-dashboard-query.dto.js';

const DEFAULT_RANGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000;

interface ProductPerformanceRow {
  productId: string;
  productTitle: string;
  currency: string;
  purchasedUnits: bigint;
  cancelledUnits: bigint;
  refundedUnits: bigint;
  netUnits: bigint;
  netGross: Prisma.Decimal;
}

@Injectable()
export class SellerDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string, query: SellerDashboardQueryDto) {
    const seller = await this.prisma.sellerProfile.findFirst({
      where: { userId, user: { role: UserRole.SELLER } },
      select: { id: true, displayName: true },
    });
    if (!seller) throw new NotFoundException('Seller profile not found');

    const range = this.resolveRange(query);
    const orderWhere = {
      sellerId: seller.id,
      createdAt: { gte: range.from, lte: range.to },
    } satisfies Prisma.SellerOrderWhereInput;
    const ledgerWhere = {
      account: LedgerAccount.SELLER,
      sellerOrder: { sellerId: seller.id },
      occurredAt: { gte: range.from, lte: range.to },
    } satisfies Prisma.FinancialLedgerEntryWhereInput;

    const [financialRows, statusRows, topProducts, recentSellerOrders] =
      await Promise.all([
        this.prisma.financialLedgerEntry.groupBy({
          by: ['currency', 'direction'],
          where: ledgerWhere,
          _sum: { amount: true },
        }),
        this.prisma.sellerOrder.groupBy({
          by: ['currency', 'status'],
          where: orderWhere,
          _count: { _all: true },
          _sum: {
            grossAmount: true,
            refundedGross: true,
            platformCommission: true,
            refundedCommission: true,
            sellerNet: true,
            refundedSellerNet: true,
          },
        }),
        this.topProducts(seller.id, range.from, range.to),
        this.prisma.sellerOrder.findMany({
          where: orderWhere,
          select: {
            id: true,
            orderId: true,
            status: true,
            currency: true,
            grossAmount: true,
            refundedGross: true,
            sellerNet: true,
            refundedSellerNet: true,
            createdAt: true,
            updatedAt: true,
            _count: { select: { items: true } },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 10,
        }),
      ]);

    return {
      seller: { id: seller.id, displayName: seller.displayName },
      range: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      definitions: {
        recognizedSellerRevenue:
          'SELLER ledger CREDIT minus DEBIT by occurredAt',
        netGrossSales:
          'SellerOrder grossAmount minus refundedGross by createdAt',
        productPerformance:
          'OrderItem snapshots; cancelled/refunded quantities and amounts excluded',
      },
      financials: this.mapFinancials(financialRows, statusRows),
      orderStatusSummary: statusRows.map((row) => ({
        currency: row.currency,
        status: row.status,
        count: row._count._all,
      })),
      topProducts: topProducts.map((row) => ({
        productId: row.productId,
        productTitle: row.productTitle,
        currency: row.currency,
        purchasedUnits: Number(row.purchasedUnits),
        cancelledUnits: Number(row.cancelledUnits),
        refundedUnits: Number(row.refundedUnits),
        netUnits: Number(row.netUnits),
        netGross: row.netGross.toFixed(2),
      })),
      recentSellerOrders: recentSellerOrders.map((order) => {
        const { _count, ...snapshot } = order;
        return { ...snapshot, itemCount: _count.items };
      }),
    };
  }

  private mapFinancials(
    ledgerRows: Array<{
      currency: string;
      direction: LedgerDirection;
      _sum: { amount: Prisma.Decimal | null };
    }>,
    orderRows: Array<{
      currency: string;
      _count: { _all: number };
      _sum: {
        grossAmount: Prisma.Decimal | null;
        refundedGross: Prisma.Decimal | null;
        platformCommission: Prisma.Decimal | null;
        refundedCommission: Prisma.Decimal | null;
        sellerNet: Prisma.Decimal | null;
        refundedSellerNet: Prisma.Decimal | null;
      };
    }>,
  ) {
    const currencies = new Set([
      ...ledgerRows.map((row) => row.currency),
      ...orderRows.map((row) => row.currency),
    ]);
    return [...currencies].sort().map((currency) => {
      const orders = orderRows.filter((row) => row.currency === currency);
      const sumOrder = (field: keyof (typeof orders)[number]['_sum']) =>
        orders.reduce(
          (sum, row) => sum.add(row._sum[field] ?? 0),
          new Prisma.Decimal(0),
        );
      const ledger = (direction: LedgerDirection) =>
        ledgerRows
          .filter(
            (row) => row.currency === currency && row.direction === direction,
          )
          .reduce(
            (sum, row) => sum.add(row._sum.amount ?? 0),
            new Prisma.Decimal(0),
          );
      const gross = sumOrder('grossAmount');
      const refundedGross = sumOrder('refundedGross');
      return {
        currency,
        orderCount: orders.reduce((sum, row) => sum + row._count._all, 0),
        bookedGross: gross.toFixed(2),
        refundedGross: refundedGross.toFixed(2),
        netGrossSales: gross.sub(refundedGross).toFixed(2),
        platformCommission: sumOrder('platformCommission').toFixed(2),
        refundedCommission: sumOrder('refundedCommission').toFixed(2),
        bookedSellerNet: sumOrder('sellerNet').toFixed(2),
        refundedSellerNet: sumOrder('refundedSellerNet').toFixed(2),
        recognizedSellerRevenue: ledger(LedgerDirection.CREDIT)
          .sub(ledger(LedgerDirection.DEBIT))
          .toFixed(2),
      };
    });
  }

  private topProducts(sellerId: string, from: Date, to: Date) {
    return this.prisma.$queryRaw<ProductPerformanceRow[]>(Prisma.sql`
      SELECT
        oi."productId" AS "productId",
        (array_agg(oi."productTitle" ORDER BY oi."createdAt" DESC))[1] AS "productTitle",
        so.currency,
        SUM(oi.quantity)::bigint AS "purchasedUnits",
        SUM(oi."cancelledQuantity")::bigint AS "cancelledUnits",
        SUM(oi."refundedQuantity")::bigint AS "refundedUnits",
        SUM(GREATEST(oi.quantity - oi."cancelledQuantity" - oi."refundedQuantity", 0))::bigint AS "netUnits",
        SUM(GREATEST(
          oi."lineTotal" - (oi."unitPrice" * oi."cancelledQuantity") - oi."refundedAmount",
          0
        ))::numeric AS "netGross"
      FROM "OrderItem" oi
      JOIN "SellerOrder" so ON so.id = oi."sellerOrderId"
      WHERE so."sellerId" = ${sellerId}::uuid
        AND so."createdAt" >= ${from}
        AND so."createdAt" <= ${to}
      GROUP BY oi."productId", so.currency
      ORDER BY "netGross" DESC, "netUnits" DESC, oi."productId" ASC
      LIMIT 5
    `);
  }

  private resolveRange(query: SellerDashboardQueryDto) {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - DEFAULT_RANGE_MS);
    if (from > to) throw new BadRequestException('from must not exceed to');
    if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
      throw new BadRequestException('Date range must not exceed 366 days');
    }
    return { from, to };
  }
}
