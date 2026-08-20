import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  Equals,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { ProductType } from '../../generated/prisma/client.js';

export class CreateProductDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ example: 'Mechanical Keyboard', maxLength: 200 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @ApiProperty({ example: 'Hot-swappable mechanical keyboard.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  description!: string;

  @ApiPropertyOptional({
    example: 'https://example.com/product.jpg',
    nullable: true,
  })
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  imageUrl?: string | null;

  @ApiProperty({ enum: [ProductType.FIXED_PRICE] })
  @Equals(ProductType.FIXED_PRICE)
  type!: ProductType;

  @ApiProperty({ example: '149.99', description: 'Decimal monetary value' })
  @IsString()
  @Matches(/^(0|[1-9]\d{0,16})(\.\d{1,2})?$/)
  price!: string;

  @ApiProperty({ example: 10, minimum: 0 })
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  stock!: number;
}
