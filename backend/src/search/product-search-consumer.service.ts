import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import type { Job } from 'bullmq';
import { CatalogCacheService } from '../cache/catalog-cache.service.js';
import { Prisma, ProductStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { DomainEventEnvelope } from '../queue/domain-events-queue.service.js';
import { DOMAIN_EVENTS_QUEUE } from '../queue/queue.constants.js';
import { QueueWorkerFactory } from '../queue/queue-worker.factory.js';
import {
  PRODUCT_ARCHIVED,
  PRODUCT_CREATED,
  PRODUCT_PUBLISHED,
  PRODUCT_UNPUBLISHED,
  PRODUCT_UPDATED,
} from './product-events.service.js';
import {
  mapProductToSearchDocument,
  searchProductSelect,
} from './product-search.mapper.js';
import { MeilisearchService } from './meilisearch.service.js';

const CONSUMER_NAME = 'product-search-sync-v1';
const PRODUCT_EVENTS = new Set([
  PRODUCT_CREATED,
  PRODUCT_UPDATED,
  PRODUCT_PUBLISHED,
  PRODUCT_UNPUBLISHED,
  PRODUCT_ARCHIVED,
]);

@Injectable()
export class ProductSearchConsumerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProductSearchConsumerService.name);

  constructor(
    private readonly workers: QueueWorkerFactory,
    private readonly prisma: PrismaService,
    private readonly search: MeilisearchService,
    private readonly cache: CatalogCacheService,
  ) {}

  onApplicationBootstrap(): void {
    this.workers.create<DomainEventEnvelope>(
      DOMAIN_EVENTS_QUEUE,
      (job) => this.process(job),
      5,
    );
  }

  async process(job: Job<DomainEventEnvelope>): Promise<void> {
    const event = job.data;
    if (
      event.aggregateType !== 'Product' ||
      !PRODUCT_EVENTS.has(event.eventType)
    ) {
      return;
    }

    const receipt = await this.prisma.processedEvent.findUnique({
      where: {
        consumerName_eventId: {
          consumerName: CONSUMER_NAME,
          eventId: event.eventId,
        },
      },
    });
    if (receipt) return;

    const product = await this.prisma.product.findUnique({
      where: { id: event.aggregateId },
      select: { status: true, ...searchProductSelect },
    });

    if (product?.status === ProductStatus.PUBLISHED) {
      await this.search.upsertProduct(mapProductToSearchDocument(product));
    } else {
      await this.search.deleteProduct(event.aggregateId);
    }

    await this.cache.invalidateProduct(event.aggregateId);
    try {
      await this.prisma.processedEvent.create({
        data: { consumerName: CONSUMER_NAME, eventId: event.eventId },
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }
    }

    this.logger.log({
      event: 'PRODUCT_SEARCH_SYNCED',
      eventId: event.eventId,
      productId: event.aggregateId,
      correlationId: event.correlationId,
    });
  }
}
