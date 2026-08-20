import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';

const STATE_COOKIE = 'google_oauth_state';

@Injectable()
export class GoogleOAuthStateService {
  private readonly maxAge: number;
  private readonly secure: boolean;

  constructor(configService: ConfigService) {
    this.maxAge =
      configService.getOrThrow<number>('GOOGLE_OAUTH_STATE_TTL_SECONDS') * 1000;
    this.secure = configService.get<string>('NODE_ENV') === 'production';
  }

  issue(response: Response): string {
    const state = randomBytes(32).toString('base64url');

    response.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      secure: this.secure,
      sameSite: 'lax',
      path: '/auth/google/callback',
      maxAge: this.maxAge,
    });

    return state;
  }

  consume(
    request: Request,
    response: Response,
    receivedState: string,
  ): boolean {
    const expectedState = this.readCookie(request.headers.cookie);

    response.clearCookie(STATE_COOKIE, {
      httpOnly: true,
      secure: this.secure,
      sameSite: 'lax',
      path: '/auth/google/callback',
    });

    if (!expectedState) {
      return false;
    }

    const expected = Buffer.from(expectedState);
    const received = Buffer.from(receivedState);

    return (
      expected.length === received.length && timingSafeEqual(expected, received)
    );
  }

  private readCookie(cookieHeader: string | undefined): string | null {
    if (!cookieHeader) {
      return null;
    }

    for (const cookie of cookieHeader.split(';')) {
      const [name, ...valueParts] = cookie.trim().split('=');

      if (name === STATE_COOKIE) {
        try {
          return decodeURIComponent(valueParts.join('='));
        } catch {
          return null;
        }
      }
    }

    return null;
  }
}
