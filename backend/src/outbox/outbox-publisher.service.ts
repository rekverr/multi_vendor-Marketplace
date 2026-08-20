import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { OutboxEvent, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { MetricsService } from '../metrics/metrics.service.js';
import { DomainEventsQueueService } from '../queue/domain-events-queue.service.js';

@Injectable()
export class OutboxPublisherService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(OutboxPublisherService.name);
  private readonly publisherId = randomUUID();
  private readonly pollIntervalMs: number;
  private readonly batchSize: number;
  private readonly leaseMs: number;
  private readonly enabled: boolean;
  private timer?: NodeJS.Timeout;
  private polling = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: DomainEventsQueueService,
    private readonly metrics: MetricsService,
    config: ConfigService,
  ) {
    this.pollIntervalMs = config.get<number>('OUTBOX_POLL_INTERVAL_MS', 1000);
    this.batchSize = config.get<number>('OUTBOX_BATCH_SIZE', 25);
    this.leaseMs = config.get<number>('OUTBOX_LEASE_MS', 30000);
    this.enabled = config.get<boolean>('OUTBOX_PUBLISHER_ENABLED', true);
  }

  onApplicationBootstrap(): void {
    if (!this.enabled) return;

    void this.poll();
    this.timer = setInterval(() => void this.poll(), this.pollIntervalMs);
    this.timer.unref();
  }

  async publishPending(): Promise<number> {
    const events = await this.claimBatch();
    await Promise.allSettled(events.map((event) => this.publishOne(event)));
    await this.updateBacklogMetric();
    return events.length;
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async poll(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      await this.publishPending();
    } catch (error) {
      this.logger.error({
        event: 'OUTBOX_PUBLISHER_POLL_FAILED',
        error: this.errorMessage(error),
      });
    } finally {
      this.polling = false;
    }
  }

  private claimBatch(): Promise<OutboxEvent[]> {
    return this.prisma.$queryRaw<OutboxEvent[]>(Prisma.sql`
      WITH candidates AS (
        SELECT id
        FROM "OutboxEvent"
        WHERE "publishedAt" IS NULL
          AND "nextAttemptAt" <= NOW()
          AND ("lockedUntil" IS NULL OR "lockedUntil" < NOW())
        ORDER BY "occurredAt" ASC, id ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${this.batchSize}
      )
      UPDATE "OutboxEvent" AS event
      SET "lockedAt" = NOW(),
          "lockedUntil" = NOW() + (${this.leaseMs} * INTERVAL '1 millisecond'),
          "lockedBy" = ${this.publisherId},
          "updatedAt" = NOW()
      FROM candidates
      WHERE event.id = candidates.id
      RETURNING event.*
    `);
  }

  private async publishOne(event: OutboxEvent): Promise<void> {
    try {
      await this.queue.publish({
        eventId: event.eventId,
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        occurredAt: event.occurredAt.toISOString(),
        correlationId: event.correlationId,
        schemaVersion: event.schemaVersion,
        payload: event.payload,
      });

      await this.prisma.outboxEvent.updateMany({
        where: {
          id: event.id,
          publishedAt: null,
          lockedBy: this.publisherId,
        },
        data: {
          publishedAt: new Date(),
          attemptCount: { increment: 1 },
          lastError: null,
          lockedAt: null,
          lockedUntil: null,
          lockedBy: null,
        },
      });
    } catch (error) {
      const attempt = event.attemptCount + 1;
      const delayMs = Math.min(300000, 1000 * 2 ** Math.min(attempt - 1, 8));
      const message = this.errorMessage(error).slice(0, 2000);

      await this.prisma.outboxEvent.updateMany({
        where: {
          id: event.id,
          publishedAt: null,
          lockedBy: this.publisherId,
        },
        data: {
          attemptCount: { increment: 1 },
          lastError: message,
          nextAttemptAt: new Date(Date.now() + delayMs),
          lockedAt: null,
          lockedUntil: null,
          lockedBy: null,
        },
      });
      this.metrics.recordOutboxPublishFailure();
      this.logger.error({
        event: 'OUTBOX_PUBLISH_FAILED',
        eventId: event.eventId,
        eventType: event.eventType,
        correlationId: event.correlationId,
        attempt,
        error: message,
      });
    }
  }

  private async updateBacklogMetric(): Promise<void> {
    const count = await this.prisma.outboxEvent.count({
      where: { publishedAt: null },
    });
    this.metrics.setOutboxBacklog(count);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
  }
}
