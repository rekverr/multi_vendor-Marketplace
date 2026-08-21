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
import { DisputesService } from './disputes.service.js';
import { ListDisputesQueryDto } from './dto/list-disputes-query.dto.js';
import { UpdateDisputeStatusDto } from './dto/update-dispute-status.dto.js';

@ApiTags('admin-disputes')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/disputes')
export class AdminDisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Get()
  @ApiOperation({ summary: 'List disputes for Admin review' })
  list(@Query() query: ListDisputesQueryDto) {
    return this.disputes.listAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read a dispute for Admin review' })
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.disputes.getAdmin(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Transition dispute resolution state' })
  transition(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateDisputeStatusDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.disputes.transition(user.id, id, dto, correlationId);
  }
}
