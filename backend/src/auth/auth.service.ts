import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

import { OAuthProvider, Prisma, UserRole } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import type { VerifiedGoogleIdentity } from './google-oauth.client.js';
import { PasswordHasherService } from './password-hasher.service.js';

export interface PublicUser {
  id: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresInSeconds: number;
}

export interface AuthResponse extends AuthTokens {
  user: PublicUser;
}

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlSeconds: number;
  private readonly issuer: string;
  private readonly audience: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasherService,
    private readonly jwtService: JwtService,
    configService: ConfigService,
  ) {
    this.accessSecret = configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.accessTtlSeconds = configService.getOrThrow<number>(
      'JWT_ACCESS_TTL_SECONDS',
    );
    this.refreshTtlSeconds = configService.getOrThrow<number>(
      'JWT_REFRESH_TTL_SECONDS',
    );
    this.issuer = configService.getOrThrow<string>('JWT_ISSUER');
    this.audience = configService.getOrThrow<string>('JWT_AUDIENCE');
  }

  async register(dto: RegisterDto): Promise<{ user: PublicUser }> {
    const email = this.normalizeEmail(dto.email);
    const passwordHash = await this.passwordHasher.hash(dto.password);

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          role: UserRole.CUSTOMER,
        },
      });

      return { user: this.toPublicUser(user) };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email is already registered');
      }

      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    const passwordIsValid =
      user?.passwordHash &&
      (await this.passwordHasher.verify(dto.password, user.passwordHash));

    if (!user || !passwordIsValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.createAuthResponse(user);
  }

  async authenticateWithGoogle(
    identity: VerifiedGoogleIdentity,
  ): Promise<AuthResponse> {
    if (!identity.emailVerified) {
      throw new UnauthorizedException('Google authentication failed');
    }

    const provider = OAuthProvider.GOOGLE;
    const email = this.normalizeEmail(identity.email);
    let user: PublicUser;

    try {
      user = await this.prisma.$transaction(async (transaction) => {
        const linkedAccount = await transaction.oAuthAccount.findUnique({
          where: {
            provider_providerAccountId: {
              provider,
              providerAccountId: identity.providerAccountId,
            },
          },
          include: { user: true },
        });

        if (linkedAccount) {
          return linkedAccount.user;
        }

        let matchedUser = await transaction.user.findUnique({
          where: { email },
        });

        if (matchedUser) {
          const existingProviderLink =
            await transaction.oAuthAccount.findUnique({
              where: {
                userId_provider: {
                  userId: matchedUser.id,
                  provider,
                },
              },
            });

          if (existingProviderLink) {
            throw new ConflictException(
              'Google account cannot be linked safely',
            );
          }
        } else {
          matchedUser = await transaction.user.create({
            data: {
              email,
              passwordHash: null,
              role: UserRole.CUSTOMER,
            },
          });
        }

        await transaction.oAuthAccount.create({
          data: {
            userId: matchedUser.id,
            provider,
            providerAccountId: identity.providerAccountId,
          },
        });

        return matchedUser;
      });
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const linkedAccount = await this.prisma.oAuthAccount.findUnique({
          where: {
            provider_providerAccountId: {
              provider,
              providerAccountId: identity.providerAccountId,
            },
          },
          include: { user: true },
        });

        if (linkedAccount) {
          user = linkedAccount.user;
        } else {
          throw new ConflictException('Google account cannot be linked safely');
        }
      } else {
        throw error;
      }
    }

    return this.createAuthResponse(user);
  }

  async refresh(rawRefreshToken: string): Promise<AuthResponse> {
    const sessionId = this.parseSessionId(rawRefreshToken);

    if (!sessionId) {
      throw this.invalidRefreshToken();
    }

    const session = await this.prisma.refreshSession.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !this.tokenHashMatches(rawRefreshToken, session.tokenHash)
    ) {
      throw this.invalidRefreshToken();
    }

    const rotated = await this.prisma.$transaction(async (transaction) => {
      const revoked = await transaction.refreshSession.updateMany({
        where: {
          id: session.id,
          tokenHash: session.tokenHash,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { revokedAt: new Date() },
      });

      if (revoked.count !== 1) {
        return null;
      }

      return this.createRefreshSession(transaction, session.userId);
    });

    if (!rotated) {
      throw this.invalidRefreshToken();
    }

    return {
      user: this.toPublicUser(session.user),
      accessToken: await this.createAccessToken(session.user),
      refreshToken: rotated,
      accessTokenExpiresInSeconds: this.accessTtlSeconds,
    };
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const sessionId = this.parseSessionId(rawRefreshToken);

    if (!sessionId) {
      return;
    }

    await this.prisma.refreshSession.updateMany({
      where: {
        id: sessionId,
        tokenHash: this.hashToken(rawRefreshToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  private async createAuthResponse(user: PublicUser): Promise<AuthResponse> {
    const tokens = await this.createTokens(user);

    return {
      user: this.toPublicUser(user),
      ...tokens,
    };
  }

  private async createTokens(user: PublicUser): Promise<AuthTokens> {
    const [accessToken, refreshToken] = await Promise.all([
      this.createAccessToken(user),
      this.createRefreshSession(this.prisma, user.id),
    ]);

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresInSeconds: this.accessTtlSeconds,
    };
  }

  private createAccessToken(user: PublicUser): Promise<string> {
    return this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
      },
      {
        secret: this.accessSecret,
        expiresIn: this.accessTtlSeconds,
        issuer: this.issuer,
        audience: this.audience,
      },
    );
  }

  private async createRefreshSession(
    client: Prisma.TransactionClient | PrismaService,
    userId: string,
  ): Promise<string> {
    const sessionId = randomUUID();
    const refreshToken = `${sessionId}.${randomBytes(32).toString('base64url')}`;

    await client.refreshSession.create({
      data: {
        id: sessionId,
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + this.refreshTtlSeconds * 1000),
      },
    });

    return refreshToken;
  }

  private parseSessionId(rawRefreshToken: string): string | null {
    const separatorIndex = rawRefreshToken.indexOf('.');

    if (separatorIndex <= 0) {
      return null;
    }

    const sessionId = rawRefreshToken.slice(0, separatorIndex);

    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      sessionId,
    )
      ? sessionId
      : null;
  }

  private tokenHashMatches(rawToken: string, storedHash: string): boolean {
    const actualHash = Buffer.from(this.hashToken(rawToken), 'hex');
    const expectedHash = Buffer.from(storedHash, 'hex');

    return (
      actualHash.length === expectedHash.length &&
      timingSafeEqual(actualHash, expectedHash)
    );
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private toPublicUser(user: PublicUser): PublicUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private invalidRefreshToken(): UnauthorizedException {
    return new UnauthorizedException('Invalid refresh token');
  }
}
