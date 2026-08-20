import { ConfigService } from '@nestjs/config';
import { jest } from '@jest/globals';
import type { OutboxEvent } from '../generated/prisma/client.js';
import { OutboxPublisherService } from './outbox-publisher.service.js';

const EVENT_ID = '00000000-0000-4000-8000-000000000010';

describe('OutboxPublisherService', () => {
  it('marks an event published only after queue publication succeeds', async () => {
    const event = outboxEvent();
    const { publisher, prisma, queue } = setup([event]);

    await expect(publisher.publishPending()).resolves.toBe(1);

    expect(queue.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: EVENT_ID,
        correlationId: event.correlationId,
        payload: event.payload,
      }),
    );
    expect(queue.publish.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.outboxEvent.updateMany.mock.invocationCallOrder[0],
    );
    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ publishedAt: expect.any(Date) }),
      }),
    );
  });

  it('keeps a failed event unpublished and schedules a retry', async () => {
    const event = outboxEvent();
    const { publisher, prisma, queue, metrics } = setup([event]);
    queue.publish.mockRejectedValueOnce(new Error('Redis unavailable'));

    await expect(publisher.publishPending()).resolves.toBe(1);

    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastError: 'Redis unavailable',
          nextAttemptAt: expect.any(Date),
          lockedBy: null,
        }),
      }),
    );
    expect(
      prisma.outboxEvent.updateMany.mock.calls[0][0].data,
    ).not.toHaveProperty('publishedAt');
    expect(metrics.recordOutboxPublishFailure).toHaveBeenCalledTimes(1);
  });

  it('continues publishing unrelated events after one event fails', async () => {
    const poison = outboxEvent();
    const valid = outboxEvent({
      id: '00000000-0000-4000-8000-000000000011',
      eventId: '00000000-0000-4000-8000-000000000012',
    });
    const { publisher, prisma, queue } = setup([poison, valid]);
    queue.publish.mockRejectedValueOnce(new Error('Poison event'));

    await publisher.publishPending();

    expect(queue.publish).toHaveBeenCalledTimes(2);
    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledTimes(2);
    expect(
      prisma.outboxEvent.updateMany.mock.calls[1][0].data.publishedAt,
    ).toEqual(expect.any(Date));
  });
});

function setup(events: OutboxEvent[]) {
  const prisma = {
    $queryRaw: jest.fn().mockResolvedValue(events),
    outboxEvent: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(events.length),
    },
  };
  const queue = { publish: jest.fn().mockResolvedValue(undefined) };
  const metrics = {
    recordOutboxPublishFailure: jest.fn(),
    setOutboxBacklog: jest.fn(),
  };
  const config = new ConfigService({
    OUTBOX_POLL_INTERVAL_MS: 1000,
    OUTBOX_BATCH_SIZE: 25,
    OUTBOX_LEASE_MS: 30000,
    OUTBOX_PUBLISHER_ENABLED: false,
  });

  return {
    prisma,
    queue,
    metrics,
    publisher: new OutboxPublisherService(
      prisma as never,
      queue as never,
      metrics as never,
      config,
    ),
  };
}

function outboxEvent(overrides: Partial<OutboxEvent> = {}): OutboxEvent {
  const now = new Date('2026-08-20T12:00:00.000Z');
  return {
    id: '00000000-0000-4000-8000-000000000009',
    eventId: EVENT_ID,
    eventType: 'TEST_CREATED',
    aggregateType: 'Test',
    aggregateId: '00000000-0000-4000-8000-000000000008',
    occurredAt: now,
    correlationId: '00000000-0000-4000-8000-000000000007',
    schemaVersion: 1,
    payload: { value: 'safe' },
    publishedAt: null,
    attemptCount: 0,
    lastError: null,
    nextAttemptAt: now,
    lockedAt: now,
    lockedUntil: new Date(now.getTime() + 30000),
    lockedBy: 'publisher',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
