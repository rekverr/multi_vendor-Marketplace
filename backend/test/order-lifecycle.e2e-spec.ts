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
  SellerOrderStatus,
  UserRole,
} from '../src/generated/prisma/client.js';

const TEST_PREFIX = `order-lifecycle-${process.pid}`;
const PASSWORD = 'correct-horse-battery-staple';

describe('SellerOrder lifecycle (e2e)', () => {
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

  it('enforces Seller and Customer ownership while listing owned orders', async () => {
    const fixture = await seedOrder('ownership');

    const sellerList = await request(app.getHttpServer())
      .get('/seller/orders')
      .set('Authorization', `Bearer ${fixture.firstSeller.token}`)
      .expect(200);
    expect(sellerList.body.total).toBe(1);
    expect(sellerList.body.items[0].id).toBe(fixture.firstSellerOrderId);

    await request(app.getHttpServer())
      .get(`/seller/orders/${fixture.firstSellerOrderId}`)
      .set('Authorization', `Bearer ${fixture.secondSeller.token}`)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/seller/orders/${fixture.firstSellerOrderId}/status`)
      .set('Authorization', `Bearer ${fixture.secondSeller.token}`)
      .send({ status: SellerOrderStatus.PROCESSING })
      .expect(404);

    const customerList = await request(app.getHttpServer())
      .get('/orders')
      .set('Authorization', `Bearer ${fixture.customer.token}`)
      .expect(200);
    expect(customerList.body.total).toBe(1);
    expect(customerList.body.items[0].sellerOrders).toHaveLength(2);

    await request(app.getHttpServer())
      .get(`/orders/${fixture.orderId}`)
      .set('Authorization', `Bearer ${fixture.otherCustomer.token}`)
      .expect(404);
  });

  it('applies valid independent transitions and derives parent status', async () => {
    const fixture = await seedOrder('transitions');
    const itemBefore = await prisma.orderItem.findFirstOrThrow({
      where: { sellerOrderId: fixture.firstSellerOrderId },
    });

    await transition(
      fixture.firstSeller.token,
      fixture.firstSellerOrderId,
      SellerOrderStatus.PROCESSING,
      'PROCESSING',
    );
    await transition(
      fixture.firstSeller.token,
      fixture.firstSellerOrderId,
      SellerOrderStatus.SHIPPED,
      'PARTIALLY_SHIPPED',
    );
    await transition(
      fixture.firstSeller.token,
      fixture.firstSellerOrderId,
      SellerOrderStatus.COMPLETED,
      'PARTIALLY_COMPLETED',
    );
    await transition(
      fixture.secondSeller.token,
      fixture.secondSellerOrderId,
      SellerOrderStatus.PROCESSING,
      'PARTIALLY_COMPLETED',
    );
    await transition(
      fixture.secondSeller.token,
      fixture.secondSellerOrderId,
      SellerOrderStatus.SHIPPED,
      'PARTIALLY_COMPLETED',
    );
    await transition(
      fixture.secondSeller.token,
      fixture.secondSellerOrderId,
      SellerOrderStatus.COMPLETED,
      'COMPLETED',
    );

    const customerOrder = await request(app.getHttpServer())
      .get(`/orders/${fixture.orderId}`)
      .set('Authorization', `Bearer ${fixture.customer.token}`)
      .expect(200);
    expect(customerOrder.body.status).toBe('COMPLETED');
    expect(
      customerOrder.body.sellerOrders.map(
        (sellerOrder: { status: string }) => sellerOrder.status,
      ),
    ).toEqual(['COMPLETED', 'COMPLETED']);

    const itemAfter = await prisma.orderItem.findUniqueOrThrow({
      where: { id: itemBefore.id },
    });
    expect(itemAfter.productTitle).toBe(itemBefore.productTitle);
    expect(itemAfter.unitPrice.equals(itemBefore.unitPrice)).toBe(true);
    expect(itemAfter.quantity).toBe(itemBefore.quantity);
    expect(
      await prisma.outboxEvent.count({
        where: {
          aggregateId: {
            in: [
              fixture.orderId,
              fixture.firstSellerOrderId,
              fixture.secondSellerOrderId,
            ],
          },
          eventType: {
            in: ['SELLER_ORDER_STATUS_CHANGED', 'ORDER_STATUS_CHANGED'],
          },
        },
      }),
    ).toBe(10);
  });

  it('rejects skipped, repeated and cancellation transitions', async () => {
    const fixture = await seedOrder('invalid');

    for (const status of [
      SellerOrderStatus.SHIPPED,
      SellerOrderStatus.NEW,
      SellerOrderStatus.CANCELLED,
    ]) {
      await request(app.getHttpServer())
        .patch(`/seller/orders/${fixture.firstSellerOrderId}/status`)
        .set('Authorization', `Bearer ${fixture.firstSeller.token}`)
        .send({ status })
        .expect(409);
    }

    const sellerOrder = await prisma.sellerOrder.findUniqueOrThrow({
      where: { id: fixture.firstSellerOrderId },
    });
    expect(sellerOrder.status).toBe(SellerOrderStatus.NEW);
    expect(
      await prisma.outboxEvent.count({
        where: {
          aggregateId: fixture.firstSellerOrderId,
          eventType: 'SELLER_ORDER_STATUS_CHANGED',
        },
      }),
    ).toBe(0);
  });

  afterAll(async () => {
    if (!prisma || !app) return;
    await cleanup();
    await app.close();
  });

  async function transition(
    token: string,
    sellerOrderId: string,
    status: SellerOrderStatus,
    expectedOrderStatus: string,
  ) {
    const response = await request(app.getHttpServer())
      .patch(`/seller/orders/${sellerOrderId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Correlation-Id', randomUUID())
      .send({ status })
      .expect(200);
    expect(response.body.status).toBe(status);
    expect(response.body.orderStatus).toBe(expectedOrderStatus);
  }

  async function seedOrder(suffix: string) {
    const customer = await createCustomer(`${suffix}-customer`);
    const otherCustomer = await createCustomer(`${suffix}-other-customer`);
    const firstSeller = await createSeller(`${suffix}-seller-a`);
    const secondSeller = await createSeller(`${suffix}-seller-b`);
    const category = await prisma.category.create({
      data: { name: `${TEST_PREFIX}-${suffix}` },
    });
    const [firstProduct, secondProduct] = await Promise.all([
      createProduct(firstSeller.sellerId, category.id, `${suffix} Product A`),
      createProduct(secondSeller.sellerId, category.id, `${suffix} Product B`),
    ]);
    await prisma.cart.create({
      data: {
        userId: customer.userId,
        items: {
          create: [
            { productId: firstProduct.id, quantity: 1 },
            { productId: secondProduct.id, quantity: 1 },
          ],
        },
      },
    });
    const checkout = await request(app.getHttpServer())
      .post('/checkout')
      .set('Authorization', `Bearer ${customer.token}`)
      .set('Idempotency-Key', `${suffix}-lifecycle-checkout`)
      .send({ requestContext: suffix })
      .expect(201);
    const firstSellerOrder = checkout.body.sellerOrders.find(
      (sellerOrder: { sellerId: string }) =>
        sellerOrder.sellerId === firstSeller.sellerId,
    );
    const secondSellerOrder = checkout.body.sellerOrders.find(
      (sellerOrder: { sellerId: string }) =>
        sellerOrder.sellerId === secondSeller.sellerId,
    );
    return {
      customer,
      otherCustomer,
      firstSeller,
      secondSeller,
      orderId: checkout.body.id as string,
      firstSellerOrderId: firstSellerOrder.id as string,
      secondSellerOrderId: secondSellerOrder.id as string,
    };
  }

  async function createCustomer(suffix: string) {
    const email = `${TEST_PREFIX}-${suffix}@example.com`;
    const registration = await register(email);
    return {
      userId: registration.userId,
      token: await login(email),
    };
  }

  async function createSeller(suffix: string) {
    const email = `${TEST_PREFIX}-${suffix}@example.com`;
    const registration = await register(email);
    await prisma.user.update({
      where: { id: registration.userId },
      data: { role: UserRole.SELLER },
    });
    const profile = await prisma.sellerProfile.create({
      data: {
        userId: registration.userId,
        displayName: `${TEST_PREFIX}-${suffix}`,
      },
    });
    return { sellerId: profile.id, token: await login(email) };
  }

  async function register(email: string) {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: PASSWORD })
      .expect(201);
    return { userId: response.body.user.id as string };
  }

  async function login(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return response.body.accessToken as string;
  }

  function createProduct(sellerId: string, categoryId: string, title: string) {
    return prisma.product.create({
      data: {
        sellerId,
        categoryId,
        title,
        description: `${title} description`,
        type: ProductType.FIXED_PRICE,
        price: '10.00',
        stock: 3,
        status: ProductStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });
  }

  async function cleanup() {
    const users = { email: { startsWith: TEST_PREFIX } };
    const categories = { name: { startsWith: TEST_PREFIX } };
    const orders = await prisma.order.findMany({
      where: { customer: users },
      select: { id: true, sellerOrders: { select: { id: true } } },
    });
    const orderIds = orders.map((order) => order.id);
    const sellerOrderIds = orders.flatMap((order) =>
      order.sellerOrders.map((sellerOrder) => sellerOrder.id),
    );
    const products = await prisma.product.findMany({
      where: { OR: [{ seller: { user: users } }, { category: categories }] },
      select: { id: true },
    });
    const aggregateIds = [
      ...orderIds,
      ...sellerOrderIds,
      ...products.map((product) => product.id),
    ];

    await prisma.$transaction([
      prisma.outboxEvent.deleteMany({
        where: aggregateIds.length
          ? { aggregateId: { in: aggregateIds } }
          : { id: randomUUID() },
      }),
      prisma.financialLedgerEntry.deleteMany({
        where: { sellerOrder: { order: { customer: users } } },
      }),
      prisma.orderItem.deleteMany({
        where: { sellerOrder: { order: { customer: users } } },
      }),
      prisma.checkoutIdempotency.deleteMany({ where: { customer: users } }),
      prisma.sellerOrder.deleteMany({ where: { order: { customer: users } } }),
      prisma.order.deleteMany({ where: { customer: users } }),
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
