import {
  Injectable,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import {
  AUCTION_MAINTENANCE_JOB,
  AUCTION_MAINTENANCE_QUEUE,
  AUCTION_MAINTENANCE_SCHEDULER,
  DEFAULT_JOB_OPTIONS,
} from '../queue/queue.constants.js';
import { QueueWorkerFactory } from '../queue/queue-worker.factory.js';
import { RedisConnectionService } from '../queue/redis-connection.service.js';
import { AuctionMaintenanceService } from './auction-maintenance.service.js';

interface AuctionMaintenanceJobData {
  correlationId?: string;
}

@Injectable()
export class AuctionMaintenanceQueueService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly enabled: boolean;
  private readonly intervalMs: number;
  private queue?: Queue<AuctionMaintenanceJobData>;
  private redis?: Redis;

  constructor(
    private readonly connection: RedisConnectionService,
    private readonly workers: QueueWorkerFactory,
    private readonly maintenance: AuctionMaintenanceService,
    config: ConfigService,
  ) {
    this.enabled = config.get<boolean>('AUCTION_MAINTENANCE_ENABLED', true);
    this.intervalMs = config.get<number>(
      'AUCTION_MAINTENANCE_INTERVAL_MS',
      5000,
    );
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.enabled) return;

    this.redis = this.connection.createClient();
    this.queue = new Queue<AuctionMaintenanceJobData>(
      AUCTION_MAINTENANCE_QUEUE,
      {
        connection: this.redis,
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      },
    );
    this.workers.create<AuctionMaintenanceJobData>(
      AUCTION_MAINTENANCE_QUEUE,
      (job) => this.process(job),
      1,
    );
    await this.queue.upsertJobScheduler(
      AUCTION_MAINTENANCE_SCHEDULER,
      { every: this.intervalMs },
      {
        name: AUCTION_MAINTENANCE_JOB,
        data: {},
        opts: DEFAULT_JOB_OPTIONS,
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
    await this.redis?.quit();
  }

  private async process(job: Job<AuctionMaintenanceJobData>): Promise<void> {
    if (job.name !== AUCTION_MAINTENANCE_JOB) {
      throw new Error(`Unsupported Auction maintenance job: ${job.name}`);
    }
    const correlationId = randomUUID();
    await job.updateData({ correlationId });
    await this.maintenance.runOnce(correlationId);
  }
}
