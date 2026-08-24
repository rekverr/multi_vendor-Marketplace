import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { bodyOf } from './helpers/http-response.js';
import {
  LedgerAccount,
  ProductStatus,
  ProductType,
  UserRole,
} from '../src/generated/prisma/client.js';

const TEST_PREFIX = `checkout-${process.pid}`;
const PASSWORD = 'correct-horse-battery-staple';

describe('Customer checkout (e2e)', () => {
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

  it('creates one Order with one SellerOrder per Seller and authoritative financials', async () => {
    const customer = await createCustomer('multi');
    const first = await createProduct('seller-a', 'First Product', '10.00', 5);
    const second = await createProduct(
      'seller-b',
      'Second Product',
      '20.00',
      3,
    );
    await createCart(customer.userId, [
      { productId: first.productId, quantity: 2 },
      { productId: second.productId, quantity: 1 },
    ]);

    const correlationId = randomUUID();
    const response = await request(app.getHttpServer())
      .post('/checkout')
      .set('Authorization', `Bearer ${customer.token}`)
      .set('Idempotency-Key', 'multi-seller-checkout')
      .set('X-Correlation-Id', correlationId)
      .send({})
      .expect(201);

    expect(bodyOf(response)).toMatchObject({
      totalAmount: '40',
      currency: 'USD',
    });
    expect(bodyOf(response).sellerOrders).toHaveLength(2);
    for (const sellerOrder of bodyOf(response).sellerOrders) {
      expect(sellerOrder).toMatchObject({
        grossAmount: '20',
        commissionRate: '0.1',
        platformCommission: '2',
        sellerNet: '18',
      });
      expect(sellerOrder.items).toHaveLength(1);
    }

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: bodyOf(response).id },
      include: {
        sellerOrders: { include: { items: true, ledgerEntries: true } },
      },
    });
    expect(order.sellerOrders).toHaveLength(2);
    expect(order.sellerOrders.flatMap((entry) => entry.items)).toHaveLength(2);
    expect(
      order.sellerOrders
        .flatMap((entry) => entry.items)
        .map((item) => ({
          title: item.productTitle,
          unitPrice: item.unitPrice.toFixed(2),
          quantity: item.quantity,
          total: item.lineTotal.toFixed(2),
        })),
    ).toEqual(
      expect.arrayContaining([
        {
          title: 'First Product',
          unitPrice: '10.00',
          quantity: 2,
          total: '20.00',
        },
        {
          title: 'Second Product',
          unitPrice: '20.00',
          quantity: 1,
          total: '20.00',
        },
      ]),
    );
    for (const sellerOrder of order.sellerOrders) {
      expect(sellerOrder.ledgerEntries).toHaveLength(2);
      expect(
        sellerOrder.ledgerEntries
          .find((entry) => entry.account === LedgerAccount.PLATFORM)
          ?.amount.toFixed(2),
      ).toBe('2.00');
      expect(
        sellerOrder.ledgerEntries
          .find((entry) => entry.account === LedgerAccount.SELLER)
          ?.amount.toFixed(2),
      ).toBe('18.00');
    }
    expect(
      await prisma.product.findMany({
        where: { id: { in: [first.productId, second.productId] } },
        orderBy: { title: 'asc' },
        select: { stock: true },
      }),
    ).toEqual([{ stock: 3 }, { stock: 2 }]);
    expect(
      await prisma.cartItem.count({
        where: { cart: { userId: customer.userId } },
      }),
    ).toBe(0);
    expect(await prisma.outboxEvent.count({ where: { correlationId } })).toBe(
      5,
    );
  });

  it('returns the original Order for the same idempotency key without repeating effects', async () => {
    const customer = await createCustomer('retry');
    const product = await createProduct(
      'retry-seller',
      'Retry Product',
      '12.50',
      2,
    );
    await createCart(customer.userId, [
      { productId: product.productId, quantity: 1 },
    ]);
    const headers = {
      Authorization: `Bearer ${customer.token}`,
      'Idempotency-Key': 'same-checkout-request',
      'X-Correlation-Id': randomUUID(),
    };

    const first = await request(app.getHttpServer())
      .post('/checkout')
      .set(headers)
      .send({ requestContext: 'cart-submit-1' })
      .expect(201);
    const retry = await request(app.getHttpServer())
      .post('/checkout')
      .set(headers)
      .send({ requestContext: 'cart-submit-1' })
      .expect(201);

    expect(bodyOf(retry).id).toBe(bodyOf(first).id);
    expect(
      await prisma.order.count({ where: { customerId: customer.userId } }),
    ).toBe(1);
    expect(
      await prisma.checkoutAttempt.count({
        where: { customerId: customer.userId },
      }),
    ).toBe(1);
    expect(
      (
        await prisma.product.findUniqueOrThrow({
          where: { id: product.productId },
        })
      ).stock,
    ).toBe(1);
    expect(await prisma.financialLedgerEntry.count()).toBe(2);
  });

  it('rejects conflicting reuse of an idempotency key', async () => {
    const customer = await createCustomer('conflicting-retry');
    const product = await createProduct(
      'conflicting-retry-seller',
      'Conflicting Retry Product',
      '15.00',
      2,
    );
    await createCart(customer.userId, [
      { productId: product.productId, quantity: 1 },
    ]);
    const headers = {
      Authorization: `Bearer ${customer.token}`,
      'Idempotency-Key': 'conflicting-checkout-request',
    };

    const first = await request(app.getHttpServer())
      .post('/checkout')
      .set(headers)
      .send({ requestContext: 'cart-state-a' })
      .expect(201);
    const conflict = await request(app.getHttpServer())
      .post('/checkout')
      .set(headers)
      .send({ requestContext: 'cart-state-b' })
      .expect(409);

    expect(bodyOf(conflict).message).toBe(
      'Idempotency key was used for another request',
    );
    expect(
      await prisma.order.count({ where: { customerId: customer.userId } }),
    ).toBe(1);
    expect(
      (
        await prisma.product.findUniqueOrThrow({
          where: { id: product.productId },
        })
      ).stock,
    ).toBe(1);
    expect(bodyOf(first).id).toBeDefined();
  });

  it('allows exactly one of two concurrent Customers to consume stock 1', async () => {
    for (let iteration = 0; iteration < 3; iteration += 1) {
      const firstCustomer = await createCustomer(`race-${iteration}-a`);
      const secondCustomer = await createCustomer(`race-${iteration}-b`);
      const product = await createProduct(
        `race-${iteration}-seller`,
        `Race Product ${iteration}`,
        '7.00',
        1,
      );
      await Promise.all([
        createCart(firstCustomer.userId, [
          { productId: product.productId, quantity: 1 },
        ]),
        createCart(secondCustomer.userId, [
          { productId: product.productId, quantity: 1 },
        ]),
      ]);

      const [first, second] = await Promise.all([
        request(app.getHttpServer())
          .post('/checkout')
          .set('Authorization', `Bearer ${firstCustomer.token}`)
          .set('Idempotency-Key', `race-${iteration}-checkout-a`)
          .send({ requestContext: `race-${iteration}-a` }),
        request(app.getHttpServer())
          .post('/checkout')
          .set('Authorization', `Bearer ${secondCustomer.token}`)
          .set('Idempotency-Key', `race-${iteration}-checkout-b`)
          .send({ requestContext: `race-${iteration}-b` }),
      ]);

      expect([first.status, second.status].sort()).toEqual([201, 409]);
      expect(
        (
          await prisma.product.findUniqueOrThrow({
            where: { id: product.productId },
          })
        ).stock,
      ).toBe(0);
      expect(
        await prisma.order.count({
          where: {
            customerId: {
              in: [firstCustomer.userId, secondCustomer.userId],
            },
          },
        }),
      ).toBe(1);
      expect(
        await prisma.orderItem.count({
          where: { productId: product.productId },
        }),
      ).toBe(1);
    }
  });

  it('rolls back all checkout effects when authoritative stock is insufficient', async () => {
    const customer = await createCustomer('rollback');
    const product = await createProduct(
      'rollback-seller',
      'Rollback Product',
      '9.00',
      1,
    );
    await createCart(customer.userId, [
      { productId: product.productId, quantity: 1 },
    ]);
    await prisma.product.update({
      where: { id: product.productId },
      data: { stock: 0 },
    });

    await request(app.getHttpServer())
      .post('/checkout')
      .set('Authorization', `Bearer ${customer.token}`)
      .set('Idempotency-Key', 'rollback-checkout')
      .set('X-Correlation-Id', randomUUID())
      .send({})
      .expect(409);

    expect(
      await prisma.order.count({ where: { customerId: customer.userId } }),
    ).toBe(0);
    expect(
      await prisma.checkoutIdempotency.count({
        where: { customerId: customer.userId },
      }),
    ).toBe(0);
    expect(
      await prisma.checkoutAttempt.findUniqueOrThrow({
        where: {
          customerId_idempotencyKey: {
            customerId: customer.userId,
            idempotencyKey: 'rollback-checkout',
          },
        },
        select: { status: true, lastErrorCode: true },
      }),
    ).toEqual({ status: 'FAILED', lastErrorCode: 'HTTP_409' });
    expect(await prisma.financialLedgerEntry.count()).toBe(0);
    expect(
      await prisma.cartItem.count({
        where: { cart: { userId: customer.userId } },
      }),
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

  async function createProduct(
    suffix: string,
    title: string,
    price: string,
    stock: number,
  ) {
    const category = await prisma.category.create({
      data: { name: `${TEST_PREFIX}-${suffix}` },
    });
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
    const product = await prisma.product.create({
      data: {
        sellerId: seller.id,
        categoryId: category.id,
        title,
        description: `${title} description`,
        type: ProductType.FIXED_PRICE,
        price,
        stock,
        status: ProductStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });
    return { productId: product.id, sellerId: seller.id };
  }

  async function createCart(
    userId: string,
    items: Array<{ productId: string; quantity: number }>,
  ) {
    await prisma.cart.create({
      data: { userId, items: { create: items } },
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
          : { id: { equals: randomUUID() } },
      }),
      prisma.financialLedgerEntry.deleteMany({
        where: { sellerOrder: { order: { customer: users } } },
      }),
      prisma.orderItem.deleteMany({
        where: { sellerOrder: { order: { customer: users } } },
      }),
      prisma.checkoutIdempotency.deleteMany({ where: { customer: users } }),
      prisma.checkoutAttempt.deleteMany({ where: { customer: users } }),
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
