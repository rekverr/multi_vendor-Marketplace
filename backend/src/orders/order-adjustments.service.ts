import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  LedgerAccount,
  LedgerDirection,
  LedgerEntryType,
  OrderStatus,
  Prisma,
  SellerOrderStatus,
  UserRole,
} from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { PRODUCT_UPDATED } from '../search/product-events.service.js';
import { deriveOrderStatus } from './domain/order-status.policy.js';
import { CreateItemRefundDto } from './dto/create-item-refund.dto.js';

const refundSelect = {
  id: true,
  orderId: true,
  sellerOrderId: true,
  orderItemId: true,
  quantity: true,
  amount: true,
  commissionAmount: true,
  sellerNetAmount: true,
  reason: true,
  createdAt: true,
} satisfies Prisma.RefundSelect;

type Transaction = Prisma.TransactionClient;

@Injectable()
export class OrderAdjustmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async cancelOrder(
    customerId: string,
    orderId: string,
    correlationId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const order = await this.lockOwnedOrder(tx, orderId, customerId);
      const sellerOrders = await tx.$queryRaw<
        Array<{ id: string; status: SellerOrderStatus }>
      >(Prisma.sql`
        SELECT id, status
        FROM "SellerOrder"
        WHERE "orderId" = ${order.id}::uuid
        ORDER BY id
        FOR UPDATE
      `);
      if (!sellerOrders.length) throw new ConflictException('Order is empty');
      if (
        sellerOrders.every(
          (sellerOrder) => sellerOrder.status === SellerOrderStatus.CANCELLED,
        )
      ) {
        return tx.order.findUniqueOrThrow({
          where: { id: order.id },
          include: { sellerOrders: { include: { items: true } } },
        });
      }
      if (
        sellerOrders.some(
          (sellerOrder) => !this.isCancellable(sellerOrder.status),
        )
      ) {
        throw new ConflictException(
          'Order cannot be cancelled after a SellerOrder was shipped or completed',
        );
      }

      for (const sellerOrder of sellerOrders) {
        await this.cancelLockedSellerOrder(
          tx,
          sellerOrder.id,
          order.id,
          correlationId,
        );
      }
      await this.updateParentStatus(tx, order.id, order.status, correlationId);
      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { sellerOrders: { include: { items: true } } },
      });
    });
  }

  async cancelSellerOrder(
    customerId: string,
    orderId: string,
    sellerOrderId: string,
    correlationId: string,
  ) {
    const owned = await this.prisma.sellerOrder.findFirst({
      where: { id: sellerOrderId, orderId, order: { customerId } },
      select: { id: true },
    });
    if (!owned) throw new NotFoundException('SellerOrder not found');

    return this.prisma.$transaction(async (tx) => {
      const order = await this.lockOwnedOrder(tx, orderId, customerId);
      const locked = await tx.$queryRaw<
        Array<{ id: string; status: SellerOrderStatus }>
      >(Prisma.sql`
        SELECT id, status
        FROM "SellerOrder"
        WHERE id = ${sellerOrderId}::uuid
          AND "orderId" = ${order.id}::uuid
        FOR UPDATE
      `);
      const sellerOrder = locked[0];
      if (!sellerOrder) throw new NotFoundException('SellerOrder not found');
      if (sellerOrder.status === SellerOrderStatus.CANCELLED) {
        return tx.sellerOrder.findUniqueOrThrow({
          where: { id: sellerOrder.id },
          include: { items: true },
        });
      }
      if (!this.isCancellable(sellerOrder.status)) {
        throw new ConflictException(
          `SellerOrder cannot be cancelled while ${sellerOrder.status}`,
        );
      }

      const cancelled = await this.cancelLockedSellerOrder(
        tx,
        sellerOrder.id,
        order.id,
        correlationId,
      );
      const parent = await this.updateParentStatus(
        tx,
        order.id,
        order.status,
        correlationId,
      );
      return { ...cancelled, orderStatus: parent.status };
    });
  }

  async refundItem(
    userId: string,
    sellerOrderId: string,
    orderItemId: string,
    idempotencyKey: string,
    dto: CreateItemRefundDto,
    correlationId: string,
  ) {
    this.validateIdempotencyKey(idempotencyKey);
    const requestHash = this.refundRequestHash(sellerOrderId, orderItemId, dto);
    const existing = await this.findRefund(userId, idempotencyKey);
    if (existing) return this.resolveRefund(existing, requestHash);

    const owned = await this.prisma.sellerOrder.findFirst({
      where: {
        id: sellerOrderId,
        seller: { userId, user: { role: UserRole.SELLER } },
      },
      select: { orderId: true },
    });
    if (!owned) throw new NotFoundException('SellerOrder not found');

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.lockOrder(tx, owned.orderId);
        const lockedSellerOrders = await tx.$queryRaw<
          Array<{
            id: string;
            status: SellerOrderStatus;
            grossAmount: Prisma.Decimal;
            commissionRate: Prisma.Decimal;
            platformCommission: Prisma.Decimal;
            sellerNet: Prisma.Decimal;
            refundedGross: Prisma.Decimal;
            refundedCommission: Prisma.Decimal;
            refundedSellerNet: Prisma.Decimal;
            currency: string;
          }>
        >(Prisma.sql`
          SELECT id, status, "grossAmount", "commissionRate",
                 "platformCommission", "sellerNet", "refundedGross",
                 "refundedCommission", "refundedSellerNet", currency
          FROM "SellerOrder"
          WHERE id = ${sellerOrderId}::uuid
          FOR UPDATE
        `);
        const sellerOrder = lockedSellerOrders[0];
        if (!sellerOrder) throw new NotFoundException('SellerOrder not found');
        if (sellerOrder.status !== SellerOrderStatus.COMPLETED) {
          throw new ConflictException(
            'Items can be refunded only after SellerOrder completion',
          );
        }

        const retry = await tx.refund.findUnique({
          where: {
            initiatedById_idempotencyKey: {
              initiatedById: userId,
              idempotencyKey,
            },
          },
          select: { ...refundSelect, requestHash: true },
        });
        if (retry) return this.resolveRefund(retry, requestHash);

        const lockedItems = await tx.$queryRaw<
          Array<{
            id: string;
            productId: string;
            quantity: number;
            cancelledQuantity: number;
            refundedQuantity: number;
            unitPrice: Prisma.Decimal;
          }>
        >(Prisma.sql`
          SELECT id, "productId", quantity, "cancelledQuantity",
                 "refundedQuantity", "unitPrice"
          FROM "OrderItem"
          WHERE id = ${orderItemId}::uuid
            AND "sellerOrderId" = ${sellerOrderId}::uuid
          FOR UPDATE
        `);
        const item = lockedItems[0];
        if (!item) throw new NotFoundException('OrderItem not found');
        const refundableQuantity =
          item.quantity - item.cancelledQuantity - item.refundedQuantity;
        if (dto.quantity > refundableQuantity) {
          throw new ConflictException(
            'Refund quantity exceeds refundable quantity',
          );
        }

        const amount = new Prisma.Decimal(item.unitPrice).mul(dto.quantity);
        const allocation = this.allocateRefund(sellerOrder, amount);
        const refund = await tx.refund.create({
          data: {
            initiatedById: userId,
            orderId: owned.orderId,
            sellerOrderId,
            orderItemId,
            idempotencyKey,
            requestHash,
            quantity: dto.quantity,
            amount,
            commissionAmount: allocation.commission,
            sellerNetAmount: allocation.sellerNet,
            reason: dto.reason,
          },
          select: refundSelect,
        });
        await tx.orderItem.update({
          where: { id: item.id },
          data: {
            refundedQuantity: { increment: dto.quantity },
            refundedAmount: { increment: amount },
          },
        });
        await tx.sellerOrder.update({
          where: { id: sellerOrder.id },
          data: {
            refundedGross: { increment: amount },
            refundedCommission: { increment: allocation.commission },
            refundedSellerNet: { increment: allocation.sellerNet },
          },
        });
        await tx.order.update({
          where: { id: owned.orderId },
          data: { refundedAmount: { increment: amount } },
        });
        await this.createReversalLedger(
          tx,
          sellerOrder.id,
          item.id,
          sellerOrder.currency,
          `refund:${refund.id}`,
          LedgerEntryType.REFUND_REVERSAL,
          allocation.commission,
          allocation.sellerNet,
        );
        await this.outbox.create(tx, {
          eventType: 'REFUND_CREATED',
          aggregateType: 'Refund',
          aggregateId: refund.id,
          correlationId,
          payload: {
            refundId: refund.id,
            orderId: owned.orderId,
            sellerOrderId,
            orderItemId,
            quantity: dto.quantity,
            amount: amount.toFixed(2),
          },
        });
        return refund;
      });
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        const concurrent = await this.findRefund(userId, idempotencyKey);
        if (concurrent) return this.resolveRefund(concurrent, requestHash);
      }
      throw error;
    }
  }

  private async cancelLockedSellerOrder(
    tx: Transaction,
    sellerOrderId: string,
    orderId: string,
    correlationId: string,
  ) {
    const sellerOrder = await tx.sellerOrder.findUniqueOrThrow({
      where: { id: sellerOrderId },
      include: { items: { orderBy: { productId: 'asc' } } },
    });
    const productIds = sellerOrder.items.map((item) => item.productId).sort();
    await tx.$queryRaw(Prisma.sql`
      SELECT id
      FROM "Product"
      WHERE id IN (${Prisma.join(productIds)})
      ORDER BY id
      FOR UPDATE
    `);
    for (const item of sellerOrder.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
      await tx.orderItem.update({
        where: { id: item.id },
        data: { cancelledQuantity: item.quantity },
      });
      await this.outbox.create(tx, {
        eventType: PRODUCT_UPDATED,
        aggregateType: 'Product',
        aggregateId: item.productId,
        correlationId,
        payload: {
          productId: item.productId,
          reason: 'SELLER_ORDER_CANCELLED_INVENTORY_RESTORED',
          quantity: item.quantity,
        },
      });
    }

    await tx.sellerOrder.update({
      where: { id: sellerOrder.id },
      data: {
        status: SellerOrderStatus.CANCELLED,
        cancelledAt: new Date(),
        refundedGross: sellerOrder.grossAmount,
        refundedCommission: sellerOrder.platformCommission,
        refundedSellerNet: sellerOrder.sellerNet,
      },
    });
    await tx.order.update({
      where: { id: orderId },
      data: { refundedAmount: { increment: sellerOrder.grossAmount } },
    });
    await this.createReversalLedger(
      tx,
      sellerOrder.id,
      null,
      sellerOrder.currency,
      `cancellation:${sellerOrder.id}`,
      LedgerEntryType.CANCELLATION_REVERSAL,
      sellerOrder.platformCommission,
      sellerOrder.sellerNet,
    );
    await this.outbox.create(tx, {
      eventType: 'SELLER_ORDER_CANCELLED',
      aggregateType: 'SellerOrder',
      aggregateId: sellerOrder.id,
      correlationId,
      payload: { sellerOrderId: sellerOrder.id, orderId },
    });
    return tx.sellerOrder.findUniqueOrThrow({
      where: { id: sellerOrder.id },
      include: { items: true },
    });
  }

  private async updateParentStatus(
    tx: Transaction,
    orderId: string,
    previousStatus: OrderStatus,
    correlationId: string,
  ) {
    const children = await tx.sellerOrder.findMany({
      where: { orderId },
      select: { status: true },
    });
    const status = deriveOrderStatus(children.map((child) => child.status));
    const order = await tx.order.update({
      where: { id: orderId },
      data: { status },
      select: { id: true, status: true },
    });
    if (previousStatus !== status) {
      await this.outbox.create(tx, {
        eventType: 'ORDER_STATUS_CHANGED',
        aggregateType: 'Order',
        aggregateId: order.id,
        correlationId,
        payload: { orderId: order.id, status },
      });
    }
    return order;
  }

  private async lockOwnedOrder(
    tx: Transaction,
    orderId: string,
    customerId: string,
  ) {
    const rows = await tx.$queryRaw<Array<{ id: string; status: OrderStatus }>>(
      Prisma.sql`
        SELECT id, status
        FROM "Order"
        WHERE id = ${orderId}::uuid
          AND "customerId" = ${customerId}::uuid
        FOR UPDATE
      `,
    );
    if (!rows[0]) throw new NotFoundException('Order not found');
    return rows[0];
  }

  private async lockOrder(tx: Transaction, orderId: string): Promise<void> {
    await tx.$queryRaw(Prisma.sql`
      SELECT id FROM "Order" WHERE id = ${orderId}::uuid FOR UPDATE
    `);
  }

  private isCancellable(status: SellerOrderStatus): boolean {
    return (
      status === SellerOrderStatus.NEW ||
      status === SellerOrderStatus.PROCESSING
    );
  }

  private allocateRefund(
    sellerOrder: {
      grossAmount: Prisma.Decimal;
      commissionRate: Prisma.Decimal;
      platformCommission: Prisma.Decimal;
      sellerNet: Prisma.Decimal;
      refundedGross: Prisma.Decimal;
      refundedCommission: Prisma.Decimal;
      refundedSellerNet: Prisma.Decimal;
    },
    amount: Prisma.Decimal,
  ) {
    const remainingGross = new Prisma.Decimal(sellerOrder.grossAmount).sub(
      sellerOrder.refundedGross,
    );
    const remainingCommission = new Prisma.Decimal(
      sellerOrder.platformCommission,
    ).sub(sellerOrder.refundedCommission);
    const remainingSellerNet = new Prisma.Decimal(sellerOrder.sellerNet).sub(
      sellerOrder.refundedSellerNet,
    );
    if (amount.greaterThan(remainingGross)) {
      throw new ConflictException('Refund amount exceeds refundable amount');
    }
    if (amount.equals(remainingGross)) {
      return {
        commission: remainingCommission,
        sellerNet: remainingSellerNet,
      };
    }

    let commission = amount
      .mul(sellerOrder.commissionRate)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    if (commission.greaterThan(remainingCommission)) {
      commission = remainingCommission;
    }
    let sellerNet = amount.sub(commission);
    if (sellerNet.greaterThan(remainingSellerNet)) {
      sellerNet = remainingSellerNet;
      commission = amount.sub(sellerNet);
    }
    return { commission, sellerNet };
  }

  private async createReversalLedger(
    tx: Transaction,
    sellerOrderId: string,
    orderItemId: string | null,
    currency: string,
    keyPrefix: string,
    entryType: LedgerEntryType,
    commission: Prisma.Decimal,
    sellerNet: Prisma.Decimal,
  ) {
    const entries: Prisma.FinancialLedgerEntryCreateManyInput[] = [];
    if (commission.greaterThan(0)) {
      entries.push({
        sellerOrderId,
        orderItemId,
        account: LedgerAccount.PLATFORM,
        entryType,
        direction: LedgerDirection.DEBIT,
        amount: commission,
        currency,
        idempotencyKey: `${keyPrefix}:commission`,
      });
    }
    if (sellerNet.greaterThan(0)) {
      entries.push({
        sellerOrderId,
        orderItemId,
        account: LedgerAccount.SELLER,
        entryType,
        direction: LedgerDirection.DEBIT,
        amount: sellerNet,
        currency,
        idempotencyKey: `${keyPrefix}:seller-net`,
      });
    }
    if (entries.length)
      await tx.financialLedgerEntry.createMany({ data: entries });
  }

  private findRefund(userId: string, idempotencyKey: string) {
    return this.prisma.refund.findUnique({
      where: {
        initiatedById_idempotencyKey: {
          initiatedById: userId,
          idempotencyKey,
        },
      },
      select: { ...refundSelect, requestHash: true },
    });
  }

  private resolveRefund(
    refund: Prisma.RefundGetPayload<{
      select: typeof refundSelect & { requestHash: true };
    }>,
    requestHash: string,
  ) {
    const { requestHash: persistedRequestHash, ...result } = refund;
    if (persistedRequestHash !== requestHash) {
      throw new ConflictException(
        'Idempotency key was used for another refund request',
      );
    }
    return result;
  }

  private refundRequestHash(
    sellerOrderId: string,
    orderItemId: string,
    dto: CreateItemRefundDto,
  ): string {
    return createHash('sha256')
      .update(
        JSON.stringify({
          operation: 'item-refund:v1',
          sellerOrderId,
          orderItemId,
          quantity: dto.quantity,
          reason: dto.reason ?? null,
        }),
      )
      .digest('hex');
  }

  private validateIdempotencyKey(key: string): void {
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key)) {
      throw new BadRequestException('Valid Idempotency-Key header is required');
    }
  }

  private isUniqueConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
