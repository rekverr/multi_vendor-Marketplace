import { jest } from '@jest/globals';
import { Prisma } from '../generated/prisma/client.js';
import { OutboxService } from './outbox.service.js';

describe('OutboxService', () => {
  it('creates an OutboxEvent through the supplied transaction', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'outbox-id' });
    const service = new OutboxService({} as never);
    const tx = { outboxEvent: { create } } as never;

    await service.create(tx, {
      eventType: 'TEST_CREATED',
      aggregateType: 'Test',
      aggregateId: '00000000-0000-4000-8000-000000000001',
      correlationId: '00000000-0000-4000-8000-000000000002',
      payload: { value: 'safe' },
    });

    const createQuery: unknown = create.mock.calls[0]?.[0];
    expect(createQuery).toMatchObject({
      data: {
        eventType: 'TEST_CREATED',
        schemaVersion: 1,
        payload: { value: 'safe' },
      },
    });
  });

  it('runs a consumer effect once in the same transaction as its receipt', async () => {
    const receiptCreate = jest.fn().mockResolvedValue({});
    const tx = { processedEvent: { create: receiptCreate } };
    const prisma = {
      $transaction: jest.fn(
        (callback: (client: typeof tx) => unknown): Promise<unknown> =>
          Promise.resolve(callback(tx)),
      ),
    };
    const handler = jest.fn().mockResolvedValue('applied');
    const service = new OutboxService(prisma as never);

    await expect(
      service.processOnce(
        'test-consumer',
        '00000000-0000-4000-8000-000000000003',
        handler,
      ),
    ).resolves.toEqual({ processed: true, result: 'applied' });
    expect(receiptCreate.mock.invocationCallOrder[0]).toBeLessThan(
      handler.mock.invocationCallOrder[0],
    );
  });

  it('does not execute a duplicate consumer effect', async () => {
    const duplicate = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: '7.9.1',
      meta: {
        modelName: 'ProcessedEvent',
        target: ['consumerName', 'eventId'],
      },
    });
    const prisma = {
      $transaction: jest.fn().mockRejectedValue(duplicate),
    };
    const handler = jest.fn();
    const service = new OutboxService(prisma as never);

    await expect(
      service.processOnce(
        'test-consumer',
        '00000000-0000-4000-8000-000000000003',
        handler,
      ),
    ).resolves.toEqual({ processed: false });
    expect(handler).not.toHaveBeenCalled();
  });
});
