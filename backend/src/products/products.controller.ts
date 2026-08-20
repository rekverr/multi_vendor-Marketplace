import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user.decorator.js';
import { CorrelationId } from '../common/correlation-id.decorator.js';
import { JwtAccessGuard } from '../auth/jwt-access.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.js';
import { UserRole } from '../generated/prisma/client.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ProductsService } from './products.service.js';

@ApiTags('seller-products')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles(UserRole.SELLER)
@Controller('seller/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a Seller-owned Product draft' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProductDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.productsService.create(user, dto, correlationId);
  }

  @Get()
  @ApiOperation({ summary: 'List own Products' })
  listOwn(@CurrentUser() user: AuthenticatedUser) {
    return this.productsService.listOwn(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an owned Product' })
  getOwn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.productsService.getOwn(user, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an editable owned Product' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProductDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.productsService.update(user, id, dto, correlationId);
  }

  @Patch(':id/request-publication')
  @ApiOperation({ summary: 'Request Product publication review' })
  requestPublication(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @CorrelationId() correlationId: string,
  ) {
    return this.productsService.requestPublication(user, id, correlationId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archive an owned Product' })
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @CorrelationId() correlationId: string,
  ) {
    return this.productsService.archive(user, id, correlationId);
  }
}
