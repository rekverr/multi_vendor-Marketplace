import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

export interface VerifiedGoogleIdentity {
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
}

@Injectable()
export class GoogleOAuthClient {
  private readonly client: OAuth2Client;
  private readonly clientId: string;

  constructor(configService: ConfigService) {
    this.clientId = configService.getOrThrow<string>('GOOGLE_OAUTH_CLIENT_ID');
    this.client = new OAuth2Client({
      clientId: this.clientId,
      clientSecret: configService.getOrThrow<string>(
        'GOOGLE_OAUTH_CLIENT_SECRET',
      ),
      redirectUri: configService.getOrThrow<string>(
        'GOOGLE_OAUTH_REDIRECT_URI',
      ),
    });
  }

  createAuthorizationUrl(state: string): string {
    return this.client.generateAuthUrl({
      scope: ['openid', 'email'],
      state,
      prompt: 'select_account',
    });
  }

  async verifyAuthorizationCode(code: string): Promise<VerifiedGoogleIdentity> {
    try {
      const { tokens } = await this.client.getToken(code);

      if (!tokens.id_token) {
        throw this.invalidGoogleIdentity();
      }

      const ticket = await this.client.verifyIdToken({
        idToken: tokens.id_token,
        audience: this.clientId,
      });
      const payload = ticket.getPayload();

      if (!payload?.sub || !payload.email || payload.email_verified !== true) {
        throw this.invalidGoogleIdentity();
      }

      return {
        providerAccountId: payload.sub,
        email: payload.email,
        emailVerified: true,
      };
    } catch {
      throw this.invalidGoogleIdentity();
    }
  }

  private invalidGoogleIdentity(): UnauthorizedException {
    return new UnauthorizedException('Google authentication failed');
  }
}
