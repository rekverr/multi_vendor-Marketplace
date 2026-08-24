import { INestApplication } from '@nestjs/common';
import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import type { Job } from 'bullmq';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { CatalogCacheService } from '../src/cache/catalog-cache.service.js';
import { PrismaService } from '../src/database/prisma.service.js';
import {
  OrderStatus,
  ProductStatus,
  ProductType,
  SellerOrderStatus,
  UserRole,
} from '../src/generated/prisma/client.js';
import type { DomainEventEnvelope } from '../src/queue/domain-events-queue.service.js';
import { QueueWorkerFactory } from '../src/queue/queue-worker.factory.js';
import { MeilisearchService } from '../src/search/meilisearch.service.js';
import { PRODUCT_UPDATED } from '../src/search/product-events.service.js';
import { ProductSearchConsumerService } from '../src/search/product-search-consumer.service.js';
import { bodyOf } from './helpers/http-response.js';

const TEST_PREFIX = `reviews-events-${process.pid}`;
const PASSWORD = 'correct-horse-battery-staple';

describe('Review eligibility and event idempotency (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => cleanup());

  it('allows only the purchaser of a completed item to review it once', async () => {
    const purchaser = await createCustomer('purchaser');
    const stranger = await createCustomer('stranger');
    const purchase = await createPurchase(
      purchaser.userId,
      SellerOrderStatus.COMPLETED,
      'eligible',
    );
    const correlationId = randomUUID();

    await request(app.getHttpServer())
      .post(`/products/${purchase.productId}/reviews`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .send({ orderItemId: purchase.orderItemId, rating: 5, text: 'No' })
      .expect(404);

    const created = await request(app.getHttpServer())
      .post(`/products/${purchase.productId}/reviews`)
      .set('Authorization', `Bearer ${purchaser.token}`)
      .set('X-Correlation-Id', correlationId)
      .send({
        orderItemId: purchase.orderItemId,
        rating: 4,
        text: 'Verified purchase',
      })
      .expect(201);

    expect(bodyOf(created)).toMatchObject({
      productId: purchase.productId,
      rating: 4,
      text: 'Verified purchase',
    });
    await request(app.getHttpServer())
      .post(`/products/${purchase.productId}/reviews`)
      .set('Authorization', `Bearer ${purchaser.token}`)
      .send({
        orderItemId: purchase.orderItemId,
        rating: 5,
        text: 'Duplicate',
      })
      .expect(409);

    const product = await prisma.product.findUniqueOrThrow({
      where: { id: purchase.productId },
      select: { ratingAverage: true, ratingCount: true },
    });
    expect(product.ratingAverage.toFixed(2)).toBe('4.00');
    expect(product.ratingCount).toBe(1);
    expect(
      await prisma.outboxEvent.count({
        where: {
          aggregateId: purchase.productId,
          eventType: PRODUCT_UPDATED,
          correlationId,
        },
      }),
    ).toBe(1);
  });

  it('rejects an unfulfilled purchase and enforces review ownership', async () => {
    const customer = await createCustomer('unfulfilled');
    const stranger = await createCustomer('review-owner-stranger');
    const pending = await createPurchase(
      customer.userId,
      SellerOrderStatus.SHIPPED,
      'unfulfilled',
    );

    await request(app.getHttpServer())
      .post(`/products/${pending.productId}/reviews`)
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ orderItemId: pending.orderItemId, rating: 3, text: 'Too early' })
      .expect(404);

    const completed = await createPurchase(
      customer.userId,
      SellerOrderStatus.COMPLETED,
      'ownership',
    );
    const created = await request(app.getHttpServer())
      .post(`/products/${completed.productId}/reviews`)
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ orderItemId: completed.orderItemId, rating: 5, text: 'Owned' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/reviews/${bodyOf(created).id}`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .send({ rating: 1 })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/reviews/${bodyOf(created).id}`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .expect(404);
  });

  it('records duplicate event delivery once with a real database receipt', async () => {
    const customer = await createCustomer('event-customer');
    const purchase = await createPurchase(
      customer.userId,
      SellerOrderStatus.COMPLETED,
      'event-product',
    );
    const search = {
      upsertProduct: jest.fn<() => Promise<void>>().mockResolvedValue(),
      deleteProduct: jest.fn<() => Promise<void>>().mockResolvedValue(),
    };
    const cache = {
      invalidateProduct: jest.fn<() => Promise<void>>().mockResolvedValue(),
    };
    const consumer = new ProductSearchConsumerService(
      {} as QueueWorkerFactory,
      prisma,
      search as unknown as MeilisearchService,
      cache as unknown as CatalogCacheService,
    );
    const event: DomainEventEnvelope = {
      eventId: randomUUID(),
      eventType: PRODUCT_UPDATED,
      aggregateType: 'Product',
      aggregateId: purchase.productId,
      occurredAt: new Date().toISOString(),
      correlationId: randomUUID(),
      schemaVersion: 1,
      payload: { productId: purchase.productId },
    };
    const job = { data: event } as Job<DomainEventEnvelope>;

    await consumer.process(job);
    await consumer.process(job);

    expect(search.upsertProduct).toHaveBeenCalledTimes(1);
    expect(cache.invalidateProduct).toHaveBeenCalledTimes(1);
    expect(
      await prisma.processedEvent.count({ where: { eventId: event.eventId } }),
    ).toBe(1);
  });

  afterAll(async () => {
    if (!prisma || !app) return;
    await cleanup();
    await app.close();
  });

  async function createCustomer(suffix: string) {
    const email = `${TEST_PREFIX}-${suffix}@example.com`;
    const registration = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: PASSWORD })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return {
      userId: bodyOf(registration).user.id,
      token: bodyOf(login).accessToken,
    };
  }

  async function createPurchase(
    customerId: string,
    status: SellerOrderStatus,
    suffix: string,
  ) {
    const seller = await prisma.sellerProfile.create({
      data: {
        displayName: `${TEST_PREFIX}-${suffix}`,
        user: {
          create: {
            email: `${TEST_PREFIX}-${suffix}@seller.example.com`,
            role: UserRole.SELLER,
          },
        },
      },
    });
    const category = await prisma.category.create({
      data: { name: `${TEST_PREFIX}-${suffix}` },
    });
    const product = await prisma.product.create({
      data: {
        sellerId: seller.id,
        categoryId: category.id,
        title: `${TEST_PREFIX}-${suffix}`,
        description: 'Review fixture product',
        type: ProductType.FIXED_PRICE,
        price: '20.00',
        stock: 5,
        status: ProductStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });
    const order = await prisma.order.create({
      data: {
        customerId,
        status:
          status === SellerOrderStatus.COMPLETED
            ? OrderStatus.COMPLETED
            : OrderStatus.SHIPPED,
        currency: 'USD',
        totalAmount: '40.00',
        sellerOrders: {
          create: {
            sellerId: seller.id,
            status,
            currency: 'USD',
            grossAmount: '40.00',
            commissionRate: '0.100000',
            platformCommission: '4.00',
            sellerNet: '36.00',
            completedAt:
              status === SellerOrderStatus.COMPLETED ? new Date() : null,
            items: {
              create: {
                productId: product.id,
                productTitle: product.title,
                productType: product.type,
                sellerIdSnapshot: seller.id,
                sellerNameSnapshot: seller.displayName,
                unitPrice: '20.00',
                quantity: 2,
                lineTotal: '40.00',
              },
            },
          },
        },
      },
      select: {
        sellerOrders: { select: { items: { select: { id: true } } } },
      },
    });
    return {
      productId: product.id,
      orderItemId: order.sellerOrders[0].items[0].id,
    };
  }

  async function cleanup() {
    const users = { email: { startsWith: TEST_PREFIX } };
    const categories = { name: { startsWith: TEST_PREFIX } };
    const products = await prisma.product.findMany({
      where: { OR: [{ seller: { user: users } }, { category: categories }] },
      select: { id: true },
    });
    const productIds = products.map((product) => product.id);
    const orders = await prisma.order.findMany({
      where: { customer: users },
      select: { id: true, sellerOrders: { select: { id: true } } },
    });
    const orderIds = orders.map((order) => order.id);
    const sellerOrderIds = orders.flatMap((order) =>
      order.sellerOrders.map((sellerOrder) => sellerOrder.id),
    );
    const aggregateIds = [...productIds, ...orderIds, ...sellerOrderIds];

    await prisma.$transaction([
      prisma.review.deleteMany({ where: { productId: { in: productIds } } }),
      prisma.outboxEvent.deleteMany({
        where: { aggregateId: { in: aggregateIds } },
      }),
      prisma.processedEvent.deleteMany({}),
      prisma.orderItem.deleteMany({
        where: { sellerOrderId: { in: sellerOrderIds } },
      }),
      prisma.sellerOrder.deleteMany({ where: { id: { in: sellerOrderIds } } }),
      prisma.order.deleteMany({ where: { id: { in: orderIds } } }),
      prisma.product.deleteMany({ where: { id: { in: productIds } } }),
      prisma.category.deleteMany({ where: categories }),
      prisma.sellerProfile.deleteMany({ where: { user: users } }),
      prisma.refreshSession.deleteMany({ where: { user: users } }),
      prisma.user.deleteMany({ where: users }),
    ]);
  }
});
