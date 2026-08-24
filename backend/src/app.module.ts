import {
  ExecutionContext,
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { Request } from 'express';

import { AnalyticsModule } from './analytics/analytics.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AuctionsModule } from './auctions/auctions.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { CacheModule } from './cache/cache.module.js';
import { CartModule } from './cart/cart.module.js';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware.js';
import { envValidationSchema } from './config/env.validation.js';
import { DatabaseModule } from './database/database.module.js';
import { DisputesModule } from './disputes/disputes.module.js';
import { HealthModule } from './health/health.module.js';
import { MetricsModule } from './metrics/metrics.module.js';
import { OutboxModule } from './outbox/outbox.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { ProductsModule } from './products/products.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { SellersModule } from './sellers/sellers.module.js';
import { SearchModule } from './search/search.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'login',
          limit: config.getOrThrow<number>('RATE_LIMIT_LOGIN_MAX'),
          ttl: config.getOrThrow<number>('RATE_LIMIT_LOGIN_TTL_SECONDS') * 1000,
          skipIf: (context: ExecutionContext) =>
            !matchesHttpRoute(context, 'POST', /^\/auth\/login\/?$/),
        },
        {
          name: 'bid',
          limit: config.getOrThrow<number>('RATE_LIMIT_BID_MAX'),
          ttl: config.getOrThrow<number>('RATE_LIMIT_BID_TTL_SECONDS') * 1000,
          skipIf: (context: ExecutionContext) =>
            !matchesHttpRoute(context, 'POST', /^\/auctions\/[^/]+\/bids\/?$/),
        },
      ],
    }),

    AnalyticsModule,
    DatabaseModule,
    DisputesModule,
    CacheModule,
    CartModule,
    AuthModule,
    AuctionsModule,
    CategoriesModule,
    ProductsModule,
    RealtimeModule,
    ReviewsModule,
    SellersModule,
    HealthModule,
    MetricsModule,
    OutboxModule,
    OrdersModule,
    SearchModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}

function matchesHttpRoute(
  context: ExecutionContext,
  method: string,
  pathPattern: RegExp,
): boolean {
  if (context.getType() !== 'http') return false;

  const request = context.switchToHttp().getRequest<Request>();
  const path = (request.originalUrl || request.url).split('?')[0];

  return request.method === method && pathPattern.test(path);
}
