import { Global, Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module.js';
import { CatalogCacheService } from './catalog-cache.service.js';

@Global()
@Module({
  imports: [QueueModule],
  providers: [CatalogCacheService],
  exports: [CatalogCacheService],
})
export class CacheModule {}
