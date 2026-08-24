import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MetricsModule } from '../metrics/metrics.module.js';
import { CheckoutController } from './checkout.controller.js';
import { CheckoutService } from './checkout.service.js';
import { CustomerOrdersController } from './customer-orders.controller.js';
import { OrderAdjustmentsService } from './order-adjustments.service.js';
import { OrderLifecycleService } from './order-lifecycle.service.js';
import { SellerOrdersController } from './seller-orders.controller.js';

@Module({
  imports: [AuthModule, MetricsModule],
  controllers: [
    CheckoutController,
    CustomerOrdersController,
    SellerOrdersController,
  ],
  providers: [CheckoutService, OrderLifecycleService, OrderAdjustmentsService],
})
export class OrdersModule {}
