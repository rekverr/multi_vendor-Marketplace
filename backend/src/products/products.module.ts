import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';
import { PublicProductsController } from './public-products.controller.js';
import { PublicProductsService } from './public-products.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ProductsController, PublicProductsController],
  providers: [ProductsService, PublicProductsService],
})
export class ProductsModule {}
