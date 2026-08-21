import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminAnalyticsController } from './admin-analytics.controller.js';
import { AdminAnalyticsService } from './admin-analytics.service.js';
import { SellerDashboardController } from './seller-dashboard.controller.js';
import { SellerDashboardService } from './seller-dashboard.service.js';

@Module({
  imports: [AuthModule],
  controllers: [SellerDashboardController, AdminAnalyticsController],
  providers: [SellerDashboardService, AdminAnalyticsService],
})
export class AnalyticsModule {}
