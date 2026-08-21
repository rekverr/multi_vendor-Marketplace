import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { UserRole } from '../src/generated/prisma/client.js';
import { bodyOf } from './helpers/http-response.js';

const PASSWORD = 'correct-horse-battery-staple';
const TEST_PREFIX = `seller-onboarding-${process.pid}`;
const CUSTOMER_EMAIL = `${TEST_PREFIX}-customer@example.com`;
const ADMIN_EMAIL = `${TEST_PREFIX}-admin@example.com`;

describe('RBAC and Seller onboarding (e2e)', () => {
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
    await cleanupUsers();
  });

  it('rejects unauthenticated access', async () => {
    await request(app.getHttpServer())
      .post('/seller-applications')
      .send({ displayName: 'Unauthenticated Store' })
      .expect(401);
  });

  it('enforces Customer and Admin role restrictions', async () => {
    const customerToken = await createUserAndLogin(CUSTOMER_EMAIL);

    await request(app.getHttpServer())
      .get('/seller-applications')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);

    await prisma.user.update({
      where: { email: CUSTOMER_EMAIL },
      data: { role: UserRole.SELLER },
    });

    await request(app.getHttpServer())
      .post('/seller-applications')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ displayName: 'Seller Cannot Reapply' })
      .expect(403);
  });

  it('submits a pending application without allowing role assignment', async () => {
    const customerToken = await createUserAndLogin(CUSTOMER_EMAIL);

    await request(app.getHttpServer())
      .post('/seller-applications')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ displayName: 'Unsafe Store', role: 'SELLER' })
      .expect(400);

    const response = await submitApplication(customerToken, 'Customer Store');

    expect(bodyOf(response)).toMatchObject({
      displayName: 'Customer Store',
      status: 'PENDING',
      reviewedById: null,
      reviewedAt: null,
      rejectionReason: null,
      user: { email: CUSTOMER_EMAIL, role: 'CUSTOMER' },
    });

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: CUSTOMER_EMAIL },
    });
    expect(user.role).toBe(UserRole.CUSTOMER);
  });

  it('rejects a duplicate active application', async () => {
    const customerToken = await createUserAndLogin(CUSTOMER_EMAIL);
    await submitApplication(customerToken, 'First Store');

    await request(app.getHttpServer())
      .post('/seller-applications')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ displayName: 'Second Store' })
      .expect(409);
  });

  it('allows an Admin to list, read and approve an application atomically', async () => {
    const customerToken = await createUserAndLogin(CUSTOMER_EMAIL);
    const adminToken = await createAdminAndLogin();
    const application = await submitApplication(
      customerToken,
      'Approved Store',
    );

    const listResponse = await request(app.getHttpServer())
      .get('/seller-applications')
      .query({ status: 'PENDING' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(bodyOf<unknown[]>(listResponse)).toHaveLength(1);

    await request(app.getHttpServer())
      .get(`/seller-applications/${bodyOf(application).id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const approval = await request(app.getHttpServer())
      .patch(`/seller-applications/${bodyOf(application).id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(bodyOf(approval)).toMatchObject({
      status: 'APPROVED',
      rejectionReason: null,
      reviewedBy: { email: ADMIN_EMAIL },
      user: { email: CUSTOMER_EMAIL, role: 'SELLER' },
    });
    expect(bodyOf(approval).reviewedAt).toEqual(expect.any(String));

    const promotedUser = await prisma.user.findUniqueOrThrow({
      where: { email: CUSTOMER_EMAIL },
      include: { sellerProfile: true },
    });
    expect(promotedUser.role).toBe(UserRole.SELLER);
    expect(promotedUser.sellerProfile?.displayName).toBe('Approved Store');

    const currentUser = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    expect(bodyOf(currentUser).role).toBe('SELLER');
  });

  it('allows an Admin to reject an application with review metadata', async () => {
    const customerToken = await createUserAndLogin(CUSTOMER_EMAIL);
    const adminToken = await createAdminAndLogin();
    const application = await submitApplication(
      customerToken,
      'Rejected Store',
    );

    const rejection = await request(app.getHttpServer())
      .patch(`/seller-applications/${bodyOf(application).id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Insufficient business information' })
      .expect(200);

    expect(bodyOf(rejection)).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'Insufficient business information',
      reviewedBy: { email: ADMIN_EMAIL },
      user: { role: 'CUSTOMER' },
    });
    expect(bodyOf(rejection).reviewedAt).toEqual(expect.any(String));

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: CUSTOMER_EMAIL },
      include: { sellerProfile: true },
    });
    expect(user.role).toBe(UserRole.CUSTOMER);
    expect(user.sellerProfile).toBeNull();
  });

  it('rejects an invalid application transition', async () => {
    const customerToken = await createUserAndLogin(CUSTOMER_EMAIL);
    const adminToken = await createAdminAndLogin();
    const application = await submitApplication(customerToken, 'Final Store');

    await request(app.getHttpServer())
      .patch(`/seller-applications/${bodyOf(application).id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Rejected once' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/seller-applications/${bodyOf(application).id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);
  });

  it('prevents a non-Admin from moderating applications', async () => {
    const customerToken = await createUserAndLogin(CUSTOMER_EMAIL);
    const application = await submitApplication(
      customerToken,
      'Protected Store',
    );

    await request(app.getHttpServer())
      .patch(`/seller-applications/${bodyOf(application).id}/approve`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
  });

  it('allows exactly one concurrent approval', async () => {
    const customerToken = await createUserAndLogin(CUSTOMER_EMAIL);
    const adminToken = await createAdminAndLogin();
    const application = await submitApplication(
      customerToken,
      'Race Safe Store',
    );

    const responses = await Promise.all([
      request(app.getHttpServer())
        .patch(`/seller-applications/${bodyOf(application).id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`),
      request(app.getHttpServer())
        .patch(`/seller-applications/${bodyOf(application).id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: CUSTOMER_EMAIL },
      include: { sellerProfile: true },
    });
    expect(user.role).toBe(UserRole.SELLER);
    expect(user.sellerProfile).not.toBeNull();
    expect(
      await prisma.sellerProfile.count({ where: { userId: user.id } }),
    ).toBe(1);
  });

  afterAll(async () => {
    if (!prisma || !app) {
      return;
    }

    await cleanupUsers();
    await app.close();
  });

  async function createUserAndLogin(email: string): Promise<string> {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: PASSWORD })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);

    return bodyOf(login).accessToken;
  }

  async function createAdminAndLogin(): Promise<string> {
    await createUserAndLogin(ADMIN_EMAIL);
    await prisma.user.update({
      where: { email: ADMIN_EMAIL },
      data: { role: UserRole.ADMIN },
    });

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: ADMIN_EMAIL, password: PASSWORD })
      .expect(200);

    return bodyOf(login).accessToken;
  }

  function submitApplication(accessToken: string, displayName: string) {
    return request(app.getHttpServer())
      .post('/seller-applications')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ displayName })
      .expect(201);
  }

  function cleanupUsers() {
    const users = { email: { startsWith: TEST_PREFIX } };

    return prisma.$transaction([
      prisma.sellerProfile.deleteMany({ where: { user: users } }),
      prisma.user.deleteMany({ where: users }),
    ]);
  }
});
