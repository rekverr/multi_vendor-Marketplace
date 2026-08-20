import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Response } from 'express';

import { RequestWithCorrelationId } from '../types/request-with-correlation-id.js';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: RequestWithCorrelationId, res: Response, next: NextFunction): void {
    const incomingCorrelationId = req.header('x-correlation-id');

    const isValid =
      incomingCorrelationId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        incomingCorrelationId,
      );

    const correlationId = isValid ? incomingCorrelationId : randomUUID();

    req.correlationId = correlationId;

    res.setHeader('x-correlation-id', correlationId);

    next();
  }
}
