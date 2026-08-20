import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { DEFAULT_JOB_OPTIONS, DOMAIN_EVENTS_QUEUE } from './queue.constants.js';
import { RedisConnectionService } from './redis-connection.service.js';

export interface DomainEventEnvelope {
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  occurredAt: string;
  correlationId: string;
  schemaVersion: number;
  payload: unknown;
}

@Injectable()
export class DomainEventsQueueService implements OnModuleDestroy {
  private readonly queue: Queue<DomainEventEnvelope>;
  private readonly redis: Redis;

  constructor(connection: RedisConnectionService) {
    this.redis = connection.createClient();
    this.queue = new Queue(DOMAIN_EVENTS_QUEUE, {
      connection: this.redis,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
  }

  async publish(event: DomainEventEnvelope): Promise<void> {
    await this.queue.add(event.eventType, event, { jobId: event.eventId });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    await this.redis.quit();
  }
}
