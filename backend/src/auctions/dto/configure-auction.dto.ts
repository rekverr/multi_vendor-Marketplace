import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString, Matches } from 'class-validator';

const POSITIVE_MONEY_PATTERN =
  /^(?!0(?:\.0{1,2})?$)(?:0|[1-9]\d{0,16})(?:\.\d{1,2})?$/;

export class ConfigureAuctionDto {
  @ApiProperty({ example: '25.00' })
  @IsString()
  @Matches(POSITIVE_MONEY_PATTERN)
  startingPrice!: string;

  @ApiProperty({ example: '1.00' })
  @IsString()
  @Matches(POSITIVE_MONEY_PATTERN)
  minimumIncrement!: string;

  @ApiProperty({ format: 'date-time' })
  @IsDateString({ strict: true })
  startsAt!: string;

  @ApiProperty({ format: 'date-time' })
  @IsDateString({ strict: true })
  endsAt!: string;
}
