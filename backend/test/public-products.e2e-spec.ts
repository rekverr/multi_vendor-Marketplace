import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/database/prisma.service.js';
import {
  ProductStatus,
  ProductType,
  UserRole,
} from '../src/generated/prisma/client.js';

const TEST_PREFIX = `public-products-${process.pid}`;

describe('Public Product catalog (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let categoryAId: string;
  let categoryBId: string;
  let sellerAId: string;
  let sellerBId: string;
  let publishedIds: string[];
  let draftId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await cleanup();
    await seedCatalog();
  });

  it('returns only published Products and exposes only public fields', async () => {
    const list = await request(app.getHttpServer())
      .get('/products')
      .expect(200);

    expect(list.body.items).toHaveLength(4);
    expect(
      list.body.items.map((product: { id: string }) => product.id),
    ).not.toContain(draftId);

    const detail = await request(app.getHttpServer())
      .get(`/products/${publishedIds[0]}`)
      .expect(200);

    expect(detail.body).toMatchObject({
      id: publishedIds[0],
      category: { id: categoryAId },
      seller: { id: sellerAId, displayName: `${TEST_PREFIX} Seller A` },
    });
    expect(detail.body).not.toHaveProperty('status');
    expect(detail.body).not.toHaveProperty('sellerId');
    expect(detail.body).not.toHaveProperty('categoryId');
    expect(detail.body).not.toHaveProperty('moderatedById');
    expect(detail.body.seller).not.toHaveProperty('userId');

    await request(app.getHttpServer()).get(`/products/${draftId}`).expect(404);
  });

  it('filters by Category, Seller, price range and availability', async () => {
    const byCategory = await request(app.getHttpServer())
      .get('/products')
      .query({ categoryId: categoryAId })
      .expect(200);
    expect(byCategory.body.items).toHaveLength(2);

    const bySeller = await request(app.getHttpServer())
      .get('/products')
      .query({ sellerId: sellerBId })
      .expect(200);
    expect(bySeller.body.items).toHaveLength(2);

    const byPrice = await request(app.getHttpServer())
      .get('/products')
      .query({ minPrice: '15.00', maxPrice: '35.00' })
      .expect(200);
    expect(
      byPrice.body.items.map((product: { title: string }) => product.title),
    ).toEqual(['Product 3', 'Product 2']);

    const available = await request(app.getHttpServer())
      .get('/products')
      .query({ available: 'true' })
      .expect(200);
    expect(available.body.items).toHaveLength(3);

    const unavailable = await request(app.getHttpServer())
      .get('/products')
      .query({ available: 'false' })
      .expect(200);
    expect(unavailable.body.items).toHaveLength(1);
    expect(unavailable.body.items[0].title).toBe('Product 2');
  });

  it('paginates with stable deterministic ordering', async () => {
    const firstPage = await request(app.getHttpServer())
      .get('/products')
      .query({ page: 1, pageSize: 2 })
      .expect(200);
    const repeatedFirstPage = await request(app.getHttpServer())
      .get('/products')
      .query({ page: 1, pageSize: 2 })
      .expect(200);
    const secondPage = await request(app.getHttpServer())
      .get('/products')
      .query({ page: 2, pageSize: 2 })
      .expect(200);

    expect(firstPage.body.pagination).toEqual({
      page: 1,
      pageSize: 2,
      total: 4,
      totalPages: 2,
    });
    expect(
      firstPage.body.items.map((product: { title: string }) => product.title),
    ).toEqual(['Product 4', 'Product 3']);
    expect(
      repeatedFirstPage.body.items.map((product: { id: string }) => product.id),
    ).toEqual(
      firstPage.body.items.map((product: { id: string }) => product.id),
    );
    expect(
      secondPage.body.items.map((product: { title: string }) => product.title),
    ).toEqual(['Product 2', 'Product 1']);
  });

  it.each([
    [{ page: '0' }],
    [{ pageSize: '51' }],
    [{ categoryId: 'invalid' }],
    [{ minPrice: '-1.00' }],
    [{ available: 'yes' }],
    [{ unknown: 'value' }],
    [{ minPrice: '30.00', maxPrice: '20.00' }],
  ])('rejects invalid query %j', async (query) => {
    await request(app.getHttpServer())
      .get('/products')
      .query(query)
      .expect(400);
  });

  afterAll(async () => {
    if (!prisma || !app) return;
    await cleanup();
    await app.close();
  });

  async function seedCatalog() {
    const categoryA = await prisma.category.create({
      data: { name: `${TEST_PREFIX} Category A` },
    });
    const categoryB = await prisma.category.create({
      data: { name: `${TEST_PREFIX} Category B` },
    });
    categoryAId = categoryA.id;
    categoryBId = categoryB.id;

    const sellerA = await prisma.sellerProfile.create({
      data: {
        displayName: `${TEST_PREFIX} Seller A`,
        user: {
          create: {
            email: `${TEST_PREFIX}-seller-a@example.com`,
            role: UserRole.SELLER,
          },
        },
      },
    });
    const sellerB = await prisma.sellerProfile.create({
      data: {
        displayName: `${TEST_PREFIX} Seller B`,
        user: {
          create: {
            email: `${TEST_PREFIX}-seller-b@example.com`,
            role: UserRole.SELLER,
          },
        },
      },
    });
    sellerAId = sellerA.id;
    sellerBId = sellerB.id;

    const products = await Promise.all([
      createProduct('Product 1', sellerAId, categoryAId, '10.00', 5, 1),
      createProduct('Product 2', sellerAId, categoryAId, '20.00', 0, 2),
      createProduct('Product 3', sellerBId, categoryBId, '30.00', 2, 3),
      createProduct('Product 4', sellerBId, categoryBId, '40.00', 1, 4),
    ]);
    publishedIds = products.map((product) => product.id);

    const draft = await prisma.product.create({
      data: {
        sellerId: sellerAId,
        categoryId: categoryAId,
        title: 'Private Draft',
        description: 'This Product must not be public.',
        type: ProductType.FIXED_PRICE,
        price: '15.00',
        stock: 5,
        status: ProductStatus.DRAFT,
      },
    });
    draftId = draft.id;
  }

  function createProduct(
    title: string,
    sellerId: string,
    categoryId: string,
    price: string,
    stock: number,
    publishedDay: number,
  ) {
    return prisma.product.create({
      data: {
        sellerId,
        categoryId,
        title,
        description: `${title} public description.`,
        imageUrl: `https://example.com/${title.toLowerCase().replace(' ', '-')}.jpg`,
        type: ProductType.FIXED_PRICE,
        price,
        stock,
        status: ProductStatus.PUBLISHED,
        publishedAt: new Date(`2026-01-0${publishedDay}T00:00:00.000Z`),
      },
    });
  }

  function cleanup() {
    const users = { email: { startsWith: TEST_PREFIX } };
    const categories = { name: { startsWith: TEST_PREFIX } };

    return prisma.$transaction([
      prisma.product.deleteMany({
        where: { OR: [{ seller: { user: users } }, { category: categories }] },
      }),
      prisma.category.deleteMany({ where: categories }),
      prisma.sellerProfile.deleteMany({ where: { user: users } }),
      prisma.user.deleteMany({ where: users }),
    ]);
  }
});
