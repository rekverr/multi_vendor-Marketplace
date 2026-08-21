import type { Job } from 'bullmq';
import { jest } from '@jest/globals';
import { ProductStatus } from '../generated/prisma/client.js';
import type { DomainEventEnvelope } from '../queue/domain-events-queue.service.js';
import { RealtimeEventsConsumer } from './realtime-events.consumer.js';

const event: DomainEventEnvelope = {
  eventId: '11111111-1111-4111-8111-111111111111',
  eventType: 'PRODUCT_UPDATED',
  aggregateType: 'Product',
  aggregateId: '22222222-2222-4222-8222-222222222222',
  occurredAt: '2026-08-21T10:00:00.000Z',
  correlationId: '33333333-3333-4333-8333-333333333333',
  schemaVersion: 1,
  payload: { stock: 999 },
};

describe('RealtimeEventsConsumer', () => {
  const workers = { create: jest.fn() };
  const prisma = {
    processedEvent: { findUnique: jest.fn(), create: jest.fn() },
    product: { findUnique: jest.fn() },
    auction: { findUnique: jest.fn() },
    order: { findUnique: jest.fn() },
    sellerOrder: { findUnique: jest.fn() },
  };
  const gateway = {
    emitProduct: jest.fn(),
    emitAuction: jest.fn(),
    emitOrder: jest.fn(),
    emitSellerOrder: jest.fn(),
  };
  let consumer: RealtimeEventsConsumer;

  beforeEach(() => {
    jest.clearAllMocks();
    consumer = new RealtimeEventsConsumer(
      workers as never,
      prisma as never,
      gateway as never,
    );
  });

  it('emits authoritative Product stock instead of event payload stock', async () => {
    prisma.processedEvent.findUnique.mockResolvedValue(null);
    prisma.processedEvent.create.mockResolvedValue({});
    prisma.product.findUnique.mockResolvedValue({
      id: event.aggregateId,
      stock: 2,
      status: ProductStatus.PUBLISHED,
      updatedAt: new Date('2026-08-21T10:01:00.000Z'),
    });

    await consumer.process({ data: event } as Job<DomainEventEnvelope>);

    expect(gateway.emitProduct).toHaveBeenCalledWith(
      event.aggregateId,
      expect.objectContaining({
        eventId: event.eventId,
        payload: expect.objectContaining({ stock: 2, available: true }),
      }),
    );
    expect(prisma.processedEvent.create).toHaveBeenCalled();
  });

  it('does not emit a duplicate already processed event', async () => {
    prisma.processedEvent.findUnique.mockResolvedValue({
      eventId: event.eventId,
    });

    await consumer.process({ data: event } as Job<DomainEventEnvelope>);

    expect(prisma.product.findUnique).not.toHaveBeenCalled();
    expect(gateway.emitProduct).not.toHaveBeenCalled();
  });
});
