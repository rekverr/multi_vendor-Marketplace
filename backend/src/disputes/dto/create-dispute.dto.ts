import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trimString } from '../../common/transforms.js';

export class CreateDisputeDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  sellerOrderId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  orderItemId?: string;

  @ApiProperty({ minLength: 10, maxLength: 2000 })
  @Transform(trimString)
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason!: string;
}
