import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { SellerApplicationsController } from './seller-applications.controller.js';
import { SellerApplicationsService } from './seller-applications.service.js';

@Module({
  imports: [AuthModule],
  controllers: [SellerApplicationsController],
  providers: [SellerApplicationsService],
})
export class SellersModule {}
