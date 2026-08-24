import { jest } from '@jest/globals';
import {
  ProductStatus,
  ProductType,
  Prisma,
} from '../generated/prisma/client.js';
import { PRODUCT_REJECTED, PRODUCT_UPDATED } from './product-events.service.js';
import { ProductSearchConsumerService } from './product-search-consumer.service.js';

describe('ProductSearchConsumerService', () => {
  it('does not apply a duplicate event twice', async () => {
    const product = {
      id: '00000000-0000-4000-8000-000000000001',
      status: ProductStatus.PUBLISHED,
      title: 'Product',
      description: 'Description',
      imageUrl: null,
      type: ProductType.FIXED_PRICE,
      price: new Prisma.Decimal('10.00'),
      stock: 1,
      ratingAverage: new Prisma.Decimal('4.00'),
      ratingCount: 1,
      categoryId: '00000000-0000-4000-8000-000000000002',
      sellerId: '00000000-0000-4000-8000-000000000003',
      publishedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      category: { name: 'Category' },
      seller: { displayName: 'Seller' },
    };
    const prisma = {
      processedEvent: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({}),
        create: jest.fn().mockResolvedValue({}),
      },
      product: { findUnique: jest.fn().mockResolvedValue(product) },
    };
    const search = { upsertProduct: jest.fn().mockResolvedValue(undefined) };
    const cache = { invalidateProduct: jest.fn().mockResolvedValue(undefined) };
    const consumer = new ProductSearchConsumerService(
      {} as never,
      prisma as never,
      search as never,
      cache as never,
    );
    const job = {
      data: {
        eventId: '00000000-0000-4000-8000-000000000004',
        eventType: PRODUCT_UPDATED,
        aggregateType: 'Product',
        aggregateId: product.id,
        occurredAt: new Date().toISOString(),
        correlationId: '00000000-0000-4000-8000-000000000005',
        schemaVersion: 1,
        payload: {},
      },
    };

    await consumer.process(job as never);
    await consumer.process(job as never);

    expect(search.upsertProduct).toHaveBeenCalledTimes(1);
    expect(cache.invalidateProduct).toHaveBeenCalledTimes(1);
    expect(prisma.processedEvent.create).toHaveBeenCalledTimes(1);
  });

  it('removes a rejected Product from search and invalidates its cache', async () => {
    const prisma = {
      processedEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      product: {
        findUnique: jest.fn().mockResolvedValue({
          status: ProductStatus.REJECTED,
        }),
      },
    };
    const search = { deleteProduct: jest.fn().mockResolvedValue(undefined) };
    const cache = { invalidateProduct: jest.fn().mockResolvedValue(undefined) };
    const consumer = new ProductSearchConsumerService(
      {} as never,
      prisma as never,
      search as never,
      cache as never,
    );
    const productId = '00000000-0000-4000-8000-000000000006';

    await consumer.process({
      data: {
        eventId: '00000000-0000-4000-8000-000000000007',
        eventType: PRODUCT_REJECTED,
        aggregateType: 'Product',
        aggregateId: productId,
        occurredAt: new Date().toISOString(),
        correlationId: '00000000-0000-4000-8000-000000000008',
        schemaVersion: 1,
        payload: {},
      },
    } as never);

    expect(search.deleteProduct).toHaveBeenCalledWith(productId);
    expect(cache.invalidateProduct).toHaveBeenCalledWith(productId);
    expect(prisma.processedEvent.create).toHaveBeenCalledTimes(1);
  });
});
