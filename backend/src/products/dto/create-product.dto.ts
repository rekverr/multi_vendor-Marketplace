import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
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
import { trimString } from '../../common/transforms.js';

export class CreateProductDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ example: 'Mechanical Keyboard', maxLength: 200 })
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @ApiProperty({ example: 'Hot-swappable mechanical keyboard.' })
  @Transform(trimString)
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

  @ApiProperty({ enum: ProductType })
  @IsEnum(ProductType)
  type!: ProductType;

  @ApiPropertyOptional({
    example: '149.99',
    description: 'Required only for FIXED_PRICE Products',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(0|[1-9]\d{0,16})(\.\d{1,2})?$/)
  price?: string;

  @ApiProperty({ example: 10, minimum: 0 })
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  stock!: number;
}
