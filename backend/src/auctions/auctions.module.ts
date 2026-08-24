import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MetricsModule } from '../metrics/metrics.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { AuctionsService } from './auctions.service.js';
import { AuctionCommandsService } from './auction-commands.service.js';
import { AuctionMaintenanceQueueService } from './auction-maintenance-queue.service.js';
import { AuctionMaintenanceService } from './auction-maintenance.service.js';
import { AdminAuctionsController } from './admin-auctions.controller.js';
import { BidsController } from './bids.controller.js';
import { PublicAuctionsController } from './public-auctions.controller.js';
import { SellerAuctionsController } from './seller-auctions.controller.js';

@Module({
  imports: [AuthModule, MetricsModule, QueueModule],
  controllers: [
    SellerAuctionsController,
    PublicAuctionsController,
    BidsController,
    AdminAuctionsController,
  ],
  providers: [
    AuctionsService,
    AuctionCommandsService,
    AuctionMaintenanceService,
    AuctionMaintenanceQueueService,
  ],
})
export class AuctionsModule {}
