import { IsEnum, IsOptional } from 'class-validator';

import { SellerApplicationStatus } from '../../generated/prisma/client.js';

export class ListSellerApplicationsDto {
  @IsOptional()
  @IsEnum(SellerApplicationStatus)
  status?: SellerApplicationStatus;
}
