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
        where: { aggregateId: { in: await productIds() } },
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
