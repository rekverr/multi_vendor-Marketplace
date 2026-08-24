import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { RequestWithCorrelationId } from '../types/request-with-correlation-id.js';

interface HttpErrorResponse {
  message?: string | string[];
  code?: string;
  error?: string;
  [key: string]: unknown;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();

    const response = context.getResponse<Response>();
    const request = context.getRequest<RequestWithCorrelationId & Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (
      request.path.startsWith('/health') &&
      exception instanceof HttpException
    ) {
      response.status(status).json(exception.getResponse());
      return;
    }

    let message: string | string[] = 'Internal server error';
    let code = 'INTERNAL_SERVER_ERROR';
    let details: unknown;

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else {
        const body = exceptionResponse as HttpErrorResponse;

        message = body.message ?? exception.message;

        code = body.code ?? (status === 400 ? 'BAD_REQUEST' : 'HTTP_ERROR');

        if (Array.isArray(body.message)) {
          details = body.message;
        }
      }
    }

    response.status(status).json({
      statusCode: status,
      code,
      message,
      ...(details ? { details } : {}),
      path: request.path,
      timestamp: new Date().toISOString(),
      correlationId: request.correlationId,
    });
  }
}
