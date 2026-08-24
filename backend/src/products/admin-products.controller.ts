import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { ListProductModerationDto } from './dto/list-product-moderation.dto.js';
import { RejectProductDto } from './dto/reject-product.dto.js';
import { ProductModerationService } from './product-moderation.service.js';

@ApiTags('admin-products')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly moderation: ProductModerationService) {}

  @Get()
  @ApiOperation({ summary: 'List Products for Admin moderation' })
  list(@Query() query: ListProductModerationDto) {
    return this.moderation.list(query.status);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a pending Product for publication' })
  approve(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @CorrelationId() correlationId: string,
  ) {
    return this.moderation.approve(admin.id, id, correlationId);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject a pending Product publication request' })
  reject(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RejectProductDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.moderation.reject(admin.id, id, dto.reason, correlationId);
  }
}
