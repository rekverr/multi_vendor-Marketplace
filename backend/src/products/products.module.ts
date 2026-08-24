import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { AdminProductsController } from './admin-products.controller.js';
import { ProductModerationService } from './product-moderation.service.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';
import { PublicProductsController } from './public-products.controller.js';
import { PublicProductsService } from './public-products.service.js';

@Module({
  imports: [AuthModule],
  controllers: [
    AdminProductsController,
    ProductsController,
    PublicProductsController,
  ],
  providers: [ProductModerationService, ProductsService, PublicProductsService],
})
export class ProductsModule {}
