import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAccessGuard } from '../auth/jwt-access.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.js';
import { UserRole } from '../generated/prisma/client.js';
import { AuctionsService } from './auctions.service.js';
import { ConfigureAuctionDto } from './dto/configure-auction.dto.js';

@ApiTags('seller-auctions')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles(UserRole.SELLER)
@Controller('seller/products/:productId/auction')
export class SellerAuctionsController {
  constructor(private readonly auctions: AuctionsService) {}

  @Put()
  @ApiOperation({ summary: 'Create or update an owned Auction configuration' })
  configure(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Body() dto: ConfigureAuctionDto,
  ) {
    return this.auctions.configure(user.id, productId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Read an owned Auction configuration' })
  getOwn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', new ParseUUIDPipe()) productId: string,
  ) {
    return this.auctions.getOwn(user.id, productId);
  }
}
