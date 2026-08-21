import {
  Body,
  Controller,
  Delete,
  Get,
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
import { CreateReviewDto } from './dto/create-review.dto.js';
import { ListReviewsQueryDto } from './dto/list-reviews-query.dto.js';
import { UpdateReviewDto } from './dto/update-review.dto.js';
import { ReviewsService } from './reviews.service.js';

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('products/:productId/reviews')
  @ApiOperation({ summary: 'List public Product reviews' })
  list(
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Query() query: ListReviewsQueryDto,
  ) {
    return this.reviews.list(productId, query);
  }

  @Post('products/:productId/reviews')
  @ApiBearerAuth()
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Review a Product from a completed purchase' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Body() dto: CreateReviewDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.reviews.create(user.id, productId, dto, correlationId);
  }

  @Patch('reviews/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Update an owned review' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateReviewDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.reviews.update(user.id, id, dto, correlationId);
  }

  @Delete('reviews/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Delete an owned review' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @CorrelationId() correlationId: string,
  ) {
    return this.reviews.remove(user.id, id, correlationId);
  }
}
