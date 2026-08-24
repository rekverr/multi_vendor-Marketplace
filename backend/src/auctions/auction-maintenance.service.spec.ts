import { jest } from '@jest/globals';
import { AuctionStatus } from '../generated/prisma/client.js';
import { AuctionMaintenanceService } from './auction-maintenance.service.js';

describe('AuctionMaintenanceService', () => {
  const prisma = { auction: { findMany: jest.fn() } };
  const commands = {
    finalize: jest.fn(),
    expireWinnerWindow: jest.fn(),
  };
  const correlationId = '00000000-0000-4000-8000-000000000001';
  let service: AuctionMaintenanceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuctionMaintenanceService(prisma as never, commands as never);
  });

  it('processes expired Auctions and winner windows with one correlation ID', async () => {
    prisma.auction.findMany
      .mockResolvedValueOnce([{ id: 'auction-1' }])
      .mockResolvedValueOnce([{ id: 'auction-2' }]);
    commands.finalize.mockResolvedValue({});
    commands.expireWinnerWindow.mockResolvedValue({});

    await service.runOnce(correlationId);

    expect(commands.finalize).toHaveBeenCalledWith('auction-1', correlationId);
    expect(commands.expireWinnerWindow).toHaveBeenCalledWith(
      'auction-2',
      correlationId,
    );
    const firstQuery: unknown = prisma.auction.findMany.mock.calls[0]?.[0];
    expect(firstQuery).toMatchObject({
      where: {
        status: { in: [AuctionStatus.SCHEDULED, AuctionStatus.ACTIVE] },
      },
      take: 25,
    });
  });

  it('finishes unrelated operations and fails the batch for BullMQ retry', async () => {
    prisma.auction.findMany
      .mockResolvedValueOnce([{ id: 'poison-auction' }])
      .mockResolvedValueOnce([{ id: 'healthy-auction' }]);
    commands.finalize.mockRejectedValue(new Error('finalization failed'));
    commands.expireWinnerWindow.mockResolvedValue({});

    await expect(service.runOnce(correlationId)).rejects.toThrow(
      '1 Auction maintenance operation(s) failed',
    );
    expect(commands.expireWinnerWindow).toHaveBeenCalledWith(
      'healthy-auction',
      correlationId,
    );
  });
});
