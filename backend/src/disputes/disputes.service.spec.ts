import { jest } from '@jest/globals';
import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  DisputeStatus,
  SellerOrderStatus,
} from '../generated/prisma/client.js';
import { DisputesService } from './disputes.service.js';

const customerId = '11111111-1111-4111-8111-111111111111';
const orderId = '22222222-2222-4222-8222-222222222222';
const sellerOrderId = '33333333-3333-4333-8333-333333333333';
const disputeId = '44444444-4444-4444-8444-444444444444';
const correlationId = '55555555-5555-4555-8555-555555555555';

describe('DisputesService', () => {
  const tx = {
    $queryRaw: jest.fn(),
    orderItem: { findFirst: jest.fn() },
    dispute: { create: jest.fn(), update: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((value: unknown) =>
      typeof value === 'function'
        ? (value as (client: typeof tx) => unknown)(tx)
        : Promise.all(value as Promise<unknown>[]),
    ),
    dispute: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn(),
    },
  };
  const outbox = { create: jest.fn().mockResolvedValue({}) };
  let service: DisputesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DisputesService(prisma as never, outbox as never);
  });

  it('opens a dispute only through the owned eligible SellerOrder', async () => {
    tx.$queryRaw.mockResolvedValue([
      { id: sellerOrderId, status: SellerOrderStatus.COMPLETED },
    ]);
    tx.dispute.create.mockResolvedValue({
      id: disputeId,
      orderId,
      sellerOrderId,
      orderItemId: null,
      status: DisputeStatus.OPEN,
    });

    const result = await service.create(
      customerId,
      orderId,
      { sellerOrderId, reason: 'The delivered item was damaged.' },
      correlationId,
    );

    expect(result.id).toBe(disputeId);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    const createQuery: unknown = tx.dispute.create.mock.calls[0]?.[0];
    expect(createQuery).toMatchObject({
      data: { customerId, orderId, sellerOrderId },
    });
    expect(outbox.create).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ eventType: 'DISPUTE_OPENED' }),
    );
  });

  it('rejects another Customer Order without revealing it', async () => {
    tx.$queryRaw.mockResolvedValue([]);

    await expect(
      service.create(
        customerId,
        orderId,
        { sellerOrderId, reason: 'The delivered item was damaged.' },
        correlationId,
      ),
    ).rejects.toThrow(NotFoundException);
    expect(tx.dispute.create).not.toHaveBeenCalled();
  });

  it('scopes Seller listing to the authenticated Seller profile', async () => {
    await service.listSeller('seller-user-id', {
      page: 1,
      pageSize: 20,
    });

    const listQuery: unknown = prisma.dispute.findMany.mock.calls[0]?.[0];
    expect(listQuery).toMatchObject({
      where: {
        sellerOrder: {
          seller: {
            userId: 'seller-user-id',
            user: { role: 'SELLER' },
          },
        },
      },
    });
  });

  it('allows a valid Admin transition and writes an Outbox event', async () => {
    tx.$queryRaw.mockResolvedValue([{ status: DisputeStatus.OPEN }]);
    tx.dispute.update.mockResolvedValue({
      id: disputeId,
      orderId,
      sellerOrderId,
      status: DisputeStatus.UNDER_REVIEW,
    });

    const result = await service.transition(
      'admin-id',
      disputeId,
      { status: DisputeStatus.UNDER_REVIEW },
      correlationId,
    );

    expect(result.status).toBe(DisputeStatus.UNDER_REVIEW);
    expect(outbox.create).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ eventType: 'DISPUTE_STATUS_CHANGED' }),
    );
  });

  it('rejects an invalid dispute transition', async () => {
    tx.$queryRaw.mockResolvedValue([{ status: DisputeStatus.OPEN }]);

    await expect(
      service.transition(
        'admin-id',
        disputeId,
        { status: DisputeStatus.CLOSED },
        correlationId,
      ),
    ).rejects.toThrow(ConflictException);
    expect(tx.dispute.update).not.toHaveBeenCalled();
  });
});
