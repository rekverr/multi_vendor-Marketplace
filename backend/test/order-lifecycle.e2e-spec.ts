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
    expect(bodyOf(sellerList).total).toBe(1);
    expect(bodyOf(sellerList).items[0].id).toBe(fixture.firstSellerOrderId);

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
    expect(bodyOf(customerList).total).toBe(1);
    expect(bodyOf(customerList).items[0].sellerOrders).toHaveLength(2);

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
    expect(bodyOf(customerOrder).status).toBe('COMPLETED');
    expect(
      bodyOf(customerOrder).sellerOrders.map(
        (sellerOrder) => sellerOrder.status,
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

  it('cancels one SellerOrder atomically and restores only its inventory', async () => {
    const fixture = await seedOrder('seller-order-cancel');

    await request(app.getHttpServer())
      .post(
        `/orders/${fixture.orderId}/seller-orders/${fixture.firstSellerOrderId}/cancel`,
      )
      .set('Authorization', `Bearer ${fixture.otherCustomer.token}`)
      .send({})
      .expect(404);

    const cancelled = await request(app.getHttpServer())
      .post(
        `/orders/${fixture.orderId}/seller-orders/${fixture.firstSellerOrderId}/cancel`,
      )
      .set('Authorization', `Bearer ${fixture.customer.token}`)
      .set('X-Correlation-Id', randomUUID())
      .send({})
      .expect(201);
    expect(bodyOf(cancelled).status).toBe(SellerOrderStatus.CANCELLED);
    expect(bodyOf(cancelled).orderStatus).toBe('PARTIALLY_CANCELLED');

    const retry = await request(app.getHttpServer())
      .post(
        `/orders/${fixture.orderId}/seller-orders/${fixture.firstSellerOrderId}/cancel`,
      )
      .set('Authorization', `Bearer ${fixture.customer.token}`)
      .send({})
      .expect(201);
    expect(bodyOf(retry).status).toBe(SellerOrderStatus.CANCELLED);

    expect(
      (
        await prisma.product.findUniqueOrThrow({
          where: { id: fixture.firstProductId },
        })
      ).stock,
    ).toBe(3);
    expect(
      (
        await prisma.product.findUniqueOrThrow({
          where: { id: fixture.secondProductId },
        })
      ).stock,
    ).toBe(2);
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: fixture.orderId },
    });
    expect(order.refundedAmount.toFixed(2)).toBe('30.00');
    expect(
      await prisma.financialLedgerEntry.count({
        where: {
          sellerOrderId: fixture.firstSellerOrderId,
          entryType: 'CANCELLATION_REVERSAL',
        },
      }),
    ).toBe(2);
  });

  it('rejects cancellation after shipment', async () => {
    const fixture = await seedOrder('invalid-cancel-status');
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

    await request(app.getHttpServer())
      .post(
        `/orders/${fixture.orderId}/seller-orders/${fixture.firstSellerOrderId}/cancel`,
      )
      .set('Authorization', `Bearer ${fixture.customer.token}`)
      .send({})
      .expect(409);
    expect(
      (
        await prisma.product.findUniqueOrThrow({
          where: { id: fixture.firstProductId },
        })
      ).stock,
    ).toBe(0);
  });

  it('cancels an eligible parent Order atomically and is retry-safe', async () => {
    const fixture = await seedOrder('parent-cancel');

    const first = await request(app.getHttpServer())
      .post(`/orders/${fixture.orderId}/cancel`)
      .set('Authorization', `Bearer ${fixture.customer.token}`)
      .set('X-Correlation-Id', randomUUID())
      .send({})
      .expect(201);
    expect(bodyOf(first).status).toBe('CANCELLED');
    expect(
      bodyOf(first).sellerOrders.map((sellerOrder) => sellerOrder.status),
    ).toEqual(['CANCELLED', 'CANCELLED']);

    await request(app.getHttpServer())
      .post(`/orders/${fixture.orderId}/cancel`)
      .set('Authorization', `Bearer ${fixture.customer.token}`)
      .send({})
      .expect(201);

    expect(
      await prisma.financialLedgerEntry.count({
        where: {
          sellerOrderId: {
            in: [fixture.firstSellerOrderId, fixture.secondSellerOrderId],
          },
          entryType: 'CANCELLATION_REVERSAL',
        },
      }),
    ).toBe(4);
    expect(
      await prisma.product.findMany({
        where: {
          id: { in: [fixture.firstProductId, fixture.secondProductId] },
        },
        orderBy: { id: 'asc' },
        select: { stock: true },
      }),
    ).toEqual([{ stock: 3 }, { stock: 3 }]);
  });

  it('creates bounded idempotent item refunds from historical prices', async () => {
    const fixture = await seedOrder('partial-refund');
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
    await prisma.product.update({
      where: { id: fixture.firstProductId },
      data: { price: '999.00' },
    });

    await request(app.getHttpServer())
      .post(
        `/seller/orders/${fixture.firstSellerOrderId}/items/${fixture.firstItemId}/refunds`,
      )
      .set('Authorization', `Bearer ${fixture.secondSeller.token}`)
      .set('Idempotency-Key', 'unauthorized-refund')
      .send({ quantity: 1 })
      .expect(404);

    const headers = {
      Authorization: `Bearer ${fixture.firstSeller.token}`,
      'Idempotency-Key': 'partial-refund-request',
    };
    const first = await request(app.getHttpServer())
      .post(
        `/seller/orders/${fixture.firstSellerOrderId}/items/${fixture.firstItemId}/refunds`,
      )
      .set(headers)
      .send({ quantity: 1, reason: 'Damaged item' })
      .expect(201);
    expect(bodyOf(first)).toMatchObject({
      quantity: 1,
      amount: '10',
      commissionAmount: '1',
      sellerNetAmount: '9',
    });

    const retry = await request(app.getHttpServer())
      .post(
        `/seller/orders/${fixture.firstSellerOrderId}/items/${fixture.firstItemId}/refunds`,
      )
      .set(headers)
      .send({ quantity: 1, reason: 'Damaged item' })
      .expect(201);
    expect(bodyOf(retry).id).toBe(bodyOf(first).id);

    await request(app.getHttpServer())
      .post(
        `/seller/orders/${fixture.firstSellerOrderId}/items/${fixture.firstItemId}/refunds`,
      )
      .set(headers)
      .send({ quantity: 2, reason: 'Damaged item' })
      .expect(409);
    await request(app.getHttpServer())
      .post(
        `/seller/orders/${fixture.firstSellerOrderId}/items/${fixture.firstItemId}/refunds`,
      )
      .set('Authorization', `Bearer ${fixture.firstSeller.token}`)
      .set('Idempotency-Key', 'excessive-refund-request')
      .send({ quantity: 3 })
      .expect(409);

    expect(await prisma.refund.count()).toBe(1);
    const item = await prisma.orderItem.findUniqueOrThrow({
      where: { id: fixture.firstItemId },
    });
    expect(item.refundedQuantity).toBe(1);
    expect(item.refundedAmount.toFixed(2)).toBe('10.00');
    const sellerOrder = await prisma.sellerOrder.findUniqueOrThrow({
      where: { id: fixture.firstSellerOrderId },
    });
    expect(sellerOrder.refundedGross.toFixed(2)).toBe('10.00');
    expect(sellerOrder.refundedCommission.toFixed(2)).toBe('1.00');
    expect(sellerOrder.refundedSellerNet.toFixed(2)).toBe('9.00');
    expect(
      (
        await prisma.order.findUniqueOrThrow({
          where: { id: fixture.orderId },
        })
      ).refundedAmount.toFixed(2),
    ).toBe('10.00');
    const reversals = await prisma.financialLedgerEntry.findMany({
      where: {
        sellerOrderId: fixture.firstSellerOrderId,
        orderItemId: fixture.firstItemId,
        entryType: 'REFUND_REVERSAL',
      },
      orderBy: { account: 'asc' },
    });
    expect(
      reversals.map((entry) => ({
        account: entry.account,
        direction: entry.direction,
        amount: entry.amount.toFixed(2),
      })),
    ).toEqual([
      { account: 'PLATFORM', direction: 'DEBIT', amount: '1.00' },
      { account: 'SELLER', direction: 'DEBIT', amount: '9.00' },
    ]);
    expect(
      await prisma.outboxEvent.count({
        where: { aggregateId: bodyOf(first).id, eventType: 'REFUND_CREATED' },
      }),
    ).toBe(1);
  });

  it('rejects item refunds before completion', async () => {
    const fixture = await seedOrder('invalid-refund-status');

    await request(app.getHttpServer())
      .post(
        `/seller/orders/${fixture.firstSellerOrderId}/items/${fixture.firstItemId}/refunds`,
      )
      .set('Authorization', `Bearer ${fixture.firstSeller.token}`)
      .set('Idempotency-Key', 'invalid-status-refund')
      .send({ quantity: 1 })
      .expect(409);
    expect(await prisma.refund.count()).toBe(0);
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
    expect(bodyOf(response).status).toBe(status);
    expect(bodyOf(response).orderStatus).toBe(expectedOrderStatus);
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
            { productId: firstProduct.id, quantity: 3 },
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
    const firstSellerOrder = bodyOf(checkout).sellerOrders.find(
      (sellerOrder) => sellerOrder.sellerId === firstSeller.sellerId,
    );
    const secondSellerOrder = bodyOf(checkout).sellerOrders.find(
      (sellerOrder) => sellerOrder.sellerId === secondSeller.sellerId,
    );
    if (!firstSellerOrder || !secondSellerOrder) {
      throw new Error('Checkout SellerOrders were not returned');
    }
    return {
      customer,
      otherCustomer,
      firstSeller,
      secondSeller,
      orderId: bodyOf(checkout).id,
      firstSellerOrderId: firstSellerOrder.id,
      secondSellerOrderId: secondSellerOrder.id,
      firstItemId: firstSellerOrder.items[0].id,
      firstProductId: firstProduct.id,
      secondProductId: secondProduct.id,
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
    return { userId: bodyOf(response).user.id };
  }

  async function login(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return bodyOf(response).accessToken;
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
      prisma.refund.deleteMany({ where: { initiatedBy: users } }),
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
