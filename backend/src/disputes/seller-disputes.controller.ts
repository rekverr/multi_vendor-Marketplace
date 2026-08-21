import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAccessGuard } from '../auth/jwt-access.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.js';
import { UserRole } from '../generated/prisma/client.js';
import { DisputesService } from './disputes.service.js';
import { ListDisputesQueryDto } from './dto/list-disputes-query.dto.js';

@ApiTags('seller-disputes')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles(UserRole.SELLER)
@Controller('seller/disputes')
export class SellerDisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Get()
  @ApiOperation({ summary: 'List disputes for owned SellerOrders' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListDisputesQueryDto,
  ) {
    return this.disputes.listSeller(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read a dispute for an owned SellerOrder' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.disputes.getSeller(user.id, id);
  }
}
