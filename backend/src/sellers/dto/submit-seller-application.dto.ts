import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { trimString } from '../../common/transforms.js';

export class SubmitSellerApplicationDto {
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  displayName!: string;
}
