import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { Response as SupertestResponse } from 'supertest';
import { bodyOf } from './helpers/http-response.js';
import type { App } from 'supertest/types.js';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { GoogleOAuthClient } from '../src/auth/google-oauth.client.js';
import type { VerifiedGoogleIdentity } from '../src/auth/google-oauth.client.js';
import { PrismaService } from '../src/database/prisma.service.js';

const PASSWORD = 'correct-horse-battery-staple';
const TEST_PREFIX = `google-auth-${process.pid}`;
const NEW_GOOGLE_EMAIL = `${TEST_PREFIX}-new@example.com`;
const LINK_EMAIL = `${TEST_PREFIX}-link@example.com`;
const CONFLICT_EMAIL = `${TEST_PREFIX}-conflict@example.com`;

class FakeGoogleOAuthClient {
  private readonly identities = new Map<string, VerifiedGoogleIdentity>();

  createAuthorizationUrl(state: string): string {
    return `https://accounts.google.test/authorize?state=${state}`;
  }

  verifyAuthorizationCode(code: string): Promise<VerifiedGoogleIdentity> {
    const identity = this.identities.get(code);

    if (!identity) {
      throw new Error('Unknown fake Google authorization code');
    }

    return Promise.resolve(identity);
  }

  setIdentity(code: string, identity: VerifiedGoogleIdentity): void {
    this.identities.set(code, identity);
  }
}

describe('JWT access and Google OAuth2 (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let googleClient: FakeGoogleOAuthClient;

  beforeAll(async () => {
    googleClient = new FakeGoogleOAuthClient();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GoogleOAuthClient)
      .useValue(googleClient)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await cleanupUsers();
  });

  it('authenticates a valid access JWT and extracts the current user', async () => {
    await register(LINK_EMAIL);
    const loginResponse = await login(LINK_EMAIL);

    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${bodyOf(loginResponse).accessToken}`)
      .expect(200);

    expect(bodyOf(response)).toMatchObject({
      email: LINK_EMAIL,
      role: 'CUSTOMER',
    });
    expect(bodyOf(response)).not.toHaveProperty('passwordHash');
  });

  it('rejects an invalid access JWT', async () => {
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer invalid.jwt.token')
      .expect(401);
  });

  it('does not expose OAuth query secrets in error responses', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/google/callback')
      .query({
        code: 'sensitive-one-time-authorization-code',
        state: 'invalid-oauth-state-value-000000000000',
      })
      .expect(401);

    expect(bodyOf<{ path: string }>(response).path).toBe(
      '/auth/google/callback',
    );
  });

  it('creates a new Customer from a provider-verified Google identity', async () => {
    googleClient.setIdentity('new-user-code', {
      providerAccountId: 'google-sub-new-user',
      email: NEW_GOOGLE_EMAIL.toUpperCase(),
      emailVerified: true,
    });

    const response = await completeGoogleLogin('new-user-code');

    expect(bodyOf(response).user).toMatchObject({
      email: NEW_GOOGLE_EMAIL,
      role: 'CUSTOMER',
    });
    expect(bodyOf(response).accessToken).toEqual(expect.any(String));
    expect(bodyOf(response).refreshToken).toEqual(expect.any(String));

    const storedUser = await prisma.user.findUniqueOrThrow({
      where: { email: NEW_GOOGLE_EMAIL },
      include: { oauthAccounts: true },
    });
    expect(storedUser.passwordHash).toBeNull();
    expect(storedUser.oauthAccounts).toHaveLength(1);
    expect(storedUser.oauthAccounts[0].providerAccountId).toBe(
      'google-sub-new-user',
    );
  });

  it('reuses an existing provider link without duplicating the user', async () => {
    googleClient.setIdentity('linked-user-code', {
      providerAccountId: 'google-sub-linked-user',
      email: NEW_GOOGLE_EMAIL,
      emailVerified: true,
    });

    const firstLogin = await completeGoogleLogin('linked-user-code');
    const secondLogin = await completeGoogleLogin('linked-user-code');

    expect(bodyOf(secondLogin).user.id).toBe(bodyOf(firstLogin).user.id);
    expect(
      await prisma.user.count({ where: { email: NEW_GOOGLE_EMAIL } }),
    ).toBe(1);
    expect(
      await prisma.oAuthAccount.count({
        where: { providerAccountId: 'google-sub-linked-user' },
      }),
    ).toBe(1);
  });

  it('links a verified Google identity to the existing password user', async () => {
    const registration = await register(LINK_EMAIL);
    googleClient.setIdentity('account-link-code', {
      providerAccountId: 'google-sub-account-link',
      email: LINK_EMAIL.toUpperCase(),
      emailVerified: true,
    });

    const googleLogin = await completeGoogleLogin('account-link-code');

    expect(bodyOf(googleLogin).user.id).toBe(bodyOf(registration).user.id);

    const storedUser = await prisma.user.findUniqueOrThrow({
      where: { email: LINK_EMAIL },
      include: { oauthAccounts: true },
    });
    expect(storedUser.passwordHash).toMatch(/^scrypt\$/);
    expect(storedUser.oauthAccounts).toHaveLength(1);
  });

  it('refuses to replace an existing Google link with another identity', async () => {
    googleClient.setIdentity('first-identity-code', {
      providerAccountId: 'google-sub-first',
      email: CONFLICT_EMAIL,
      emailVerified: true,
    });
    googleClient.setIdentity('second-identity-code', {
      providerAccountId: 'google-sub-second',
      email: CONFLICT_EMAIL,
      emailVerified: true,
    });

    await completeGoogleLogin('first-identity-code');
    await completeGoogleLogin('second-identity-code', 409);

    expect(
      await prisma.oAuthAccount.count({
        where: { user: { email: CONFLICT_EMAIL } },
      }),
    ).toBe(1);
  });

  afterAll(async () => {
    await cleanupUsers();
    await app.close();
  });

  function register(email: string) {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: PASSWORD })
      .expect(201);
  }

  function login(email: string) {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
  }

  async function completeGoogleLogin(
    code: string,
    expectedStatus = 200,
  ): Promise<SupertestResponse> {
    const startResponse = await request(app.getHttpServer())
      .get('/auth/google')
      .expect(302);
    const authorizationUrl = new URL(startResponse.headers.location);
    const state = authorizationUrl.searchParams.get('state');
    const setCookie: unknown = startResponse.headers['set-cookie'];
    const cookie = Array.isArray(setCookie)
      ? (setCookie[0] as unknown)
      : setCookie;

    expect(state).toEqual(expect.any(String));
    expect(cookie).toEqual(expect.any(String));

    return request(app.getHttpServer())
      .get('/auth/google/callback')
      .set('Cookie', typeof cookie === 'string' ? cookie.split(';')[0] : '')
      .query({ code, state })
      .expect(expectedStatus);
  }

  function cleanupUsers() {
    return prisma.user.deleteMany({
      where: { email: { startsWith: TEST_PREFIX } },
    });
  }
});
