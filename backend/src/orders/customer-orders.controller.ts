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
import { ListOrdersQueryDto } from './dto/list-orders-query.dto.js';
import { OrderLifecycleService } from './order-lifecycle.service.js';

@ApiTags('customer-orders')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
@Controller('orders')
export class CustomerOrdersController {
  constructor(private readonly orders: OrderLifecycleService) {}

  @Get()
  @ApiOperation({ summary: 'List authenticated Customer orders' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListOrdersQueryDto,
  ) {
    return this.orders.listCustomerOrders(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read an owned parent Order' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.orders.getCustomerOrder(user.id, id);
  }
}
