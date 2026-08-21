import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAccessGuard } from '../auth/jwt-access.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.js';
import { UserRole } from '../generated/prisma/client.js';
import { SellerDashboardQueryDto } from './dto/seller-dashboard-query.dto.js';
import { SellerDashboardService } from './seller-dashboard.service.js';

@ApiTags('seller-dashboard')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles(UserRole.SELLER)
@Controller('seller/dashboard')
export class SellerDashboardController {
  constructor(private readonly dashboard: SellerDashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Read authenticated Seller analytics dashboard' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SellerDashboardQueryDto,
  ) {
    return this.dashboard.get(user.id, query);
  }
}
