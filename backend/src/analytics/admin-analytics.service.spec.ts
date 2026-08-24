import { jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import {
  CheckoutAttemptStatus,
  LedgerAccount,
  LedgerDirection,
  Prisma,
} from '../generated/prisma/client.js';
import { AdminAnalyticsService } from './admin-analytics.service.js';

describe('AdminAnalyticsService', () => {
  const prisma = {
    $queryRaw: jest.fn(),
    financialLedgerEntry: { groupBy: jest.fn() },
    order: { groupBy: jest.fn() },
    orderItem: { findMany: jest.fn() },
    checkoutAttempt: { groupBy: jest.fn() },
  };
  let service: AdminAnalyticsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminAnalyticsService(prisma as never);
  });

  it('calculates net sales and ledger revenue after reversals', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          currency: 'USD',
          orderCount: 2n,
          bookedGross: new Prisma.Decimal('150.00'),
          refundedGross: new Prisma.Decimal('30.00'),
          netGross: new Prisma.Decimal('120.00'),
        },
      ])
      .mockResolvedValueOnce([
        {
          currency: 'USD',
          orderCount: 1n,
          bookedGross: new Prisma.Decimal('50.00'),
          refundedGross: new Prisma.Decimal('0.00'),
          netGross: new Prisma.Decimal('50.00'),
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    prisma.financialLedgerEntry.groupBy.mockResolvedValue([
      ledger(LedgerAccount.PLATFORM, LedgerDirection.CREDIT, '15.00'),
      ledger(LedgerAccount.PLATFORM, LedgerDirection.DEBIT, '3.00'),
      ledger(LedgerAccount.SELLER, LedgerDirection.CREDIT, '135.00'),
      ledger(LedgerAccount.SELLER, LedgerDirection.DEBIT, '27.00'),
    ]);
    prisma.order.groupBy.mockResolvedValue([]);
    prisma.checkoutAttempt.groupBy.mockResolvedValue([
      {
        status: CheckoutAttemptStatus.SUCCEEDED,
        _count: { _all: 3 },
      },
      { status: CheckoutAttemptStatus.FAILED, _count: { _all: 1 } },
    ]);

    const result = await service.get({
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-08-21T00:00:00.000Z',
    });

    expect(result.financials).toEqual([
      expect.objectContaining({
        currency: 'USD',
        orderCount: 2,
        totalRevenue: '120.00',
        platformRevenue: '12.00',
        sellerRevenue: '108.00',
      }),
    ]);
    expect(result.previousPeriod.sales).toEqual([
      { currency: 'USD', orderCount: 1, netGross: '50.00' },
    ]);
    expect(result.periodComparison).toEqual([
      {
        currency: 'USD',
        currentNetGross: '120.00',
        previousNetGross: '50.00',
        delta: '70.00',
        percentChange: '140.00',
      },
    ]);
    expect(new Date(result.previousPeriod.range.to).getTime()).toBe(
      new Date(result.range.from).getTime() - 1,
    );
    expect(result.conversion).toEqual({
      available: true,
      successfulAttempts: 3,
      failedAttempts: 1,
      processingAttempts: 0,
      totalAttempts: 4,
      ratePercent: '75.00',
    });
  });

  it('rejects reversed and excessive date ranges', async () => {
    await expect(
      service.get({
        from: '2026-08-22T00:00:00.000Z',
        to: '2026-08-21T00:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.get({
        from: '2024-01-01T00:00:00.000Z',
        to: '2026-08-21T00:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('streams stable CSV headers and correctly escaped snapshots', async () => {
    prisma.orderItem.findMany
      .mockResolvedValueOnce([
        {
          id: 'item-id',
          productId: 'product-id',
          productTitle: 'Widget, "Pro"\nEdition',
          sellerIdSnapshot: 'seller-id',
          sellerNameSnapshot: 'Store, Inc.',
          unitPrice: new Prisma.Decimal('10.00'),
          quantity: 2,
          lineTotal: new Prisma.Decimal('20.00'),
          cancelledQuantity: 0,
          refundedQuantity: 1,
          refundedAmount: new Prisma.Decimal('10.00'),
          sellerOrder: {
            id: 'seller-order-id',
            status: 'COMPLETED',
            currency: 'USD',
            order: {
              id: 'order-id',
              createdAt: new Date('2026-08-10T12:00:00.000Z'),
            },
          },
        },
      ])
      .mockResolvedValueOnce([]);

    const output = service.createSalesCsv({
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-08-21T00:00:00.000Z',
    });
    let csv = '';
    for await (const chunk of output.stream) {
      csv += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
    }

    expect(csv.startsWith('orderId,sellerOrderId,orderCreatedAt')).toBe(true);
    expect(csv).toContain('"Store, Inc."');
    expect(csv).toContain('"Widget, ""Pro""\nEdition"');
    expect(csv).toContain(',1,10.00,USD\r\n');
    expect(prisma.orderItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 500, orderBy: { id: 'asc' } }),
    );
  });
});

function ledger(
  account: LedgerAccount,
  direction: LedgerDirection,
  amount: string,
) {
  return {
    account,
    direction,
    currency: 'USD',
    _sum: { amount: new Prisma.Decimal(amount) },
  };
}
