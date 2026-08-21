import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import type { Job } from 'bullmq';
import { Prisma, ProductStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import type { DomainEventEnvelope } from '../queue/domain-events-queue.service.js';
import { REALTIME_EVENTS_QUEUE } from '../queue/queue.constants.js';
import { QueueWorkerFactory } from '../queue/queue-worker.factory.js';
import { RealtimeGateway } from './realtime.gateway.js';

const CONSUMER_NAME = 'marketplace-realtime-v1';
const PRODUCT_EVENTS = new Set([
  'PRODUCT_CREATED',
  'PRODUCT_UPDATED',
  'PRODUCT_PUBLISHED',
  'PRODUCT_UNPUBLISHED',
  'PRODUCT_ARCHIVED',
]);
const SELLER_ORDER_EVENTS = new Set([
  'SELLER_ORDER_CREATED',
  'SELLER_ORDER_STATUS_CHANGED',
  'SELLER_ORDER_CANCELLED',
]);

@Injectable()
export class RealtimeEventsConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(RealtimeEventsConsumer.name);

  constructor(
    private readonly workers: QueueWorkerFactory,
    private readonly prisma: PrismaService,
    private readonly gateway: RealtimeGateway,
  ) {}

  onApplicationBootstrap(): void {
    this.workers.create<DomainEventEnvelope>(
      REALTIME_EVENTS_QUEUE,
      (job) => this.process(job),
      5,
    );
  }

  async process(job: Job<DomainEventEnvelope>): Promise<void> {
    const event = job.data;
    if (!(await this.isUnprocessed(event.eventId))) return;

    if (
      PRODUCT_EVENTS.has(event.eventType) &&
      event.aggregateType === 'Product'
    ) {
      await this.emitProduct(event);
    } else if (
      event.eventType === 'AUCTION_BID_ACCEPTED' &&
      event.aggregateType === 'Auction'
    ) {
      await this.emitAuction(event);
    } else if (
      event.eventType === 'ORDER_STATUS_CHANGED' &&
      event.aggregateType === 'Order'
    ) {
      await this.emitOrder(event);
    } else if (
      SELLER_ORDER_EVENTS.has(event.eventType) &&
      event.aggregateType === 'SellerOrder'
    ) {
      await this.emitSellerOrder(event);
    } else {
      return;
    }

    await this.markProcessed(event.eventId);
    this.logger.log({
      event: 'REALTIME_EVENT_EMITTED',
      eventId: event.eventId,
      eventType: event.eventType,
      correlationId: event.correlationId,
    });
  }

  private async emitProduct(event: DomainEventEnvelope): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: event.aggregateId },
      select: { id: true, stock: true, status: true, updatedAt: true },
    });
    if (!product) return;
    this.gateway.emitProduct(
      product.id,
      this.envelope(
        event,
        product.id,
        {
          stock: product.stock,
          available:
            product.status === ProductStatus.PUBLISHED && product.stock > 0,
          status: product.status,
          updatedAt: product.updatedAt.toISOString(),
        },
        product.updatedAt.toISOString(),
      ),
    );
  }

  private async emitAuction(event: DomainEventEnvelope): Promise<void> {
    const auction = await this.prisma.auction.findUnique({
      where: { id: event.aggregateId },
      select: {
        id: true,
        status: true,
        version: true,
        updatedAt: true,
        currentHighestBid: {
          select: { id: true, amount: true, createdAt: true },
        },
      },
    });
    if (!auction) return;
    this.gateway.emitAuction(
      auction.id,
      this.envelope(
        event,
        auction.id,
        {
          status: auction.status,
          highestBid: auction.currentHighestBid
            ? {
                id: auction.currentHighestBid.id,
                amount: auction.currentHighestBid.amount.toFixed(2),
                createdAt: auction.currentHighestBid.createdAt.toISOString(),
              }
            : null,
          updatedAt: auction.updatedAt.toISOString(),
        },
        auction.version,
      ),
    );
  }

  private async emitOrder(event: DomainEventEnvelope): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: event.aggregateId },
      select: { id: true, status: true, updatedAt: true },
    });
    if (!order) return;
    this.gateway.emitOrder(
      order.id,
      this.envelope(
        event,
        order.id,
        {
          status: order.status,
          updatedAt: order.updatedAt.toISOString(),
        },
        order.updatedAt.toISOString(),
      ),
    );
  }

  private async emitSellerOrder(event: DomainEventEnvelope): Promise<void> {
    const sellerOrder = await this.prisma.sellerOrder.findUnique({
      where: { id: event.aggregateId },
      select: { id: true, orderId: true, status: true, updatedAt: true },
    });
    if (!sellerOrder) return;
    this.gateway.emitSellerOrder(
      sellerOrder.id,
      sellerOrder.orderId,
      this.envelope(
        event,
        sellerOrder.id,
        {
          orderId: sellerOrder.orderId,
          status: sellerOrder.status,
          updatedAt: sellerOrder.updatedAt.toISOString(),
        },
        sellerOrder.updatedAt.toISOString(),
      ),
    );
  }

  private envelope(
    event: DomainEventEnvelope,
    entityId: string,
    payload: unknown,
    version: string | number,
  ) {
    return {
      eventId: event.eventId,
      type: event.eventType.toLowerCase().replaceAll('_', '.'),
      entityId,
      version,
      occurredAt: event.occurredAt,
      payload,
    };
  }

  private async isUnprocessed(eventId: string): Promise<boolean> {
    return !(await this.prisma.processedEvent.findUnique({
      where: { consumerName_eventId: { consumerName: CONSUMER_NAME, eventId } },
      select: { eventId: true },
    }));
  }

  private async markProcessed(eventId: string): Promise<void> {
    try {
      await this.prisma.processedEvent.create({
        data: { consumerName: CONSUMER_NAME, eventId },
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }
    }
  }
}
