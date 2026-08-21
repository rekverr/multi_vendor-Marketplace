import { jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  LedgerDirection,
  Prisma,
  SellerOrderStatus,
} from '../generated/prisma/client.js';
import { SellerDashboardService } from './seller-dashboard.service.js';

describe('SellerDashboardService', () => {
  const prisma = {
    sellerProfile: { findFirst: jest.fn() },
    financialLedgerEntry: { groupBy: jest.fn() },
    sellerOrder: { groupBy: jest.fn(), findMany: jest.fn() },
    $queryRaw: jest.fn(),
  };
  let service: SellerDashboardService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.sellerProfile.findFirst.mockResolvedValue({
      id: 'seller-profile-id',
      displayName: 'Seller',
    });
    prisma.financialLedgerEntry.groupBy.mockResolvedValue([
      {
        currency: 'USD',
        direction: LedgerDirection.CREDIT,
        _sum: { amount: new Prisma.Decimal('90.00') },
      },
      {
        currency: 'USD',
        direction: LedgerDirection.DEBIT,
        _sum: { amount: new Prisma.Decimal('10.00') },
      },
    ]);
    prisma.sellerOrder.groupBy.mockResolvedValue([
      {
        currency: 'USD',
        status: SellerOrderStatus.COMPLETED,
        _count: { _all: 1 },
        _sum: {
          grossAmount: new Prisma.Decimal('100.00'),
          refundedGross: new Prisma.Decimal('20.00'),
          platformCommission: new Prisma.Decimal('10.00'),
          refundedCommission: new Prisma.Decimal('2.00'),
          sellerNet: new Prisma.Decimal('90.00'),
          refundedSellerNet: new Prisma.Decimal('18.00'),
        },
      },
      {
        currency: 'USD',
        status: SellerOrderStatus.CANCELLED,
        _count: { _all: 1 },
        _sum: {
          grossAmount: new Prisma.Decimal('50.00'),
          refundedGross: new Prisma.Decimal('50.00'),
          platformCommission: new Prisma.Decimal('5.00'),
          refundedCommission: new Prisma.Decimal('5.00'),
          sellerNet: new Prisma.Decimal('45.00'),
          refundedSellerNet: new Prisma.Decimal('45.00'),
        },
      },
    ]);
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.sellerOrder.findMany.mockResolvedValue([]);
    service = new SellerDashboardService(prisma as never);
  });

  it('scopes every dashboard query to the authenticated Seller', async () => {
    await service.get('seller-user-id', {
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-08-21T00:00:00.000Z',
    });

    expect(prisma.sellerProfile.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'seller-user-id',
        user: { role: 'SELLER' },
      },
      select: { id: true, displayName: true },
    });
    const ledgerQuery: unknown =
      prisma.financialLedgerEntry.groupBy.mock.calls[0]?.[0];
    const statusQuery: unknown = prisma.sellerOrder.groupBy.mock.calls[0]?.[0];
    const recentQuery: unknown = prisma.sellerOrder.findMany.mock.calls[0]?.[0];
    expect(ledgerQuery).toMatchObject({
      where: { sellerOrder: { sellerId: 'seller-profile-id' } },
    });
    expect(statusQuery).toMatchObject({
      where: { sellerId: 'seller-profile-id' },
    });
    expect(recentQuery).toMatchObject({
      where: { sellerId: 'seller-profile-id' },
    });
  });

  it('calculates recognized and refunded financials from snapshots', async () => {
    const result = await service.get('seller-user-id', {
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-08-21T00:00:00.000Z',
    });

    expect(result.financials).toEqual([
      expect.objectContaining({
        currency: 'USD',
        orderCount: 2,
        bookedGross: '150.00',
        refundedGross: '70.00',
        netGrossSales: '80.00',
        recognizedSellerRevenue: '80.00',
      }),
    ]);
    expect(result.orderStatusSummary).toEqual(
      expect.arrayContaining([
        {
          currency: 'USD',
          status: SellerOrderStatus.CANCELLED,
          count: 1,
        },
      ]),
    );
  });

  it('rejects invalid ranges before querying analytics', async () => {
    await expect(
      service.get('seller-user-id', {
        from: '2026-08-22T00:00:00.000Z',
        to: '2026-08-21T00:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.financialLedgerEntry.groupBy).not.toHaveBeenCalled();
  });

  it('rejects a missing or unapproved Seller profile', async () => {
    prisma.sellerProfile.findFirst.mockResolvedValue(null);

    await expect(service.get('other-user', {})).rejects.toThrow(
      NotFoundException,
    );
  });
});
