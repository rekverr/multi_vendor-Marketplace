import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import {
  CheckoutIdempotencyStatus,
  LedgerAccount,
  LedgerDirection,
  LedgerEntryType,
  Prisma,
  ProductStatus,
  ProductType,
  UserRole,
} from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { PRODUCT_UPDATED } from '../search/product-events.service.js';
import { calculateSellerOrderFinancials } from './domain/commission.policy.js';

const orderResponseInclude = {
  sellerOrders: {
    include: {
      seller: { select: { id: true, displayName: true } },
      items: {
        orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
      },
    },
    orderBy: { id: 'asc' as const },
  },
} satisfies Prisma.OrderInclude;

type CheckoutProduct = Prisma.ProductGetPayload<{
  include: { seller: { select: { id: true; displayName: true } } };
}>;

interface CheckoutLine {
  product: CheckoutProduct;
  quantity: number;
  lineTotal: Prisma.Decimal;
}

@Injectable()
export class CheckoutService {
  private readonly commissionRate: Prisma.Decimal;
  private readonly currency: string;
  private readonly requestHash = createHash('sha256')
    .update('customer-checkout:v1')
    .digest('hex');

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    config: ConfigService,
  ) {
    this.commissionRate = new Prisma.Decimal(
      config.getOrThrow<string>('PLATFORM_COMMISSION_RATE'),
    );
    this.currency = config.getOrThrow<string>('ORDER_CURRENCY');
  }

  async checkout(
    customerId: string,
    idempotencyKey: string,
    correlationId: string,
  ) {
    this.validateIdempotencyKey(idempotencyKey);

    const existing = await this.findIdempotency(customerId, idempotencyKey);
    if (existing) return this.resolveExisting(existing, this.requestHash);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.executeTransaction(
          customerId,
          idempotencyKey,
          correlationId,
        );
      } catch (error) {
        if (this.isIdempotencyConflict(error)) {
          const concurrent = await this.findIdempotency(
            customerId,
            idempotencyKey,
          );
          if (concurrent)
            return this.resolveExisting(concurrent, this.requestHash);
        }
        if (this.isSerializationFailure(error) && attempt < 3) continue;
        throw error;
      }
    }

    throw new ConflictException('Checkout could not be completed');
  }

  private executeTransaction(
    customerId: string,
    idempotencyKey: string,
    correlationId: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const customer = await tx.user.findUnique({
          where: { id: customerId },
          select: { role: true },
        });
        if (!customer || customer.role !== UserRole.CUSTOMER) {
          throw new ConflictException('Customer account required');
        }

        const command = await tx.checkoutIdempotency.create({
          data: {
            customerId,
            idempotencyKey,
            requestHash: this.requestHash,
          },
        });

        const lockedCarts = await tx.$queryRaw<
          Array<{ id: string }>
        >(Prisma.sql`
          SELECT id
          FROM "Cart"
          WHERE "userId" = ${customerId}::uuid
          FOR UPDATE
        `);
        const cartId = lockedCarts[0]?.id;
        if (!cartId) throw new BadRequestException('Cart is empty');

        const cart = await tx.cart.findUnique({
          where: { id: cartId },
          select: {
            items: {
              select: { productId: true, quantity: true },
              orderBy: { productId: 'asc' },
            },
          },
        });
        if (!cart?.items.length) throw new BadRequestException('Cart is empty');

        const productIds = cart.items.map((item) => item.productId).sort();
        await tx.$queryRaw(Prisma.sql`
          SELECT id
          FROM "Product"
          WHERE id IN (${Prisma.join(productIds)})
          ORDER BY id
          FOR UPDATE
        `);

        const products = await tx.product.findMany({
          where: { id: { in: productIds } },
          include: { seller: { select: { id: true, displayName: true } } },
        });
        const productsById = new Map(
          products.map((product) => [product.id, product]),
        );
        const lines: CheckoutLine[] = cart.items.map((item) => {
          const product = productsById.get(item.productId);
          if (
            !product ||
            product.status !== ProductStatus.PUBLISHED ||
            product.type !== ProductType.FIXED_PRICE ||
            product.price === null
          ) {
            throw new ConflictException('Cart contains an unavailable Product');
          }
          if (item.quantity < 1 || product.stock < item.quantity) {
            throw new ConflictException('Insufficient Product stock');
          }
          return {
            product,
            quantity: item.quantity,
            lineTotal: product.price.mul(item.quantity),
          };
        });

        for (const line of lines) {
          const decremented = await tx.product.updateMany({
            where: {
              id: line.product.id,
              status: ProductStatus.PUBLISHED,
              stock: { gte: line.quantity },
            },
            data: { stock: { decrement: line.quantity } },
          });
          if (decremented.count !== 1) {
            throw new ConflictException('Insufficient Product stock');
          }
        }

        const totalAmount = lines.reduce(
          (total, line) => total.add(line.lineTotal),
          new Prisma.Decimal(0),
        );
        const order = await tx.order.create({
          data: { customerId, currency: this.currency, totalAmount },
        });
        const groups = this.groupBySeller(lines);

        for (const [sellerId, sellerLines] of groups) {
          const gross = sellerLines.reduce(
            (total, line) => total.add(line.lineTotal),
            new Prisma.Decimal(0),
          );
          const financials = calculateSellerOrderFinancials(
            gross,
            this.commissionRate,
          );
          const sellerOrder = await tx.sellerOrder.create({
            data: {
              orderId: order.id,
              sellerId,
              currency: this.currency,
              ...financials,
            },
          });

          await tx.orderItem.createMany({
            data: sellerLines.map(({ product, quantity, lineTotal }) => ({
              sellerOrderId: sellerOrder.id,
              productId: product.id,
              productTitle: product.title,
              productImageUrl: product.imageUrl,
              productType: product.type,
              sellerIdSnapshot: product.seller.id,
              sellerNameSnapshot: product.seller.displayName,
              unitPrice: product.price!,
              quantity,
              lineTotal,
            })),
          });

          const ledgerEntries: Prisma.FinancialLedgerEntryCreateManyInput[] =
            [];
          if (financials.platformCommission.greaterThan(0)) {
            ledgerEntries.push({
              sellerOrderId: sellerOrder.id,
              account: LedgerAccount.PLATFORM,
              entryType: LedgerEntryType.COMMISSION,
              direction: LedgerDirection.CREDIT,
              amount: financials.platformCommission,
              currency: this.currency,
              idempotencyKey: `checkout:${order.id}:${sellerId}:commission`,
            });
          }
          if (financials.sellerNet.greaterThan(0)) {
            ledgerEntries.push({
              sellerOrderId: sellerOrder.id,
              account: LedgerAccount.SELLER,
              entryType: LedgerEntryType.SELLER_EARNING,
              direction: LedgerDirection.CREDIT,
              amount: financials.sellerNet,
              currency: this.currency,
              idempotencyKey: `checkout:${order.id}:${sellerId}:earning`,
            });
          }
          if (ledgerEntries.length) {
            await tx.financialLedgerEntry.createMany({ data: ledgerEntries });
          }

          await this.outbox.create(tx, {
            eventType: 'SELLER_ORDER_CREATED',
            aggregateType: 'SellerOrder',
            aggregateId: sellerOrder.id,
            correlationId,
            payload: {
              sellerOrderId: sellerOrder.id,
              orderId: order.id,
              sellerId,
            },
          });
        }

        for (const line of lines) {
          await this.outbox.create(tx, {
            eventType: PRODUCT_UPDATED,
            aggregateType: 'Product',
            aggregateId: line.product.id,
            correlationId,
            payload: {
              productId: line.product.id,
              reason: 'CHECKOUT_INVENTORY_DECREMENTED',
              quantity: line.quantity,
            },
          });
        }
        await this.outbox.create(tx, {
          eventType: 'ORDER_CREATED',
          aggregateType: 'Order',
          aggregateId: order.id,
          correlationId,
          payload: {
            orderId: order.id,
            customerId,
            sellerOrderCount: groups.size,
          },
        });

        await tx.cartItem.deleteMany({ where: { cartId } });
        await tx.checkoutIdempotency.update({
          where: { id: command.id },
          data: {
            status: CheckoutIdempotencyStatus.COMPLETED,
            orderId: order.id,
            completedAt: new Date(),
          },
        });

        return tx.order.findUniqueOrThrow({
          where: { id: order.id },
          include: orderResponseInclude,
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 15000,
      },
    );
  }

  private groupBySeller(lines: CheckoutLine[]): Map<string, CheckoutLine[]> {
    const groups = new Map<string, CheckoutLine[]>();
    for (const line of lines) {
      const existing = groups.get(line.product.sellerId) ?? [];
      existing.push(line);
      groups.set(line.product.sellerId, existing);
    }
    return groups;
  }

  private findIdempotency(customerId: string, idempotencyKey: string) {
    return this.prisma.checkoutIdempotency.findUnique({
      where: { customerId_idempotencyKey: { customerId, idempotencyKey } },
      select: { requestHash: true, status: true, orderId: true },
    });
  }

  private async resolveExisting(
    command: {
      requestHash: string;
      status: CheckoutIdempotencyStatus;
      orderId: string | null;
    },
    requestHash: string,
  ) {
    if (command.requestHash !== requestHash) {
      throw new ConflictException(
        'Idempotency key was used for another request',
      );
    }
    if (
      command.status !== CheckoutIdempotencyStatus.COMPLETED ||
      !command.orderId
    ) {
      throw new ConflictException(
        'Checkout with this idempotency key is in progress',
      );
    }
    return this.prisma.order.findUniqueOrThrow({
      where: { id: command.orderId },
      include: orderResponseInclude,
    });
  }

  private validateIdempotencyKey(key: string): void {
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key)) {
      throw new BadRequestException('Valid Idempotency-Key header is required');
    }
  }

  private isSerializationFailure(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    );
  }

  private isIdempotencyConflict(error: unknown): boolean {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      return false;
    }
    const target = error.meta?.target;
    return (
      error.meta?.modelName === 'CheckoutIdempotency' ||
      (Array.isArray(target) &&
        target.includes('customerId') &&
        target.includes('idempotencyKey'))
    );
  }
}
