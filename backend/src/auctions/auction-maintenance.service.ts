import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { AuctionStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { AuctionCommandsService } from './auction-commands.service.js';

@Injectable()
export class AuctionMaintenanceService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(AuctionMaintenanceService.name);
  private readonly enabled: boolean;
  private readonly intervalMs: number;
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly commands: AuctionCommandsService,
    config: ConfigService,
  ) {
    this.enabled = config.get<boolean>('AUCTION_MAINTENANCE_ENABLED', true);
    this.intervalMs = config.get<number>(
      'AUCTION_MAINTENANCE_INTERVAL_MS',
      5000,
    );
  }

  onApplicationBootstrap(): void {
    if (!this.enabled) return;
    void this.runOnce();
    this.timer = setInterval(() => void this.runOnce(), this.intervalMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const [expiredAuctions, expiredWindows] = await Promise.all([
        this.prisma.auction.findMany({
          where: {
            status: { in: [AuctionStatus.SCHEDULED, AuctionStatus.ACTIVE] },
            endsAt: { lte: new Date() },
          },
          select: { id: true },
          orderBy: [{ endsAt: 'asc' }, { id: 'asc' }],
          take: 25,
        }),
        this.prisma.auction.findMany({
          where: {
            status: AuctionStatus.SOLD,
            winnerCheckoutExpiresAt: { lte: new Date() },
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
          promise: this.commands.finalize(auction.id, randomUUID()),
        })),
        ...expiredWindows.map((auction) => ({
          auctionId: auction.id,
          operation: 'expire-winner-window',
          promise: this.commands.expireWinnerWindow(auction.id, randomUUID()),
        })),
      ];
      const results = await Promise.allSettled(
        operations.map((operation) => operation.promise),
      );
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          this.logger.error({
            event: 'AUCTION_MAINTENANCE_OPERATION_FAILED',
            auctionId: operations[index].auctionId,
            operation: operations[index].operation,
            error:
              result.reason instanceof Error
                ? result.reason.message
                : 'Unknown error',
          });
        }
      });
    } catch (error) {
      this.logger.error({
        event: 'AUCTION_MAINTENANCE_FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      this.running = false;
    }
  }
}
