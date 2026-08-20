import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
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

const TEST_PREFIX = `cart-${process.pid}`;
const PASSWORD = 'correct-horse-battery-staple';
const CUSTOMER_A = `${TEST_PREFIX}-customer-a@example.com`;
const CUSTOMER_B = `${TEST_PREFIX}-customer-b@example.com`;
const SELLER_LOGIN = `${TEST_PREFIX}-seller-login@example.com`;

describe('Customer cart (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let availableProductId: string;
  let unavailableProductId: string;
  let draftProductId: string;
  let customerAToken: string;
  let customerBToken: string;

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
    await seedProducts();
    customerAToken = await registerAndLogin(CUSTOMER_A);
    customerBToken = await registerAndLogin(CUSTOMER_B);
  });

  it('requires an authenticated Customer and isolates carts by owner', async () => {
    await request(app.getHttpServer()).get('/cart').expect(401);

    await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ productId: availableProductId, quantity: 1 })
      .expect(201);

    const otherCart = await request(app.getHttpServer())
      .get('/cart')
      .set('Authorization', `Bearer ${customerBToken}`)
      .expect(200);
    expect(otherCart.body.items).toHaveLength(0);

    await request(app.getHttpServer())
      .patch(`/cart/items/${availableProductId}`)
      .set('Authorization', `Bearer ${customerBToken}`)
      .send({ quantity: 2 })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/cart/items/${availableProductId}`)
      .set('Authorization', `Bearer ${customerBToken}`)
      .expect(404);

    const sellerToken = await registerAndLogin(SELLER_LOGIN);
    await prisma.user.update({
      where: { email: SELLER_LOGIN },
      data: { role: UserRole.SELLER },
    });
    const refreshedSellerToken = await login(SELLER_LOGIN);
    expect(sellerToken).toBeDefined();
    await request(app.getHttpServer())
      .get('/cart')
      .set('Authorization', `Bearer ${refreshedSellerToken}`)
      .expect(403);
  });

  it('adds, updates, removes and clears items using authoritative Product data', async () => {
    const added = await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        productId: availableProductId,
        quantity: 2,
        price: '0.01',
        sellerId: randomUUID(),
        userId: randomUUID(),
      })
      .expect(201);
    expect(added.body.items[0]).toMatchObject({
      quantity: 2,
      lineTotal: '39.98',
      purchasable: true,
      product: {
        id: availableProductId,
        price: '19.99',
        stock: 5,
      },
    });

    const updated = await request(app.getHttpServer())
      .patch(`/cart/items/${availableProductId}`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ quantity: 3 })
      .expect(200);
    expect(updated.body.items[0].quantity).toBe(3);

    const removed = await request(app.getHttpServer())
      .delete(`/cart/items/${availableProductId}`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(200);
    expect(removed.body.items).toHaveLength(0);

    await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ productId: availableProductId, quantity: 1 })
      .expect(201);
    await request(app.getHttpServer())
      .delete('/cart')
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(204);
    const cleared = await request(app.getHttpServer())
      .get('/cart')
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(200);
    expect(cleared.body.items).toHaveLength(0);
  });

  it('merges duplicate Product adds into one CartItem', async () => {
    for (const quantity of [1, 2]) {
      await request(app.getHttpServer())
        .post('/cart/items')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ productId: availableProductId, quantity })
        .expect(201);
    }

    const cart = await request(app.getHttpServer())
      .get('/cart')
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(200);
    expect(cart.body.items).toHaveLength(1);
    expect(cart.body.items[0].quantity).toBe(3);
    expect(
      await prisma.cartItem.count({ where: { productId: availableProductId } }),
    ).toBe(1);
  });

  it('rejects invalid quantities', async () => {
    await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ productId: availableProductId, quantity: 0 })
      .expect(400);
    await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ productId: availableProductId, quantity: 6 })
      .expect(409);
  });

  it('rejects unavailable or unpublished Products', async () => {
    for (const productId of [unavailableProductId, draftProductId]) {
      await request(app.getHttpServer())
        .post('/cart/items')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ productId, quantity: 1 })
        .expect(404);
    }
  });

  afterAll(async () => {
    if (!prisma || !app) return;
    await cleanup();
    await app.close();
  });

  async function seedProducts() {
    const category = await prisma.category.create({
      data: { name: `${TEST_PREFIX} Category` },
    });
    const seller = await prisma.sellerProfile.create({
      data: {
        displayName: `${TEST_PREFIX} Store`,
        user: {
          create: {
            email: `${TEST_PREFIX}-product-seller@example.com`,
            role: UserRole.SELLER,
          },
        },
      },
    });
    const common = {
      sellerId: seller.id,
      categoryId: category.id,
      description: 'Cart Product description',
      type: ProductType.FIXED_PRICE,
      price: '19.99',
      publishedAt: new Date(),
    };
    const [available, unavailable, draft] = await Promise.all([
      prisma.product.create({
        data: {
          ...common,
          title: 'Available Product',
          stock: 5,
          status: ProductStatus.PUBLISHED,
        },
      }),
      prisma.product.create({
        data: {
          ...common,
          title: 'Out of Stock Product',
          stock: 0,
          status: ProductStatus.PUBLISHED,
        },
      }),
      prisma.product.create({
        data: {
          ...common,
          title: 'Draft Product',
          stock: 5,
          status: ProductStatus.DRAFT,
        },
      }),
    ]);
    availableProductId = available.id;
    unavailableProductId = unavailable.id;
    draftProductId = draft.id;
  }

  async function registerAndLogin(email: string): Promise<string> {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: PASSWORD })
      .expect(201);
    return login(email);
  }

  async function login(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return response.body.accessToken as string;
  }

  function cleanup() {
    const users = { email: { startsWith: TEST_PREFIX } };
    const categories = { name: { startsWith: TEST_PREFIX } };
    return prisma.$transaction([
      prisma.cartItem.deleteMany({ where: { cart: { user: users } } }),
      prisma.cart.deleteMany({ where: { user: users } }),
      prisma.product.deleteMany({
        where: { OR: [{ seller: { user: users } }, { category: categories }] },
      }),
      prisma.category.deleteMany({ where: categories }),
      prisma.sellerProfile.deleteMany({ where: { user: users } }),
      prisma.refreshSession.deleteMany({ where: { user: users } }),
      prisma.user.deleteMany({ where: users }),
    ]);
  }
});
