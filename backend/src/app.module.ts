import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/auth.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { CacheModule } from './cache/cache.module.js';
import { CartModule } from './cart/cart.module.js';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware.js';
import { envValidationSchema } from './config/env.validation.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { MetricsModule } from './metrics/metrics.module.js';
import { OutboxModule } from './outbox/outbox.module.js';
import { ProductsModule } from './products/products.module.js';
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

    DatabaseModule,
    CacheModule,
    CartModule,
    AuthModule,
    CategoriesModule,
    ProductsModule,
    SellersModule,
    HealthModule,
    MetricsModule,
    OutboxModule,
    SearchModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
