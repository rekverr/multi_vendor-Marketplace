import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { DisputeStatus } from '../../generated/prisma/client.js';

export class UpdateDisputeStatusDto {
  @ApiProperty({ enum: DisputeStatus })
  @IsEnum(DisputeStatus)
  status!: DisputeStatus;

  @ApiPropertyOptional({ minLength: 3, maxLength: 2000 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  resolutionNote?: string;
}
