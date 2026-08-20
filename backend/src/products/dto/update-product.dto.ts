import { OmitType, PartialType } from '@nestjs/swagger';

import { CreateProductDto } from './create-product.dto.js';

export class UpdateProductDto extends PartialType(
  OmitType(CreateProductDto, ['type'] as const),
) {}
