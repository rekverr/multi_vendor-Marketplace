import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  SellerOrderStatus,
  UserRole,
} from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { structuredLog } from '../common/structured-log.js';
import { OutboxService } from '../outbox/outbox.service.js';
import {
  canTransitionSellerOrder,
  deriveOrderStatus,
} from './domain/order-status.policy.js';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto.js';

const sellerOrderSelect = {
  id: true,
  orderId: true,
  status: true,
  currency: true,
  grossAmount: true,
  commissionRate: true,
  platformCommission: true,
  sellerNet: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  items: { orderBy: { id: 'asc' as const } },
} satisfies Prisma.SellerOrderSelect;

const customerOrderSelect = {
  id: true,
  status: true,
  currency: true,
  totalAmount: true,
  refundedAmount: true,
  createdAt: true,
  updatedAt: true,
  sellerOrders: {
    select: {
      id: true,
      status: true,
      currency: true,
      grossAmount: true,
      createdAt: true,
      updatedAt: true,
      completedAt: true,
      seller: { select: { id: true, displayName: true } },
      items: { orderBy: { id: 'asc' as const } },
    },
    orderBy: { id: 'asc' as const },
  },
} satisfies Prisma.OrderSelect;

@Injectable()
export class OrderLifecycleService {
  private readonly logger = new Logger(OrderLifecycleService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async listSellerOrders(userId: string, query: ListOrdersQueryDto) {
    const sellerId = await this.getSellerId(userId);
    const where = { sellerId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.sellerOrder.findMany({
        where,
        select: sellerOrderSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.sellerOrder.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async getSellerOrder(userId: string, sellerOrderId: string) {
    const sellerId = await this.getSellerId(userId);
    const sellerOrder = await this.prisma.sellerOrder.findFirst({
      where: { id: sellerOrderId, sellerId },
      select: sellerOrderSelect,
    });
    if (!sellerOrder) throw new NotFoundException('SellerOrder not found');
    return sellerOrder;
  }

  async transitionSellerOrder(
    userId: string,
    sellerOrderId: string,
    targetStatus: SellerOrderStatus,
    correlationId: string,
  ) {
    const sellerId = await this.getSellerId(userId);
    const owned = await this.prisma.sellerOrder.findFirst({
      where: { id: sellerOrderId, sellerId },
      select: { orderId: true },
    });
    if (!owned) throw new NotFoundException('SellerOrder not found');

    const result = await this.prisma.$transaction(async (tx) => {
      const lockedParents = await tx.$queryRaw<
        Array<{ id: string; status: string }>
      >(Prisma.sql`
        SELECT id, status
        FROM "Order"
        WHERE id = ${owned.orderId}::uuid
        FOR UPDATE
      `);
      const previousParentStatus = lockedParents[0]?.status;
      const locked = await tx.$queryRaw<
        Array<{ id: string; orderId: string; status: SellerOrderStatus }>
      >(Prisma.sql`
        SELECT id, "orderId", status
        FROM "SellerOrder"
        WHERE id = ${sellerOrderId}::uuid
          AND "sellerId" = ${sellerId}::uuid
        FOR UPDATE
      `);
      const current = locked[0];
      if (!current) throw new NotFoundException('SellerOrder not found');
      if (!canTransitionSellerOrder(current.status, targetStatus)) {
        throw new ConflictException(
          `SellerOrder cannot transition from ${current.status} to ${targetStatus}`,
        );
      }
      const sellerOrder = await tx.sellerOrder.update({
        where: { id: current.id },
        data: {
          status: targetStatus,
          completedAt:
            targetStatus === SellerOrderStatus.COMPLETED
              ? new Date()
              : undefined,
        },
        select: sellerOrderSelect,
      });
      const children = await tx.sellerOrder.findMany({
        where: { orderId: current.orderId },
        select: { status: true },
      });
      const parentStatus = deriveOrderStatus(
        children.map((child) => child.status),
      );
      const parent = await tx.order.update({
        where: { id: current.orderId },
        data: { status: parentStatus },
        select: { id: true, status: true },
      });

      await this.outbox.create(tx, {
        eventType: 'SELLER_ORDER_STATUS_CHANGED',
        aggregateType: 'SellerOrder',
        aggregateId: sellerOrder.id,
        correlationId,
        payload: {
          sellerOrderId: sellerOrder.id,
          orderId: parent.id,
          previousStatus: current.status,
          status: sellerOrder.status,
        },
      });
      if (previousParentStatus !== parent.status) {
        await this.outbox.create(tx, {
          eventType: 'ORDER_STATUS_CHANGED',
          aggregateType: 'Order',
          aggregateId: parent.id,
          correlationId,
          payload: { orderId: parent.id, status: parent.status },
        });
      }

      return { ...sellerOrder, orderStatus: parent.status };
    });
    this.logger.log(
      structuredLog('SELLER_ORDER_STATUS_CHANGED', {
        correlationId,
        sellerOrderId: result.id,
        orderId: result.orderId,
        status: result.status,
        orderStatus: result.orderStatus,
      }),
    );
    return result;
  }

  async listCustomerOrders(userId: string, query: ListOrdersQueryDto) {
    await this.assertCustomer(userId);
    const where = { customerId: userId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        select: customerOrderSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async getCustomerOrder(userId: string, orderId: string) {
    await this.assertCustomer(userId);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId: userId },
      select: customerOrderSelect,
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private async getSellerId(userId: string): Promise<string> {
    const seller = await this.prisma.sellerProfile.findFirst({
      where: { userId, user: { role: UserRole.SELLER } },
      select: { id: true },
    });
    if (!seller) throw new NotFoundException('Seller profile not found');
    return seller.id;
  }

  private async assertCustomer(userId: string): Promise<void> {
    const customer = await this.prisma.user.findFirst({
      where: { id: userId, role: UserRole.CUSTOMER },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');
  }
}
