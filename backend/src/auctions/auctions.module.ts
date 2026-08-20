import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AuctionsService } from './auctions.service.js';
import { PublicAuctionsController } from './public-auctions.controller.js';
import { SellerAuctionsController } from './seller-auctions.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [SellerAuctionsController, PublicAuctionsController],
  providers: [AuctionsService],
})
export class AuctionsModule {}
