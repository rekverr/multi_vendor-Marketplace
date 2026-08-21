import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { trimString } from '../../common/transforms.js';

export class RejectSellerApplicationDto {
  @Transform(trimString)
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}
