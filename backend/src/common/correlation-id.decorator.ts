import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithCorrelationId } from './types/request-with-correlation-id.js';

export const CorrelationId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string =>
    context.switchToHttp().getRequest<RequestWithCorrelationId>().correlationId,
);
