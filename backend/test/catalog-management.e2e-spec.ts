import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { UserRole } from '../src/generated/prisma/client.js';

const PASSWORD = 'correct-horse-battery-staple';
const TEST_PREFIX = `catalog-management-${process.pid}`;
const ADMIN_EMAIL = `${TEST_PREFIX}-admin@example.com`;
const SELLER_A_EMAIL = `${TEST_PREFIX}-seller-a@example.com`;
const SELLER_B_EMAIL = `${TEST_PREFIX}-seller-b@example.com`;
const CUSTOMER_EMAIL = `${TEST_PREFIX}-customer@example.com`;

describe('Category and Seller Product management (e2e)', () => {
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

  beforeEach(async () => {
    await cleanup();
  });

  it('allows only Admins to mutate Categories', async () => {
    const adminToken = await createAdminAndLogin();
    const customerToken = await registerAndLogin(CUSTOMER_EMAIL);

    await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: `${TEST_PREFIX} Forbidden` })
      .expect(403);

    const created = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `  ${TEST_PREFIX} Electronics  ` })
      .expect(201);

    expect(created.body.name).toBe(`${TEST_PREFIX} Electronics`);

    const list = await request(app.getHttpServer())
      .get('/categories')
      .expect(200);
    expect(list.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: created.body.id }),
      ]),
    );

    await request(app.getHttpServer())
      .patch(`/categories/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `${TEST_PREFIX} Keyboards` })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/categories/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);
  });

  it('isolates Products by Seller ownership', async () => {
    const adminToken = await createAdminAndLogin();
    const sellerAToken = await createApprovedSeller(
      SELLER_A_EMAIL,
      'Seller A',
      adminToken,
    );
    const sellerBToken = await createApprovedSeller(
      SELLER_B_EMAIL,
      'Seller B',
      adminToken,
    );
    const category = await createCategory(adminToken, 'Ownership');
    const product = await createProduct(sellerAToken, category.id);

    const sellerAList = await request(app.getHttpServer())
      .get('/seller/products')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .expect(200);
    expect(sellerAList.body).toHaveLength(1);

    const sellerBList = await request(app.getHttpServer())
      .get('/seller/products')
      .set('Authorization', `Bearer ${sellerBToken}`)
      .expect(200);
    expect(sellerBList.body).toHaveLength(0);

    await request(app.getHttpServer())
      .get(`/seller/products/${product.id}`)
      .set('Authorization', `Bearer ${sellerBToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/seller/products/${product.id}`)
      .set('Authorization', `Bearer ${sellerBToken}`)
      .send({ title: 'Stolen Product' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/seller/products/${product.id}`)
      .set('Authorization', `Bearer ${sellerBToken}`)
      .expect(404);
  });

  it('requires an approved SellerProfile and derives seller identity', async () => {
    const adminToken = await createAdminAndLogin();
    const category = await createCategory(adminToken, 'Identity');
    const token = await registerAndLogin(CUSTOMER_EMAIL);
    await prisma.user.update({
      where: { email: CUSTOMER_EMAIL },
      data: { role: UserRole.SELLER },
    });

    await request(app.getHttpServer())
      .post('/seller/products')
      .set('Authorization', `Bearer ${token}`)
      .send(productPayload(category.id))
      .expect(403);

    const sellerToken = await createApprovedSeller(
      SELLER_A_EMAIL,
      'Derived Seller',
      adminToken,
    );

    await request(app.getHttpServer())
      .post('/seller/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        ...productPayload(category.id),
        sellerId: randomUUID(),
      })
      .expect(400);
  });

  it('rejects an unknown Category', async () => {
    const adminToken = await createAdminAndLogin();
    const sellerToken = await createApprovedSeller(
      SELLER_A_EMAIL,
      'Invalid Category Seller',
      adminToken,
    );

    await request(app.getHttpServer())
      .post('/seller/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send(productPayload(randomUUID()))
      .expect(404);
  });

  it('validates Product price, stock, image URL and unsupported Auction type', async () => {
    const adminToken = await createAdminAndLogin();
    const sellerToken = await createApprovedSeller(
      SELLER_A_EMAIL,
      'Validation Seller',
      adminToken,
    );
    const category = await createCategory(adminToken, 'Validation');

    await request(app.getHttpServer())
      .post('/seller/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ ...productPayload(category.id), price: '-1.00' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/seller/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ ...productPayload(category.id), price: '10.999' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/seller/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ ...productPayload(category.id), stock: -1 })
      .expect(400);

    await request(app.getHttpServer())
      .post('/seller/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ ...productPayload(category.id), imageUrl: 'not-a-url' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/seller/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ ...productPayload(category.id), type: 'AUCTION', price: null })
      .expect(400);
  });

  it('enforces Product publication and archive lifecycle transitions', async () => {
    const adminToken = await createAdminAndLogin();
    const sellerToken = await createApprovedSeller(
      SELLER_A_EMAIL,
      'Lifecycle Seller',
      adminToken,
    );
    const category = await createCategory(adminToken, 'Lifecycle');
    const product = await createProduct(sellerToken, category.id);

    expect(product.status).toBe('DRAFT');

    const updated = await request(app.getHttpServer())
      .patch(`/seller/products/${product.id}`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ price: '24.50', stock: 3 })
      .expect(200);
    expect(Number(updated.body.price)).toBe(24.5);

    const publication = await request(app.getHttpServer())
      .patch(`/seller/products/${product.id}/request-publication`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(200);
    expect(publication.body.status).toBe('PENDING_REVIEW');

    await request(app.getHttpServer())
      .patch(`/seller/products/${product.id}`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ stock: 4 })
      .expect(409);

    await request(app.getHttpServer())
      .patch(`/seller/products/${product.id}/request-publication`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(409);

    const archived = await request(app.getHttpServer())
      .delete(`/seller/products/${product.id}`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(200);
    expect(archived.body.status).toBe('ARCHIVED');

    await request(app.getHttpServer())
      .patch(`/seller/products/${product.id}/request-publication`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(409);
  });

  it('prevents deletion of a Category referenced by a Product', async () => {
    const adminToken = await createAdminAndLogin();
    const sellerToken = await createApprovedSeller(
      SELLER_A_EMAIL,
      'Reference Seller',
      adminToken,
    );
    const category = await createCategory(adminToken, 'Referenced');
    await createProduct(sellerToken, category.id);

    await request(app.getHttpServer())
      .delete(`/categories/${category.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);

    expect(
      await prisma.category.findUnique({ where: { id: category.id } }),
    ).not.toBeNull();
  });

  afterAll(async () => {
    if (!prisma || !app) {
      return;
    }

    await cleanup();
    await app.close();
  });

  async function registerAndLogin(email: string): Promise<string> {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: PASSWORD })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);

    return login.body.accessToken as string;
  }

  async function createAdminAndLogin(): Promise<string> {
    await registerAndLogin(ADMIN_EMAIL);
    await prisma.user.update({
      where: { email: ADMIN_EMAIL },
      data: { role: UserRole.ADMIN },
    });

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: ADMIN_EMAIL, password: PASSWORD })
      .expect(200);

    return login.body.accessToken as string;
  }

  async function createApprovedSeller(
    email: string,
    displayName: string,
    adminToken: string,
  ): Promise<string> {
    const sellerToken = await registerAndLogin(email);
    const application = await request(app.getHttpServer())
      .post('/seller-applications')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ displayName })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/seller-applications/${application.body.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    return sellerToken;
  }

  async function createCategory(adminToken: string, suffix: string) {
    const response = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `${TEST_PREFIX} ${suffix}` })
      .expect(201);

    return response.body as { id: string; name: string };
  }

  async function createProduct(sellerToken: string, categoryId: string) {
    const response = await request(app.getHttpServer())
      .post('/seller/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send(productPayload(categoryId))
      .expect(201);

    return response.body as { id: string; status: string };
  }

  function productPayload(categoryId: string) {
    return {
      categoryId,
      title: 'Mechanical Keyboard',
      description: 'Hot-swappable mechanical keyboard.',
      imageUrl: 'https://example.com/product.jpg',
      type: 'FIXED_PRICE',
      price: '19.99',
      stock: 5,
    };
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
