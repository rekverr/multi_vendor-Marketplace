import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SellerDashboardController } from './seller-dashboard.controller.js';
import { SellerDashboardService } from './seller-dashboard.service.js';

@Module({
  imports: [AuthModule],
  controllers: [SellerDashboardController],
  providers: [SellerDashboardService],
})
export class AnalyticsModule {}
