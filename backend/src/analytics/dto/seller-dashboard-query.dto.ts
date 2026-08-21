import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

export class SellerDashboardQueryDto {
  @ApiPropertyOptional({
    example: '2026-07-01T00:00:00.000Z',
    description: 'Inclusive UTC range start; defaults to 30 days before to',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @ApiPropertyOptional({
    example: '2026-08-01T00:00:00.000Z',
    description: 'Inclusive UTC range end; defaults to current time',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;
}
