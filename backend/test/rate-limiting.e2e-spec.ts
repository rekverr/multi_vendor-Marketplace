import { randomUUID } from 'node:crypto';

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';

import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { bodyOf } from './helpers/http-response.js';

const EMAIL = `rate-limit-${process.pid}@example.com`;
const PASSWORD = 'correct-horse-battery-staple';

describe('Rate limiting (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessToken: string;

  beforeAll(async () => {
    process.env.RATE_LIMIT_LOGIN_MAX = '3';
    process.env.RATE_LIMIT_LOGIN_TTL_SECONDS = '60';
    process.env.RATE_LIMIT_BID_MAX = '2';
    process.env.RATE_LIMIT_BID_TTL_SECONDS = '60';

    const { AppModule } = await import('../src/app.module.js');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.user.deleteMany({ where: { email: EMAIL } });

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(200);

    accessToken = bodyOf(loginResponse).accessToken;
  });

  it('limits bid creation independently from other routes', async () => {
    const auctionId = randomUUID();

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await request(app.getHttpServer())
        .post(`/auctions/${auctionId}/bids`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Idempotency-Key', randomUUID())
        .send({ amount: '100.00' })
        .expect(404);
    }

    await request(app.getHttpServer())
      .post(`/auctions/${auctionId}/bids`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({ amount: '100.00' })
      .expect(429);
  });

  it('limits repeated login attempts without affecting registration', async () => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: EMAIL, password: 'wrong-password' })
        .expect(401);
    }

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: 'wrong-password' })
      .expect(429);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(409);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await app.close();
  });
});
