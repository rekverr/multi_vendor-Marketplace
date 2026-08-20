import { Global, Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { MeilisearchService } from './meilisearch.service.js';
import { ProductEventsService } from './product-events.service.js';
import { ProductReindexService } from './product-reindex.service.js';
import { ProductSearchConsumerService } from './product-search-consumer.service.js';

@Global()
@Module({
  imports: [QueueModule, CacheModule],
  providers: [
    MeilisearchService,
    ProductEventsService,
    ProductSearchConsumerService,
    ProductReindexService,
  ],
  exports: [MeilisearchService, ProductEventsService, ProductReindexService],
})
export class SearchModule {}
