import { INestApplication, UnauthorizedException } from '@nestjs/common';
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
import { OAuthProvider, UserRole } from '../src/generated/prisma/client.js';

const PASSWORD = 'correct-horse-battery-staple';
const TEST_PREFIX = `google-auth-${process.pid}`;
const NEW_GOOGLE_EMAIL = `${TEST_PREFIX}-new@example.com`;
const LINK_EMAIL = `${TEST_PREFIX}-link@example.com`;
const CONFLICT_EMAIL = `${TEST_PREFIX}-conflict@example.com`;
const OTHER_EMAIL = `${TEST_PREFIX}-other@example.com`;

class FakeGoogleOAuthClient {
  private readonly identities = new Map<string, VerifiedGoogleIdentity>();

  createAuthorizationUrl(state: string): string {
    return `https://accounts.google.test/authorize?state=${state}`;
  }

  verifyAuthorizationCode(code: string): Promise<VerifiedGoogleIdentity> {
    const identity = this.identities.get(code);

    if (!identity) {
      throw new UnauthorizedException('Google authentication failed');
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
    expect(
      await prisma.refreshSession.count({ where: { userId: storedUser.id } }),
    ).toBe(1);
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

  it('preserves the existing role, password and Seller relation when linking', async () => {
    const registration = await register(LINK_EMAIL);
    const userId = bodyOf(registration).user.id;
    await prisma.user.update({
      where: { id: userId },
      data: { role: UserRole.SELLER },
    });
    const seller = await prisma.sellerProfile.create({
      data: { userId, displayName: 'Existing Seller' },
    });
    googleClient.setIdentity('seller-link-code', {
      providerAccountId: 'google-sub-seller-link',
      email: LINK_EMAIL,
      emailVerified: true,
    });

    const response = await completeGoogleLogin('seller-link-code');
    const storedUser = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { sellerProfile: true, oauthAccounts: true },
    });

    expect(bodyOf(response).user).toMatchObject({
      id: userId,
      role: UserRole.SELLER,
    });
    expect(storedUser.passwordHash).toMatch(/^scrypt\$/);
    expect(storedUser.sellerProfile?.id).toBe(seller.id);
    expect(storedUser.oauthAccounts).toHaveLength(1);
  });

  it('rejects an unverified or missing Google email', async () => {
    googleClient.setIdentity('unverified-email-code', {
      providerAccountId: 'google-sub-unverified',
      email: OTHER_EMAIL,
      emailVerified: false,
    });
    googleClient.setIdentity('missing-email-code', {
      providerAccountId: 'google-sub-missing-email',
      email: '',
      emailVerified: true,
    });

    await completeGoogleLogin('unverified-email-code', 401);
    await completeGoogleLogin('missing-email-code', 401);

    expect(
      await prisma.user.count({
        where: { email: { in: [OTHER_EMAIL, ''] } },
      }),
    ).toBe(0);
  });

  it('rejects a provider identity whose verified email belongs to another User', async () => {
    const first = await register(LINK_EMAIL);
    await register(OTHER_EMAIL);
    await prisma.oAuthAccount.create({
      data: {
        userId: bodyOf(first).user.id,
        provider: OAuthProvider.GOOGLE,
        providerAccountId: 'google-sub-already-linked',
      },
    });
    googleClient.setIdentity('provider-conflict-code', {
      providerAccountId: 'google-sub-already-linked',
      email: OTHER_EMAIL,
      emailVerified: true,
    });

    await completeGoogleLogin('provider-conflict-code', 409);

    expect(
      await prisma.user.count({
        where: { email: { in: [LINK_EMAIL, OTHER_EMAIL] } },
      }),
    ).toBe(2);
    expect(
      await prisma.oAuthAccount.count({
        where: { providerAccountId: 'google-sub-already-linked' },
      }),
    ).toBe(1);
  });

  it('does not add a password through unauthenticated registration for a Google account', async () => {
    googleClient.setIdentity('google-first-code', {
      providerAccountId: 'google-sub-google-first',
      email: NEW_GOOGLE_EMAIL,
      emailVerified: true,
    });
    const googleLogin = await completeGoogleLogin('google-first-code');

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: NEW_GOOGLE_EMAIL.toUpperCase(), password: PASSWORD })
      .expect(409);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: NEW_GOOGLE_EMAIL, password: PASSWORD })
      .expect(401);

    const storedUsers = await prisma.user.findMany({
      where: { email: NEW_GOOGLE_EMAIL },
    });
    expect(storedUsers).toHaveLength(1);
    expect(storedUsers[0].id).toBe(bodyOf(googleLogin).user.id);
    expect(storedUsers[0].passwordHash).toBeNull();
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

  it('returns a safe authentication error when Google code verification fails', async () => {
    const response = await completeGoogleLogin('provider-rejected-code', 401);

    expect(bodyOf(response).message).toBe('Google authentication failed');
    expect(JSON.stringify(bodyOf(response))).not.toContain(
      'provider-rejected-code',
    );
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

  async function cleanupUsers(): Promise<void> {
    const users = { email: { startsWith: TEST_PREFIX } };
    await prisma.sellerProfile.deleteMany({ where: { user: users } });
    await prisma.user.deleteMany({ where: users });
  }
});
