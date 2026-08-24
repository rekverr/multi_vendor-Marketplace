import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  OpenAPIObject,
  OperationObject,
  ResponseObject,
} from '@nestjs/swagger';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';

export function configureApp(app: INestApplication): void {
  const configService = app.get(ConfigService);
  const corsOrigin =
    configService.get<string>('CORS_ORIGIN') ?? 'http://localhost:5173';

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Multi-Vendor Marketplace API')
    .setDescription(
      'Authoritative marketplace API for authentication, Seller onboarding, catalog, cart, transactional checkout, independent SellerOrders, auctions, reviews, disputes, analytics and real-time recovery. Use the access JWT from login/refresh with the Authorize button. Idempotency-Key is required where shown for checkout, bids and refunds.',
    )
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description:
        'Short-lived application access JWT. Do not use a refresh token.',
    })
    .addTag(
      'auth',
      'Registration, login, refresh sessions, logout and Google OAuth2',
    )
    .addTag(
      'seller-applications',
      'Customer application and Admin Seller approval or rejection',
    )
    .addTag('categories', 'Public Category reads and Admin Category management')
    .addTag(
      'Public Products',
      'Published catalog search, filtering and Product detail',
    )
    .addTag('seller-products', 'Approved Seller-owned Product lifecycle')
    .addTag(
      'cart',
      'Authenticated Customer cart; cart contents do not reserve stock',
    )
    .addTag('checkout', 'Idempotent, transactional Customer checkout')
    .addTag(
      'customer-orders',
      'Customer-owned parent Orders, cancellation and child status visibility',
    )
    .addTag(
      'seller-orders',
      'Seller-owned fulfillment lifecycle and item refunds',
    )
    .addTag('auctions', 'Public Auction detail and bid history')
    .addTag('auction-bids', 'Idempotent PostgreSQL-serialized Customer bids')
    .addTag(
      'seller-auctions',
      'Seller configuration for owned Auction Products',
    )
    .addTag(
      'admin-auctions',
      'Idempotent Auction finalization and winner-window expiry',
    )
    .addTag('reviews', 'Verified-purchase Product reviews')
    .addTag('customer-disputes', 'Customer-owned dispute creation and reads')
    .addTag(
      'seller-disputes',
      'Seller visibility limited to involved SellerOrders',
    )
    .addTag(
      'admin-disputes',
      'Admin dispute review and explicit status transitions',
    )
    .addTag('seller-dashboard', 'Seller-scoped snapshot and ledger analytics')
    .addTag(
      'admin-analytics',
      'Marketplace analytics and streaming CSV/JSON exports',
    )
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  documentCommonErrors(swaggerDocument);
  SwaggerModule.setup('docs', app, swaggerDocument);
}

const documentedMethods = ['get', 'post', 'put', 'patch', 'delete'] as const;

function documentCommonErrors(document: OpenAPIObject): void {
  document.components ??= {};
  document.components.schemas ??= {};
  document.components.schemas.ApiError = {
    type: 'object',
    required: [
      'statusCode',
      'code',
      'message',
      'path',
      'timestamp',
      'correlationId',
    ],
    properties: {
      statusCode: { type: 'integer', example: 409 },
      code: { type: 'string', example: 'HTTP_ERROR' },
      message: {
        oneOf: [
          { type: 'string', example: 'Business state conflict' },
          { type: 'array', items: { type: 'string' } },
        ],
      },
      details: { nullable: true },
      path: { type: 'string', example: '/checkout' },
      timestamp: { type: 'string', format: 'date-time' },
      correlationId: { type: 'string', format: 'uuid' },
    },
  };

  for (const [path, pathItem] of Object.entries(document.paths)) {
    for (const method of documentedMethods) {
      const operation = pathItem[method];
      if (!operation) continue;
      addError(operation, '400', 'Request validation failed');
      if (operation.security?.length) {
        addError(
          operation,
          '401',
          'Access token is missing, expired or invalid',
        );
        addError(operation, '403', 'Authenticated role is not allowed');
      }
      if (path.includes('{')) {
        addError(
          operation,
          '404',
          'Resource was not found or is not visible to this identity',
        );
      }
      if (method !== 'get' && hasBusinessConflict(path)) {
        addError(
          operation,
          '409',
          'Business state, ownership, stock or idempotency conflict',
        );
      }
      if (path === '/auth/login' || path.endsWith('/bids')) {
        addError(operation, '429', 'Rate limit exceeded');
      }
    }
  }
}

function addError(
  operation: OperationObject,
  status: string,
  description: string,
): void {
  operation.responses[status] ??= {
    description,
    content: {
      'application/json': { schema: { $ref: '#/components/schemas/ApiError' } },
    },
  } satisfies ResponseObject;
}

function hasBusinessConflict(path: string): boolean {
  return /checkout|bids|refunds|cancel|status|approve|reject|products|categories|auction|reviews|disputes/.test(
    path,
  );
}
