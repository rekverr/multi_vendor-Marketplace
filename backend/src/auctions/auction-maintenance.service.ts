import { Injectable, Logger } from '@nestjs/common';
import { safeErrorMessage, structuredLog } from '../common/structured-log.js';
import { PrismaService } from '../database/prisma.service.js';
import { AuctionStatus } from '../generated/prisma/client.js';
import { AuctionCommandsService } from './auction-commands.service.js';

@Injectable()
export class AuctionMaintenanceService {
  private readonly logger = new Logger(AuctionMaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly commands: AuctionCommandsService,
  ) {}

  async runOnce(correlationId: string): Promise<void> {
    const now = new Date();
    const [expiredAuctions, expiredWindows] = await Promise.all([
      this.prisma.auction.findMany({
        where: {
          status: { in: [AuctionStatus.SCHEDULED, AuctionStatus.ACTIVE] },
          endsAt: { lte: now },
        },
        select: { id: true },
        orderBy: [{ endsAt: 'asc' }, { id: 'asc' }],
        take: 25,
      }),
      this.prisma.auction.findMany({
        where: {
          status: AuctionStatus.SOLD,
          winnerCheckoutExpiresAt: { lte: now },
        },
        select: { id: true },
        orderBy: [{ winnerCheckoutExpiresAt: 'asc' }, { id: 'asc' }],
        take: 25,
      }),
    ]);
    const operations = [
      ...expiredAuctions.map((auction) => ({
        auctionId: auction.id,
        operation: 'finalize',
        promise: this.commands.finalize(auction.id, correlationId),
      })),
      ...expiredWindows.map((auction) => ({
        auctionId: auction.id,
        operation: 'expire-winner-window',
        promise: this.commands.expireWinnerWindow(auction.id, correlationId),
      })),
    ];
    const results = await Promise.allSettled(
      operations.map((operation) => operation.promise),
    );
    const failures = results.flatMap((result, index) => {
      if (result.status === 'fulfilled') return [];
      const operation = operations[index];
      this.logger.error(
        structuredLog('AUCTION_MAINTENANCE_OPERATION_FAILED', {
          auctionId: operation.auctionId,
          operation: operation.operation,
          correlationId,
          error: safeErrorMessage(result.reason),
        }),
      );
      return [operation.auctionId];
    });
    if (failures.length > 0) {
      throw new Error(
        `${failures.length} Auction maintenance operation(s) failed`,
      );
    }
  }
}
