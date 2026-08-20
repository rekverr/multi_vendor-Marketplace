import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class PlaceBidDto {
  @ApiProperty({ example: '30.00' })
  @IsString()
  @Matches(/^(?!0(?:\.0{1,2})?$)(?:0|[1-9]\d{0,16})(?:\.\d{1,2})?$/)
  amount!: string;
}
