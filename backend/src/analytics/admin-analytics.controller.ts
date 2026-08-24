import {
  Controller,
  Get,
  StreamableFile,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAccessGuard } from '../auth/jwt-access.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { UserRole } from '../generated/prisma/client.js';
import { AdminAnalyticsService } from './admin-analytics.service.js';
import { SellerDashboardQueryDto } from './dto/seller-dashboard-query.dto.js';

@ApiTags('admin-analytics')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/analytics')
export class AdminAnalyticsController {
  constructor(private readonly analytics: AdminAnalyticsService) {}

  @Get()
  @ApiOperation({ summary: 'Read marketplace analytics' })
  get(@Query() query: SellerDashboardQueryDto) {
    return this.analytics.get(query);
  }

  @Get('sales.csv')
  @ApiProduces('text/csv')
  @ApiOperation({ summary: 'Export marketplace sales snapshots as CSV' })
  exportSales(@Query() query: SellerDashboardQueryDto) {
    const exportFile = this.analytics.createSalesCsv(query);
    return new StreamableFile(exportFile.stream, {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${exportFile.filename}"`,
    });
  }

  @Get('sales.json')
  @ApiProduces('application/json')
  @ApiOperation({ summary: 'Export marketplace sales snapshots as JSON' })
  exportSalesJson(@Query() query: SellerDashboardQueryDto) {
    const exportFile = this.analytics.createSalesJson(query);
    return new StreamableFile(exportFile.stream, {
      type: 'application/json; charset=utf-8',
      disposition: `attachment; filename="${exportFile.filename}"`,
    });
  }
}
