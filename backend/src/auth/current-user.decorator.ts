import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { RequestWithCurrentUser } from './types/request-with-current-user.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<RequestWithCurrentUser>().user,
);
