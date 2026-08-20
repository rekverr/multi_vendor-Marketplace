import {
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAccessGuard } from '../auth/jwt-access.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CorrelationId } from '../common/correlation-id.decorator.js';
import { UserRole } from '../generated/prisma/client.js';
import { AuctionCommandsService } from './auction-commands.service.js';

@ApiTags('admin-auctions')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/auctions')
export class AdminAuctionsController {
  constructor(private readonly commands: AuctionCommandsService) {}

  @Post(':id/finalize')
  @ApiOperation({ summary: 'Idempotently finalize an expired Auction' })
  finalize(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CorrelationId() correlationId: string,
  ) {
    return this.commands.finalize(id, correlationId);
  }

  @Post(':id/expire-winner-window')
  @ApiOperation({ summary: 'Expire stale Auction winner purchase eligibility' })
  expireWinnerWindow(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CorrelationId() correlationId: string,
  ) {
    return this.commands.expireWinnerWindow(id, correlationId);
  }
}
