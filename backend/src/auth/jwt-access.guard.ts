import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../database/prisma.service.js';
import type { RequestWithCurrentUser } from './types/request-with-current-user.js';

interface AccessTokenPayload {
  sub: string;
}

@Injectable()
export class JwtAccessGuard implements CanActivate {
  private readonly secret: string;
  private readonly issuer: string;
  private readonly audience: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    this.secret = configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.issuer = configService.getOrThrow<string>('JWT_ISSUER');
    this.audience = configService.getOrThrow<string>('JWT_AUDIENCE');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithCurrentUser>();
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw this.unauthorized();
    }

    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(
        token,
        {
          secret: this.secret,
          issuer: this.issuer,
          audience: this.audience,
        },
      );

      if (typeof payload.sub !== 'string') {
        throw this.unauthorized();
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, role: true },
      });

      if (!user) {
        throw this.unauthorized();
      }

      request.user = user;
      return true;
    } catch {
      throw this.unauthorized();
    }
  }

  private extractBearerToken(authorization: string | undefined): string | null {
    if (!authorization) {
      return null;
    }

    const [scheme, token, extra] = authorization.split(' ');

    return scheme === 'Bearer' && token && !extra ? token : null;
  }

  private unauthorized(): UnauthorizedException {
    return new UnauthorizedException('Authentication required');
  }
}
