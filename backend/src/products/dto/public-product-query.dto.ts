import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const MONEY_PATTERN = /^\d{1,17}(?:\.\d{1,2})?$/;

export enum ProductSearchSort {
  NEWEST = 'newest',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
}

export class PublicProductQueryDto {
  @ApiPropertyOptional({ description: 'Full-text Product search' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 20;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @ApiPropertyOptional({ example: '10.00' })
  @IsOptional()
  @IsString()
  @Matches(MONEY_PATTERN)
  minPrice?: string;

  @ApiPropertyOptional({ example: '100.00' })
  @IsOptional()
  @IsString()
  @Matches(MONEY_PATTERN)
  maxPrice?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  available?: boolean;

  @ApiPropertyOptional({
    enum: ProductSearchSort,
    default: ProductSearchSort.NEWEST,
  })
  @IsOptional()
  @IsEnum(ProductSearchSort)
  sort: ProductSearchSort = ProductSearchSort.NEWEST;
}
