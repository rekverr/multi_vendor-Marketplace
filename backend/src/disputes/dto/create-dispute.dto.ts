import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateDisputeDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  sellerOrderId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  orderItemId?: string;

  @ApiProperty({ minLength: 10, maxLength: 2000 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason!: string;
}
