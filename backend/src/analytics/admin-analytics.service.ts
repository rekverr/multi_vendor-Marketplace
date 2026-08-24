import { BadRequestException, Injectable } from '@nestjs/common';
import { Readable } from 'node:stream';
import {
  CheckoutAttemptStatus,
  LedgerAccount,
  LedgerDirection,
  Prisma,
} from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { csvRow } from './csv.js';
import { SellerDashboardQueryDto } from './dto/seller-dashboard-query.dto.js';

const DEFAULT_RANGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000;
const CSV_BATCH_SIZE = 500;

interface NetSalesRow {
  currency: string;
  orderCount: bigint;
  bookedGross: Prisma.Decimal;
  refundedGross: Prisma.Decimal;
  netGross: Prisma.Decimal;
}

interface ProductRow {
  productId: string;
  productTitle: string;
  currency: string;
  netUnits: bigint;
  netGross: Prisma.Decimal;
}

interface SellerRow {
  sellerId: string;
  sellerName: string;
  currency: string;
  recognizedRevenue: Prisma.Decimal;
}

interface DailySalesRow {
  day: Date;
  currency: string;
  orderCount: bigint;
  netGross: Prisma.Decimal;
}

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(query: SellerDashboardQueryDto) {
    const range = this.resolveRange(query);
    const duration = range.to.getTime() - range.from.getTime();
    const previous = {
      from: new Date(range.from.getTime() - duration - 1),
      to: new Date(range.from.getTime() - 1),
    };

    const [
      currentSales,
      previousSales,
      ledgerRows,
      statusRows,
      topProducts,
      topSellers,
      dailySales,
      checkoutAttemptRows,
    ] = await Promise.all([
      this.netSales(range.from, range.to),
      this.netSales(previous.from, previous.to),
      this.prisma.financialLedgerEntry.groupBy({
        by: ['account', 'currency', 'direction'],
        where: { occurredAt: { gte: range.from, lte: range.to } },
        _sum: { amount: true },
      }),
      this.prisma.order.groupBy({
        by: ['currency', 'status'],
        where: { createdAt: { gte: range.from, lte: range.to } },
        _count: { _all: true },
      }),
      this.topProducts(range.from, range.to),
      this.topSellers(range.from, range.to),
      this.dailySales(range.from, range.to),
      this.prisma.checkoutAttempt.groupBy({
        by: ['status'],
        where: { createdAt: { gte: range.from, lte: range.to } },
        _count: { _all: true },
      }),
    ]);

    return {
      range: this.rangeResponse(range),
      definitions: {
        totalRevenue:
          'Order totalAmount minus refundedAmount, grouped by Order.createdAt',
        platformRevenue:
          'PLATFORM ledger CREDIT minus DEBIT, grouped by occurredAt',
        sellerRevenue:
          'SELLER ledger CREDIT minus DEBIT, grouped by occurredAt',
        topProducts:
          'Top 5 by net gross from OrderItem snapshots after cancelled/refunded amounts',
        topSellers: 'Top 5 by recognized SELLER ledger revenue after reversals',
        dailySales:
          'Net Order sales assigned to UTC Order creation day; later refunds reduce that day',
        conversion:
          'Unique successful checkout attempts divided by all unique checkout attempts, scoped by attempt creation time; idempotent retries count once',
      },
      financials: this.mapFinancials(currentSales, ledgerRows),
      orderStatusSummary: statusRows.map((row) => ({
        currency: row.currency,
        status: row.status,
        count: row._count._all,
      })),
      topProducts: topProducts.map((row) => ({
        ...row,
        netUnits: Number(row.netUnits),
        netGross: row.netGross.toFixed(2),
      })),
      topSellers: topSellers.map((row) => ({
        ...row,
        recognizedRevenue: row.recognizedRevenue.toFixed(2),
      })),
      dailySales: dailySales.map((row) => ({
        day: row.day.toISOString().slice(0, 10),
        currency: row.currency,
        orderCount: Number(row.orderCount),
        netGross: row.netGross.toFixed(2),
      })),
      previousPeriod: {
        range: this.rangeResponse(previous),
        sales: previousSales.map((row) => ({
          currency: row.currency,
          orderCount: Number(row.orderCount),
          netGross: row.netGross.toFixed(2),
        })),
      },
      periodComparison: this.compareSales(currentSales, previousSales),
      conversion: this.mapConversion(checkoutAttemptRows),
    };
  }

  createSalesCsv(query: SellerDashboardQueryDto) {
    const range = this.resolveRange(query);
    const filename = `marketplace-sales-${range.from.toISOString().slice(0, 10)}-${range.to.toISOString().slice(0, 10)}.csv`;
    return { filename, stream: Readable.from(this.salesCsv(range)) };
  }

  private async *salesCsv(range: { from: Date; to: Date }) {
    yield csvRow([
      'orderId',
      'sellerOrderId',
      'orderCreatedAt',
      'sellerOrderStatus',
      'sellerId',
      'sellerNameSnapshot',
      'productId',
      'productTitleSnapshot',
      'unitPrice',
      'quantity',
      'lineTotal',
      'cancelledQuantity',
      'refundedQuantity',
      'refundedAmount',
      'netQuantity',
      'netSales',
      'currency',
    ]);
    let cursor: string | undefined;
    for (;;) {
      const items = await this.prisma.orderItem.findMany({
        where: {
          id: cursor ? { gt: cursor } : undefined,
          sellerOrder: {
            order: { createdAt: { gte: range.from, lte: range.to } },
          },
        },
        select: {
          id: true,
          productId: true,
          productTitle: true,
          sellerIdSnapshot: true,
          sellerNameSnapshot: true,
          unitPrice: true,
          quantity: true,
          lineTotal: true,
          cancelledQuantity: true,
          refundedQuantity: true,
          refundedAmount: true,
          sellerOrder: {
            select: {
              id: true,
              status: true,
              currency: true,
              order: { select: { id: true, createdAt: true } },
            },
          },
        },
        orderBy: { id: 'asc' },
        take: CSV_BATCH_SIZE,
      });
      if (items.length === 0) return;
      for (const item of items) {
        const netQuantity = Math.max(
          item.quantity - item.cancelledQuantity - item.refundedQuantity,
          0,
        );
        const netSales = Prisma.Decimal.max(
          item.lineTotal
            .sub(item.unitPrice.mul(item.cancelledQuantity))
            .sub(item.refundedAmount),
          0,
        );
        yield csvRow([
          item.sellerOrder.order.id,
          item.sellerOrder.id,
          item.sellerOrder.order.createdAt.toISOString(),
          item.sellerOrder.status,
          item.sellerIdSnapshot,
          item.sellerNameSnapshot,
          item.productId,
          item.productTitle,
          item.unitPrice.toFixed(2),
          item.quantity,
          item.lineTotal.toFixed(2),
          item.cancelledQuantity,
          item.refundedQuantity,
          item.refundedAmount.toFixed(2),
          netQuantity,
          netSales.toFixed(2),
          item.sellerOrder.currency,
        ]);
      }
      cursor = items.at(-1)!.id;
      if (items.length < CSV_BATCH_SIZE) return;
    }
  }

  private mapFinancials(
    salesRows: NetSalesRow[],
    ledgerRows: Array<{
      account: LedgerAccount;
      currency: string;
      direction: LedgerDirection;
      _sum: { amount: Prisma.Decimal | null };
    }>,
  ) {
    const currencies = new Set([
      ...salesRows.map((row) => row.currency),
      ...ledgerRows.map((row) => row.currency),
    ]);
    const ledger = (
      currency: string,
      account: LedgerAccount,
      direction: LedgerDirection,
    ) =>
      ledgerRows
        .filter(
          (row) =>
            row.currency === currency &&
            row.account === account &&
            row.direction === direction,
        )
        .reduce(
          (sum, row) => sum.add(row._sum.amount ?? 0),
          new Prisma.Decimal(0),
        );
    return [...currencies].sort().map((currency) => {
      const sales = salesRows.find((row) => row.currency === currency);
      return {
        currency,
        orderCount: Number(sales?.orderCount ?? 0),
        bookedGross: (sales?.bookedGross ?? new Prisma.Decimal(0)).toFixed(2),
        refundedGross: (sales?.refundedGross ?? new Prisma.Decimal(0)).toFixed(
          2,
        ),
        totalRevenue: (sales?.netGross ?? new Prisma.Decimal(0)).toFixed(2),
        platformRevenue: ledger(
          currency,
          LedgerAccount.PLATFORM,
          LedgerDirection.CREDIT,
        )
          .sub(ledger(currency, LedgerAccount.PLATFORM, LedgerDirection.DEBIT))
          .toFixed(2),
        sellerRevenue: ledger(
          currency,
          LedgerAccount.SELLER,
          LedgerDirection.CREDIT,
        )
          .sub(ledger(currency, LedgerAccount.SELLER, LedgerDirection.DEBIT))
          .toFixed(2),
      };
    });
  }

  private compareSales(current: NetSalesRow[], previous: NetSalesRow[]) {
    const currencies = new Set([
      ...current.map((row) => row.currency),
      ...previous.map((row) => row.currency),
    ]);
    return [...currencies].sort().map((currency) => {
      const currentAmount =
        current.find((row) => row.currency === currency)?.netGross ??
        new Prisma.Decimal(0);
      const previousAmount =
        previous.find((row) => row.currency === currency)?.netGross ??
        new Prisma.Decimal(0);
      const delta = currentAmount.sub(previousAmount);
      return {
        currency,
        currentNetGross: currentAmount.toFixed(2),
        previousNetGross: previousAmount.toFixed(2),
        delta: delta.toFixed(2),
        percentChange: previousAmount.isZero()
          ? null
          : delta
              .div(previousAmount)
              .mul(100)
              .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
              .toFixed(2),
      };
    });
  }

  private mapConversion(
    rows: Array<{
      status: CheckoutAttemptStatus;
      _count: { _all: number };
    }>,
  ) {
    const count = (status: CheckoutAttemptStatus) =>
      rows.find((row) => row.status === status)?._count._all ?? 0;
    const successfulAttempts = count(CheckoutAttemptStatus.SUCCEEDED);
    const failedAttempts = count(CheckoutAttemptStatus.FAILED);
    const processingAttempts = count(CheckoutAttemptStatus.PROCESSING);
    const totalAttempts =
      successfulAttempts + failedAttempts + processingAttempts;

    return {
      available: totalAttempts > 0,
      successfulAttempts,
      failedAttempts,
      processingAttempts,
      totalAttempts,
      ratePercent:
        totalAttempts === 0
          ? null
          : new Prisma.Decimal(successfulAttempts)
              .div(totalAttempts)
              .mul(100)
              .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
              .toFixed(2),
    };
  }

  private netSales(from: Date, to: Date) {
    return this.prisma.$queryRaw<NetSalesRow[]>(Prisma.sql`
      SELECT
        currency,
        COUNT(*)::bigint AS "orderCount",
        SUM("totalAmount")::numeric AS "bookedGross",
        SUM("refundedAmount")::numeric AS "refundedGross",
        SUM("totalAmount" - "refundedAmount")::numeric AS "netGross"
      FROM "Order"
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY currency
      ORDER BY currency ASC
    `);
  }

  private topProducts(from: Date, to: Date) {
    return this.prisma.$queryRaw<ProductRow[]>(Prisma.sql`
      SELECT
        oi."productId" AS "productId",
        (array_agg(oi."productTitle" ORDER BY oi."createdAt" DESC))[1] AS "productTitle",
        so.currency,
        SUM(GREATEST(oi.quantity - oi."cancelledQuantity" - oi."refundedQuantity", 0))::bigint AS "netUnits",
        SUM(GREATEST(oi."lineTotal" - oi."unitPrice" * oi."cancelledQuantity" - oi."refundedAmount", 0))::numeric AS "netGross"
      FROM "OrderItem" oi
      JOIN "SellerOrder" so ON so.id = oi."sellerOrderId"
      JOIN "Order" o ON o.id = so."orderId"
      WHERE o."createdAt" >= ${from} AND o."createdAt" <= ${to}
      GROUP BY oi."productId", so.currency
      ORDER BY "netGross" DESC, "netUnits" DESC, oi."productId" ASC
      LIMIT 5
    `);
  }

  private topSellers(from: Date, to: Date) {
    return this.prisma.$queryRaw<SellerRow[]>(Prisma.sql`
      SELECT
        so."sellerId" AS "sellerId",
        sp."displayName" AS "sellerName",
        le.currency,
        SUM(CASE WHEN le.direction = 'CREDIT' THEN le.amount ELSE -le.amount END)::numeric AS "recognizedRevenue"
      FROM "FinancialLedgerEntry" le
      JOIN "SellerOrder" so ON so.id = le."sellerOrderId"
      JOIN "SellerProfile" sp ON sp.id = so."sellerId"
      WHERE le.account = 'SELLER'
        AND le."occurredAt" >= ${from}
        AND le."occurredAt" <= ${to}
      GROUP BY so."sellerId", sp."displayName", le.currency
      ORDER BY "recognizedRevenue" DESC, so."sellerId" ASC
      LIMIT 5
    `);
  }

  private dailySales(from: Date, to: Date) {
    return this.prisma.$queryRaw<DailySalesRow[]>(Prisma.sql`
      SELECT
        date_trunc('day', "createdAt" AT TIME ZONE 'UTC') AS day,
        currency,
        COUNT(*)::bigint AS "orderCount",
        SUM("totalAmount" - "refundedAmount")::numeric AS "netGross"
      FROM "Order"
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY day, currency
      ORDER BY day ASC, currency ASC
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

  private rangeResponse(range: { from: Date; to: Date }) {
    return { from: range.from.toISOString(), to: range.to.toISOString() };
  }
}
