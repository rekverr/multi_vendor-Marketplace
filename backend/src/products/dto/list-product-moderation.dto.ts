import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

import { ProductStatus } from '../../generated/prisma/client.js';

export class ListProductModerationDto {
  @ApiPropertyOptional({
    enum: ProductStatus,
    default: ProductStatus.PENDING_REVIEW,
  })
  @IsOptional()
  @IsEnum(ProductStatus)
  status: ProductStatus = ProductStatus.PENDING_REVIEW;
}
