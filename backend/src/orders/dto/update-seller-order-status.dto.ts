import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { SellerOrderStatus } from '../../generated/prisma/client.js';

export class UpdateSellerOrderStatusDto {
  @ApiProperty({ enum: SellerOrderStatus })
  @IsEnum(SellerOrderStatus)
  status!: SellerOrderStatus;
}
