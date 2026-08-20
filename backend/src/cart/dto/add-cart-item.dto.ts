import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { Allow, IsInt, IsUUID, Max, Min } from 'class-validator';

export class AddCartItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ minimum: 1, maximum: 999 })
  @IsInt()
  @Min(1)
  @Max(999)
  quantity!: number;

  @ApiHideProperty()
  @Allow()
  price?: unknown;

  @ApiHideProperty()
  @Allow()
  sellerId?: unknown;

  @ApiHideProperty()
  @Allow()
  userId?: unknown;
}
