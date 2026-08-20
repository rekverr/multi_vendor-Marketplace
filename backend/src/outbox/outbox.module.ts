import { Global, Module } from '@nestjs/common';
import { MetricsModule } from '../metrics/metrics.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { OutboxPublisherService } from './outbox-publisher.service.js';
import { OutboxService } from './outbox.service.js';

@Global()
@Module({
  imports: [QueueModule, MetricsModule],
  providers: [OutboxService, OutboxPublisherService],
  exports: [OutboxService],
})
export class OutboxModule {}
