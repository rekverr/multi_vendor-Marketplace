import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/database/prisma.service.js';
import {
  AuctionStatus,
  ProductStatus,
  UserRole,
} from '../src/generated/prisma/client.js';

const TEST_PREFIX = `auctions-${process.pid}`;
const PASSWORD = 'correct-horse-battery-staple';

describe('Base Auction domain (e2e)', () => {
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

  it('allows only the owning approved Seller to configure an Auction Product', async () => {
    const firstSeller = await createSeller('owner-a');
    const secondSeller = await createSeller('owner-b');
    const categoryId = await createCategory('ownership');
    const auctionProduct = await createProduct(
      firstSeller.token,
      categoryId,
      'AUCTION',
      1,
    );
    const fixedProduct = await createProduct(
      firstSeller.token,
      categoryId,
      'FIXED_PRICE',
      1,
    );
    const configuration = validConfiguration();

    const created = await request(app.getHttpServer())
      .put(`/seller/products/${auctionProduct.id}/auction`)
      .set('Authorization', `Bearer ${firstSeller.token}`)
      .send(configuration)
      .expect(200);
    expect(created.body).toMatchObject({
      productId: auctionProduct.id,
      status: AuctionStatus.SCHEDULED,
      startingPrice: '25',
      minimumIncrement: '2.5',
    });

    await request(app.getHttpServer())
      .get(`/seller/products/${auctionProduct.id}/auction`)
      .set('Authorization', `Bearer ${secondSeller.token}`)
      .expect(404);
    await request(app.getHttpServer())
      .put(`/seller/products/${auctionProduct.id}/auction`)
      .set('Authorization', `Bearer ${secondSeller.token}`)
      .send(configuration)
      .expect(404);
    await request(app.getHttpServer())
      .put(`/seller/products/${fixedProduct.id}/auction`)
      .set('Authorization', `Bearer ${firstSeller.token}`)
      .send(configuration)
      .expect(409);
  });

  it('validates Product type pricing, Auction values, stock and timing', async () => {
    const seller = await createSeller('validation');
    const categoryId = await createCategory('validation');

    await request(app.getHttpServer())
      .post('/seller/products')
      .set('Authorization', `Bearer ${seller.token}`)
      .send(productPayload(categoryId, 'AUCTION', 1, '10.00'))
      .expect(400);
    const product = await createProduct(seller.token, categoryId, 'AUCTION', 1);
    const multiStock = await createProduct(
      seller.token,
      categoryId,
      'AUCTION',
      2,
      'Multi-stock Auction',
    );

    for (const invalid of [
      { ...validConfiguration(), startingPrice: '0.00' },
      { ...validConfiguration(), minimumIncrement: '-1.00' },
      {
        ...validConfiguration(),
        startsAt: new Date(Date.now() - 60_000).toISOString(),
      },
      {
        ...validConfiguration(),
        startsAt: new Date(Date.now() + 120_000).toISOString(),
        endsAt: new Date(Date.now() + 60_000).toISOString(),
      },
    ]) {
      await request(app.getHttpServer())
        .put(`/seller/products/${product.id}/auction`)
        .set('Authorization', `Bearer ${seller.token}`)
        .send(invalid)
        .expect(400);
    }
    await request(app.getHttpServer())
      .put(`/seller/products/${multiStock.id}/auction`)
      .set('Authorization', `Bearer ${seller.token}`)
      .send(validConfiguration())
      .expect(409);
  });

  it('prevents configuration changes after Auction lifecycle starts', async () => {
    const seller = await createSeller('lifecycle');
    const categoryId = await createCategory('lifecycle');
    const product = await createProduct(seller.token, categoryId, 'AUCTION', 1);
    const created = await request(app.getHttpServer())
      .put(`/seller/products/${product.id}/auction`)
      .set('Authorization', `Bearer ${seller.token}`)
      .send(validConfiguration())
      .expect(200);
    await prisma.auction.update({
      where: { id: created.body.id as string },
      data: { status: AuctionStatus.ACTIVE },
    });

    await request(app.getHttpServer())
      .put(`/seller/products/${product.id}/auction`)
      .set('Authorization', `Bearer ${seller.token}`)
      .send(validConfiguration(20))
      .expect(409);
  });

  it('exposes published Auction details and anonymous recent bid fields', async () => {
    const seller = await createSeller('public');
    const categoryId = await createCategory('public');
    const product = await createProduct(seller.token, categoryId, 'AUCTION', 1);
    const configured = await request(app.getHttpServer())
      .put(`/seller/products/${product.id}/auction`)
      .set('Authorization', `Bearer ${seller.token}`)
      .send(validConfiguration())
      .expect(200);

    await request(app.getHttpServer())
      .get(`/auctions/${configured.body.id}`)
      .expect(404);
    await prisma.product.update({
      where: { id: product.id },
      data: { status: ProductStatus.PUBLISHED, publishedAt: new Date() },
    });
    const bidder = await prisma.user.create({
      data: { email: `${TEST_PREFIX}-bidder@example.com` },
    });
    const bid = await prisma.bid.create({
      data: {
        auctionId: configured.body.id as string,
        bidderId: bidder.id,
        amount: '30.00',
        idempotencyKey: 'public-history-bid',
      },
    });
    await prisma.auction.update({
      where: { id: configured.body.id as string },
      data: { currentHighestBidId: bid.id, version: 1 },
    });

    const response = await request(app.getHttpServer())
      .get(`/auctions/${configured.body.id}`)
      .expect(200);
    expect(response.body).toMatchObject({
      id: configured.body.id,
      bidCount: 1,
      currentHighestBid: { id: bid.id, amount: '30' },
      product: {
        id: product.id,
        seller: { displayName: `${TEST_PREFIX}-public` },
      },
    });
    expect(response.body.bids[0]).toEqual({
      id: bid.id,
      amount: '30',
      createdAt: expect.any(String),
    });
    expect(response.body.bids[0]).not.toHaveProperty('bidderId');
    expect(response.body).not.toHaveProperty('winnerId');
  });

  it('accepts valid bids and rejects minimum, eligibility and deadline violations', async () => {
    const fixture = await createActiveAuction('bid-rules');
    const customer = await createCustomer('bid-rules-customer');

    const accepted = await placeBid(
      fixture.auctionId,
      customer.token,
      'bid-rules-first',
      '25.00',
      201,
    );
    expect(accepted.body.amount).toBe('25');
    await placeBid(
      fixture.auctionId,
      customer.token,
      'bid-rules-low',
      '27.49',
      409,
    );
    await request(app.getHttpServer())
      .post(`/auctions/${fixture.auctionId}/bids`)
      .set('Authorization', `Bearer ${fixture.seller.token}`)
      .set('Idempotency-Key', 'seller-cannot-bid')
      .send({ amount: '30.00' })
      .expect(403);

    await prisma.auction.update({
      where: { id: fixture.auctionId },
      data: { endsAt: new Date(Date.now() - 1000) },
    });
    await placeBid(
      fixture.auctionId,
      customer.token,
      'bid-after-deadline',
      '30.00',
      409,
    );
    expect(
      await prisma.bid.count({ where: { auctionId: fixture.auctionId } }),
    ).toBe(1);
  });

  it('serializes concurrent bids without losing the authoritative highest bid', async () => {
    const fixture = await createActiveAuction('concurrent');
    const firstCustomer = await createCustomer('concurrent-a');
    const secondCustomer = await createCustomer('concurrent-b');

    const [lower, higher] = await Promise.all([
      placeBid(
        fixture.auctionId,
        firstCustomer.token,
        'concurrent-lower',
        '30.00',
      ),
      placeBid(
        fixture.auctionId,
        secondCustomer.token,
        'concurrent-higher',
        '40.00',
      ),
    ]);

    expect(higher.status).toBe(201);
    expect([201, 409]).toContain(lower.status);
    const auction = await prisma.auction.findUniqueOrThrow({
      where: { id: fixture.auctionId },
      include: { currentHighestBid: true, bids: true },
    });
    expect(auction.currentHighestBid?.amount.toFixed(2)).toBe('40.00');
    expect(auction.bids).toHaveLength(lower.status === 201 ? 2 : 1);
    expect(auction.version).toBe(auction.bids.length);
    expect(
      await prisma.outboxEvent.count({
        where: {
          aggregateId: fixture.auctionId,
          eventType: 'AUCTION_BID_ACCEPTED',
        },
      }),
    ).toBe(auction.bids.length);
  });

  it('reuses an accepted Bid for exact retries and rejects conflicting key reuse', async () => {
    const fixture = await createActiveAuction('bid-retry');
    const customer = await createCustomer('bid-retry-customer');

    const first = await placeBid(
      fixture.auctionId,
      customer.token,
      'same-bid-request',
      '25.00',
      201,
    );
    const retry = await placeBid(
      fixture.auctionId,
      customer.token,
      'same-bid-request',
      '25.00',
      201,
    );
    expect(retry.body.id).toBe(first.body.id);
    await placeBid(
      fixture.auctionId,
      customer.token,
      'same-bid-request',
      '30.00',
      409,
    );
    expect(
      await prisma.bid.count({ where: { auctionId: fixture.auctionId } }),
    ).toBe(1);
  });

  it('finalizes once and expires winner eligibility idempotently', async () => {
    const fixture = await createActiveAuction('finalization');
    const customer = await createCustomer('finalization-winner');
    const adminToken = await createAdmin('finalization-admin');
    const bid = await placeBid(
      fixture.auctionId,
      customer.token,
      'winning-bid-request',
      '35.00',
      201,
    );
    await prisma.auction.update({
      where: { id: fixture.auctionId },
      data: { endsAt: new Date(Date.now() - 1000) },
    });

    const finalized = await request(app.getHttpServer())
      .post(`/admin/auctions/${fixture.auctionId}/finalize`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    const repeated = await request(app.getHttpServer())
      .post(`/admin/auctions/${fixture.auctionId}/finalize`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect(repeated.body.id).toBe(finalized.body.id);
    expect(finalized.body).toMatchObject({
      status: AuctionStatus.SOLD,
      currentHighestBidId: bid.body.id,
      winnerId: customer.userId,
      winningPrice: '35',
    });
    expect(finalized.body.winnerCheckoutExpiresAt).toEqual(expect.any(String));
    expect(
      await prisma.outboxEvent.count({
        where: {
          aggregateId: fixture.auctionId,
          eventType: 'AUCTION_FINALIZED',
        },
      }),
    ).toBe(1);

    await request(app.getHttpServer())
      .post(`/admin/auctions/${fixture.auctionId}/expire-winner-window`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);

    await prisma.auction.update({
      where: { id: fixture.auctionId },
      data: { winnerCheckoutExpiresAt: new Date(Date.now() - 1000) },
    });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const expired = await request(app.getHttpServer())
        .post(`/admin/auctions/${fixture.auctionId}/expire-winner-window`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);
      expect(expired.body.status).toBe(AuctionStatus.UNSOLD);
    }
    expect(
      (
        await prisma.product.findUniqueOrThrow({
          where: { id: fixture.productId },
        })
      ).status,
    ).toBe(ProductStatus.DRAFT);
    expect(
      await prisma.outboxEvent.count({
        where: {
          aggregateId: fixture.auctionId,
          eventType: 'AUCTION_WINNER_WINDOW_EXPIRED',
        },
      }),
    ).toBe(1);
  });

  it('idempotently finalizes an expired Auction without bids as UNSOLD', async () => {
    const fixture = await createActiveAuction('unsold-finalization');
    const adminToken = await createAdmin('unsold-finalization-admin');
    await prisma.auction.update({
      where: { id: fixture.auctionId },
      data: { endsAt: new Date(Date.now() - 1000) },
    });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await request(app.getHttpServer())
        .post(`/admin/auctions/${fixture.auctionId}/finalize`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);
      expect(response.body.status).toBe(AuctionStatus.UNSOLD);
      expect(response.body.winnerId).toBeNull();
    }
    expect(
      await prisma.outboxEvent.count({
        where: {
          aggregateId: fixture.auctionId,
          eventType: 'AUCTION_FINALIZED',
        },
      }),
    ).toBe(1);
  });

  afterAll(async () => {
    if (!prisma || !app) return;
    await cleanup();
    await app.close();
  });

  async function createSeller(suffix: string) {
    const email = `${TEST_PREFIX}-${suffix}@example.com`;
    const registration = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: PASSWORD })
      .expect(201);
    await prisma.user.update({
      where: { id: registration.body.user.id as string },
      data: { role: UserRole.SELLER },
    });
    const seller = await prisma.sellerProfile.create({
      data: {
        userId: registration.body.user.id as string,
        displayName: `${TEST_PREFIX}-${suffix}`,
      },
    });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return { sellerId: seller.id, token: login.body.accessToken as string };
  }

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
      userId: registration.body.user.id as string,
      token: login.body.accessToken as string,
    };
  }

  async function createAdmin(suffix: string): Promise<string> {
    const customer = await createCustomer(suffix);
    await prisma.user.update({
      where: { id: customer.userId },
      data: { role: UserRole.ADMIN },
    });
    const email = `${TEST_PREFIX}-${suffix}@example.com`;
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return login.body.accessToken as string;
  }

  async function createActiveAuction(suffix: string) {
    const seller = await createSeller(`${suffix}-seller`);
    const categoryId = await createCategory(suffix);
    const product = await createProduct(
      seller.token,
      categoryId,
      'AUCTION',
      1,
      `${suffix} Auction Product`,
    );
    const configured = await request(app.getHttpServer())
      .put(`/seller/products/${product.id}/auction`)
      .set('Authorization', `Bearer ${seller.token}`)
      .send(validConfiguration())
      .expect(200);
    await prisma.product.update({
      where: { id: product.id },
      data: { status: ProductStatus.PUBLISHED, publishedAt: new Date() },
    });
    await prisma.auction.update({
      where: { id: configured.body.id as string },
      data: {
        status: AuctionStatus.ACTIVE,
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 60 * 60_000),
      },
    });
    return {
      seller,
      productId: product.id,
      auctionId: configured.body.id as string,
    };
  }

  function placeBid(
    auctionId: string,
    token: string,
    idempotencyKey: string,
    amount: string,
    expectedStatus?: number,
  ) {
    const operation = request(app.getHttpServer())
      .post(`/auctions/${auctionId}/bids`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ amount });
    return expectedStatus === undefined
      ? operation
      : operation.expect(expectedStatus);
  }

  async function createCategory(suffix: string): Promise<string> {
    return (
      await prisma.category.create({
        data: { name: `${TEST_PREFIX}-${suffix}` },
      })
    ).id;
  }

  async function createProduct(
    token: string,
    categoryId: string,
    type: 'FIXED_PRICE' | 'AUCTION',
    stock: number,
    title = `${type} Product`,
  ) {
    const response = await request(app.getHttpServer())
      .post('/seller/products')
      .set('Authorization', `Bearer ${token}`)
      .send(
        productPayload(
          categoryId,
          type,
          stock,
          type === 'FIXED_PRICE' ? '10.00' : undefined,
          title,
        ),
      )
      .expect(201);
    return response.body as { id: string };
  }

  function productPayload(
    categoryId: string,
    type: 'FIXED_PRICE' | 'AUCTION',
    stock: number,
    price?: string,
    title = `${type} Product`,
  ) {
    return {
      categoryId,
      title,
      description: `${title} description`,
      type,
      stock,
      ...(price === undefined ? {} : { price }),
    };
  }

  function validConfiguration(offsetMinutes = 10) {
    const startsAt = new Date(Date.now() + offsetMinutes * 60_000);
    return {
      startingPrice: '25.00',
      minimumIncrement: '2.50',
      startsAt: startsAt.toISOString(),
      endsAt: new Date(startsAt.getTime() + 60 * 60_000).toISOString(),
    };
  }

  async function cleanup() {
    const users = { email: { startsWith: TEST_PREFIX } };
    const categories = { name: { startsWith: TEST_PREFIX } };
    const auctionIds = (
      await prisma.auction.findMany({
        where: { product: { seller: { user: users } } },
        select: { id: true },
      })
    ).map((auction) => auction.id);
    const existingProductIds = await productIds();
    await prisma.auction.updateMany({
      where: { product: { seller: { user: users } } },
      data: { currentHighestBidId: null, winnerId: null },
    });
    await prisma.$transaction([
      prisma.bid.deleteMany({
        where: { auction: { product: { seller: { user: users } } } },
      }),
      prisma.auction.deleteMany({
        where: { product: { seller: { user: users } } },
      }),
      prisma.outboxEvent.deleteMany({
        where: {
          aggregateId: { in: [...existingProductIds, ...auctionIds] },
        },
      }),
      prisma.product.deleteMany({
        where: { OR: [{ seller: { user: users } }, { category: categories }] },
      }),
      prisma.category.deleteMany({ where: categories }),
      prisma.sellerProfile.deleteMany({ where: { user: users } }),
      prisma.refreshSession.deleteMany({ where: { user: users } }),
      prisma.user.deleteMany({ where: users }),
    ]);
  }

  async function productIds(): Promise<string[]> {
    return (
      await prisma.product.findMany({
        where: { seller: { user: { email: { startsWith: TEST_PREFIX } } } },
        select: { id: true },
      })
    ).map((product) => product.id);
  }
});
