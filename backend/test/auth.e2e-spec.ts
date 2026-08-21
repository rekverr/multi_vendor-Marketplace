import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { bodyOf } from './helpers/http-response.js';

const PASSWORD = 'correct-horse-battery-staple';
const EMAIL = `auth-test-${process.pid}@example.com`;

describe('Email/password authentication (e2e)', () => {
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
    await prisma.user.deleteMany({
      where: { email: EMAIL },
    });
  });

  it('registers a normalized Customer without exposing passwordHash', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `  ${EMAIL.toUpperCase()}  `, password: PASSWORD })
      .expect(201);

    expect(bodyOf(response)).toMatchObject({
      user: {
        email: EMAIL,
        role: 'CUSTOMER',
      },
    });
    expect(bodyOf(response).user).not.toHaveProperty('passwordHash');

    const storedUser = await prisma.user.findUniqueOrThrow({
      where: { email: EMAIL },
    });
    expect(storedUser.passwordHash).not.toBe(PASSWORD);
    expect(storedUser.passwordHash).toMatch(/^scrypt\$/);
  });

  it('rejects duplicate registration', async () => {
    await register();

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: EMAIL.toUpperCase(), password: PASSWORD })
      .expect(409);
  });

  it('logs in and stores only a hash of the refresh token', async () => {
    await register();

    const response = await login();

    expect(bodyOf(response).user).toMatchObject({
      email: EMAIL,
      role: 'CUSTOMER',
    });
    expect(bodyOf(response).user).not.toHaveProperty('passwordHash');
    expect(bodyOf(response).accessToken.split('.')).toHaveLength(3);
    expect(bodyOf(response).refreshToken).toEqual(expect.any(String));

    const session = await prisma.refreshSession.findFirstOrThrow({
      where: { user: { email: EMAIL } },
    });
    expect(session.tokenHash).not.toBe(bodyOf(response).refreshToken);
    expect(session.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns the same invalid-credentials response for bad login attempts', async () => {
    await register();

    const wrongPassword = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: 'not-the-password' })
      .expect(401);

    const unknownEmail = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'unknown@example.com', password: PASSWORD })
      .expect(401);

    expect(bodyOf(wrongPassword).message).toBe('Invalid email or password');
    expect(bodyOf(unknownEmail).message).toBe(bodyOf(wrongPassword).message);
  });

  it('rotates a valid refresh token and revokes the previous session', async () => {
    await register();
    const loginResponse = await login();
    const oldRefreshToken = bodyOf(loginResponse).refreshToken;

    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: oldRefreshToken })
      .expect(200);

    expect(bodyOf(response).refreshToken).not.toBe(oldRefreshToken);
    expect(bodyOf(response).accessToken.split('.')).toHaveLength(3);

    const oldSessionId = oldRefreshToken.split('.')[0];
    const oldSession = await prisma.refreshSession.findUniqueOrThrow({
      where: { id: oldSessionId },
    });
    expect(oldSession.revokedAt).toBeInstanceOf(Date);
  });

  it('rejects malformed and revoked refresh tokens', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'invalid-token' })
      .expect(401);

    await register();
    const loginResponse = await login();
    const refreshToken = bodyOf(loginResponse).refreshToken;

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });

  it('logs out idempotently and prevents further refresh', async () => {
    await register();
    const loginResponse = await login();
    const refreshToken = bodyOf(loginResponse).refreshToken;

    await request(app.getHttpServer())
      .post('/auth/logout')
      .send({ refreshToken })
      .expect(204);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .send({ refreshToken })
      .expect(204);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: EMAIL },
    });
    await app.close();
  });

  function register() {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(201);
  }

  function login() {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(200);
  }
});
