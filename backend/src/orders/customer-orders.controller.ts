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
import { CancelOrderDto } from './dto/cancel-order.dto.js';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto.js';
import { OrderAdjustmentsService } from './order-adjustments.service.js';
import { OrderLifecycleService } from './order-lifecycle.service.js';

@ApiTags('customer-orders')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
@Controller('orders')
export class CustomerOrdersController {
  constructor(
    private readonly orders: OrderLifecycleService,
    private readonly adjustments: OrderAdjustmentsService,
  ) {}

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

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel an owned Order before shipment' })
  cancelOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() _dto: CancelOrderDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.adjustments.cancelOrder(user.id, id, correlationId);
  }

  @Post(':orderId/seller-orders/:sellerOrderId/cancel')
  @ApiOperation({ summary: 'Cancel one owned SellerOrder before shipment' })
  cancelSellerOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
    @Param('sellerOrderId', new ParseUUIDPipe()) sellerOrderId: string,
    @Body() _dto: CancelOrderDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.adjustments.cancelSellerOrder(
      user.id,
      orderId,
      sellerOrderId,
      correlationId,
    );
  }
}
