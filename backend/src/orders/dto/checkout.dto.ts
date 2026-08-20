import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CheckoutDto {
  @ApiPropertyOptional({
    description:
      'Stable client context used to detect conflicting reuse of an idempotency key',
    maxLength: 128,
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  requestContext?: string;
}
