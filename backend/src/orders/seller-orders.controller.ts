import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { CreateItemRefundDto } from './dto/create-item-refund.dto.js';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto.js';
import { UpdateSellerOrderStatusDto } from './dto/update-seller-order-status.dto.js';
import { OrderAdjustmentsService } from './order-adjustments.service.js';
import { OrderLifecycleService } from './order-lifecycle.service.js';

@ApiTags('seller-orders')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles(UserRole.SELLER)
@Controller('seller/orders')
export class SellerOrdersController {
  constructor(
    private readonly orders: OrderLifecycleService,
    private readonly adjustments: OrderAdjustmentsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List authenticated Seller orders' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListOrdersQueryDto,
  ) {
    return this.orders.listSellerOrders(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read an owned SellerOrder' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.orders.getSellerOrder(user.id, id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Transition an owned SellerOrder' })
  transition(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSellerOrderStatusDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.orders.transitionSellerOrder(
      user.id,
      id,
      dto.status,
      correlationId,
    );
  }

  @Post(':sellerOrderId/items/:itemId/refunds')
  @ApiOperation({ summary: 'Create an item-level partial refund' })
  refundItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sellerOrderId', new ParseUUIDPipe()) sellerOrderId: string,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreateItemRefundDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.adjustments.refundItem(
      user.id,
      sellerOrderId,
      itemId,
      idempotencyKey ?? '',
      dto,
      correlationId,
    );
  }
}
