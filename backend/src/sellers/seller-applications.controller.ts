import {
  Body,
  Controller,
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
import { UserRole } from '../generated/prisma/client.js';
import { ListSellerApplicationsDto } from './dto/list-seller-applications.dto.js';
import { RejectSellerApplicationDto } from './dto/reject-seller-application.dto.js';
import { SubmitSellerApplicationDto } from './dto/submit-seller-application.dto.js';
import { SellerApplicationsService } from './seller-applications.service.js';

@ApiTags('seller-applications')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard, RolesGuard)
@Controller('seller-applications')
export class SellerApplicationsController {
  constructor(
    private readonly sellerApplicationsService: SellerApplicationsService,
  ) {}

  @Post()
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Submit a Seller application' })
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitSellerApplicationDto,
  ) {
    return this.sellerApplicationsService.submit(user, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List Seller applications for moderation' })
  list(@Query() query: ListSellerApplicationsDto) {
    return this.sellerApplicationsService.list(query.status);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Read a Seller application for moderation' })
  getById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.sellerApplicationsService.getById(id);
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Approve a Seller application' })
  approve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() reviewer: AuthenticatedUser,
  ) {
    return this.sellerApplicationsService.approve(id, reviewer);
  }

  @Patch(':id/reject')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Reject a Seller application' })
  reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() reviewer: AuthenticatedUser,
    @Body() dto: RejectSellerApplicationDto,
  ) {
    return this.sellerApplicationsService.reject(id, reviewer, dto.reason);
  }
}
