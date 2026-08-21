import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAccessGuard } from '../auth/jwt-access.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.js';
import { CorrelationId } from '../common/correlation-id.decorator.js';
import { UserRole } from '../generated/prisma/client.js';
import { DisputesService } from './disputes.service.js';
import { CreateDisputeDto } from './dto/create-dispute.dto.js';
import { ListDisputesQueryDto } from './dto/list-disputes-query.dto.js';

@ApiTags('customer-disputes')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
@Controller()
export class CustomerDisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Post('orders/:orderId/disputes')
  @ApiOperation({ summary: 'Open a dispute for an owned purchase' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
    @Body() dto: CreateDisputeDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.disputes.create(user.id, orderId, dto, correlationId);
  }

  @Get('disputes')
  @ApiOperation({ summary: 'List authenticated Customer disputes' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListDisputesQueryDto,
  ) {
    return this.disputes.listCustomer(user.id, query);
  }

  @Get('disputes/:id')
  @ApiOperation({ summary: 'Read an owned Customer dispute' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.disputes.getCustomer(user.id, id);
  }
}
