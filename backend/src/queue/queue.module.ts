import { Global, Module } from '@nestjs/common';
import { MetricsModule } from '../metrics/metrics.module.js';
import { DomainEventsQueueService } from './domain-events-queue.service.js';
import { QueueWorkerFactory } from './queue-worker.factory.js';
import { RedisConnectionService } from './redis-connection.service.js';

@Global()
@Module({
  imports: [MetricsModule],
  providers: [
    RedisConnectionService,
    DomainEventsQueueService,
    QueueWorkerFactory,
  ],
  exports: [
    RedisConnectionService,
    DomainEventsQueueService,
    QueueWorkerFactory,
  ],
})
export class QueueModule {}
