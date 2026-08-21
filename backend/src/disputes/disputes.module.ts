import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminDisputesController } from './admin-disputes.controller.js';
import { CustomerDisputesController } from './customer-disputes.controller.js';
import { DisputesService } from './disputes.service.js';
import { SellerDisputesController } from './seller-disputes.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [
    CustomerDisputesController,
    SellerDisputesController,
    AdminDisputesController,
  ],
  providers: [DisputesService],
})
export class DisputesModule {}
