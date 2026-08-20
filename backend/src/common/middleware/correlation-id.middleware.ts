import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Response } from 'express';

import { RequestWithCorrelationId } from '../types/request-with-correlation-id.js';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(
    req: RequestWithCorrelationId,
    res: Response,
    next: NextFunction,
  ): void {
    const incomingCorrelationId = req.header('x-correlation-id');

    const isValid =
      incomingCorrelationId &&
      /^[a-zA-Z0-9._:-]{1,128}$/.test(incomingCorrelationId);

    const correlationId = isValid
      ? incomingCorrelationId
      : randomUUID();

    req.correlationId = correlationId;

    res.setHeader('x-correlation-id', correlationId);

    next();
  }
}