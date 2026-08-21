import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DisputeStatus,
  Prisma,
  SellerOrderStatus,
  UserRole,
} from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { canTransitionDispute } from './domain/dispute-status.policy.js';
import { CreateDisputeDto } from './dto/create-dispute.dto.js';
import { ListDisputesQueryDto } from './dto/list-disputes-query.dto.js';
import { UpdateDisputeStatusDto } from './dto/update-dispute-status.dto.js';

const eligibleSellerOrderStatuses = new Set<SellerOrderStatus>([
  SellerOrderStatus.PROCESSING,
  SellerOrderStatus.SHIPPED,
  SellerOrderStatus.COMPLETED,
  SellerOrderStatus.PARTIALLY_CANCELLED,
]);

const disputeSelect = {
  id: true,
  orderId: true,
  sellerOrderId: true,
  orderItemId: true,
  status: true,
  reason: true,
  resolutionNote: true,
  reviewedAt: true,
  resolvedAt: true,
  closedAt: true,
  createdAt: true,
  updatedAt: true,
  orderItem: {
    select: {
      id: true,
      productId: true,
      productTitle: true,
      quantity: true,
      unitPrice: true,
      lineTotal: true,
    },
  },
} satisfies Prisma.DisputeSelect;

const adminDisputeSelect = {
  ...disputeSelect,
  customerId: true,
  reviewedById: true,
  sellerOrder: {
    select: { sellerId: true, status: true },
  },
} satisfies Prisma.DisputeSelect;

@Injectable()
export class DisputesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async create(
    customerId: string,
    orderId: string,
    dto: CreateDisputeDto,
    correlationId: string,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<
          Array<{ id: string; status: SellerOrderStatus }>
        >(Prisma.sql`
          SELECT so.id, so.status
          FROM "SellerOrder" so
          JOIN "Order" o ON o.id = so."orderId"
          WHERE so.id = ${dto.sellerOrderId}::uuid
            AND so."orderId" = ${orderId}::uuid
            AND o."customerId" = ${customerId}::uuid
          FOR UPDATE OF so
        `);
        const sellerOrder = rows[0];
        if (!sellerOrder)
          throw new NotFoundException('Purchased order not found');
        if (!eligibleSellerOrderStatuses.has(sellerOrder.status)) {
          throw new ConflictException(
            'SellerOrder is not eligible for dispute',
          );
        }
        if (dto.orderItemId) {
          const item = await tx.orderItem.findFirst({
            where: { id: dto.orderItemId, sellerOrderId: sellerOrder.id },
            select: { id: true },
          });
          if (!item) throw new NotFoundException('Purchased item not found');
        }
        const scopeKey = dto.orderItemId
          ? `item:${dto.orderItemId}`
          : `seller-order:${sellerOrder.id}`;
        const dispute = await tx.dispute.create({
          data: {
            customerId,
            orderId,
            sellerOrderId: sellerOrder.id,
            orderItemId: dto.orderItemId,
            scopeKey,
            reason: dto.reason,
          },
          select: disputeSelect,
        });
        await this.outbox.create(tx, {
          eventType: 'DISPUTE_OPENED',
          aggregateType: 'Dispute',
          aggregateId: dispute.id,
          correlationId,
          payload: {
            disputeId: dispute.id,
            orderId,
            sellerOrderId: sellerOrder.id,
            status: dispute.status,
          },
        });
        return dispute;
      });
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        throw new ConflictException('Dispute already exists for this purchase');
      }
      throw error;
    }
  }

  listCustomer(customerId: string, query: ListDisputesQueryDto) {
    return this.list(
      { customerId, status: query.status },
      query,
      disputeSelect,
    );
  }

  async getCustomer(customerId: string, disputeId: string) {
    return this.findOne({ id: disputeId, customerId }, disputeSelect);
  }

  async listSeller(userId: string, query: ListDisputesQueryDto) {
    return this.list(
      {
        status: query.status,
        sellerOrder: {
          seller: { userId, user: { role: UserRole.SELLER } },
        },
      },
      query,
      disputeSelect,
    );
  }

  async getSeller(userId: string, disputeId: string) {
    return this.findOne(
      {
        id: disputeId,
        sellerOrder: {
          seller: { userId, user: { role: UserRole.SELLER } },
        },
      },
      disputeSelect,
    );
  }

  listAdmin(query: ListDisputesQueryDto) {
    return this.list({ status: query.status }, query, adminDisputeSelect);
  }

  getAdmin(disputeId: string) {
    return this.findOne({ id: disputeId }, adminDisputeSelect);
  }

  async transition(
    adminId: string,
    disputeId: string,
    dto: UpdateDisputeStatusDto,
    correlationId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ status: DisputeStatus }>>(
        Prisma.sql`
          SELECT status FROM "Dispute"
          WHERE id = ${disputeId}::uuid
          FOR UPDATE
        `,
      );
      const current = rows[0];
      if (!current) throw new NotFoundException('Dispute not found');
      if (!canTransitionDispute(current.status, dto.status)) {
        throw new ConflictException(
          `Dispute cannot transition from ${current.status} to ${dto.status}`,
        );
      }
      if (
        (dto.status === DisputeStatus.RESOLVED ||
          dto.status === DisputeStatus.REJECTED) &&
        !dto.resolutionNote
      ) {
        throw new BadRequestException('Resolution note is required');
      }
      const now = new Date();
      const dispute = await tx.dispute.update({
        where: { id: disputeId },
        data: {
          status: dto.status,
          resolutionNote: dto.resolutionNote,
          reviewedById: adminId,
          reviewedAt: now,
          resolvedAt:
            dto.status === DisputeStatus.RESOLVED ||
            dto.status === DisputeStatus.REJECTED
              ? now
              : undefined,
          closedAt: dto.status === DisputeStatus.CLOSED ? now : undefined,
        },
        select: adminDisputeSelect,
      });
      await this.outbox.create(tx, {
        eventType: 'DISPUTE_STATUS_CHANGED',
        aggregateType: 'Dispute',
        aggregateId: dispute.id,
        correlationId,
        payload: {
          disputeId: dispute.id,
          previousStatus: current.status,
          status: dispute.status,
          orderId: dispute.orderId,
          sellerOrderId: dispute.sellerOrderId,
        },
      });
      return dispute;
    });
  }

  private async list(
    where: Prisma.DisputeWhereInput,
    query: ListDisputesQueryDto,
    select: Prisma.DisputeSelect,
  ) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.dispute.findMany({
        where,
        select,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.dispute.count({ where }),
    ]);
    return {
      items,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  private async findOne(
    where: Prisma.DisputeWhereInput,
    select: Prisma.DisputeSelect,
  ) {
    const dispute = await this.prisma.dispute.findFirst({ where, select });
    if (!dispute) throw new NotFoundException('Dispute not found');
    return dispute;
  }

  private isUniqueConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
