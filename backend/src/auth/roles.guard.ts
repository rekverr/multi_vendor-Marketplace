import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { UserRole } from '../generated/prisma/client.js';
import { ROLES_KEY } from './roles.decorator.js';
import type { RequestWithCurrentUser } from './types/request-with-current-user.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithCurrentUser>();

    if (!request.user || !requiredRoles.includes(request.user.role)) {
      throw new ForbiddenException('Access denied');
    }

    return true;
  }
}
