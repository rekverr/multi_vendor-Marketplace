import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { OutboxService } from '../outbox/outbox.service.js';

export const PRODUCT_CREATED = 'PRODUCT_CREATED';
export const PRODUCT_UPDATED = 'PRODUCT_UPDATED';
export const PRODUCT_PUBLISHED = 'PRODUCT_PUBLISHED';
export const PRODUCT_REJECTED = 'PRODUCT_REJECTED';
export const PRODUCT_UNPUBLISHED = 'PRODUCT_UNPUBLISHED';
export const PRODUCT_ARCHIVED = 'PRODUCT_ARCHIVED';

@Injectable()
export class ProductEventsService {
  constructor(private readonly outbox: OutboxService) {}

  emit(
    tx: Prisma.TransactionClient,
    eventType: string,
    productId: string,
    correlationId: string,
    updatedAt: Date,
  ) {
    return this.outbox.create(tx, {
      eventType,
      aggregateType: 'Product',
      aggregateId: productId,
      correlationId,
      payload: { productId, updatedAt: updatedAt.toISOString() },
    });
  }
}
