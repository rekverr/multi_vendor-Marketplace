import {
  Body,
  Controller,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAccessGuard } from '../auth/jwt-access.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.js';
import { CorrelationId } from '../common/correlation-id.decorator.js';
import { UserRole } from '../generated/prisma/client.js';
import { AuctionCommandsService } from './auction-commands.service.js';
import { PlaceBidDto } from './dto/place-bid.dto.js';

@ApiTags('auction-bids')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
@Controller('auctions/:auctionId/bids')
export class BidsController {
  constructor(private readonly commands: AuctionCommandsService) {}

  @Post()
  @ApiOperation({ summary: 'Place a race-safe Auction bid' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  place(
    @CurrentUser() user: AuthenticatedUser,
    @Param('auctionId', new ParseUUIDPipe()) auctionId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: PlaceBidDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.commands.placeBid(
      user.id,
      auctionId,
      idempotencyKey ?? '',
      dto.amount,
      correlationId,
    );
  }
}
