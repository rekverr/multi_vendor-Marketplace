import { IsString, MaxLength, MinLength } from 'class-validator';

export class GoogleCallbackDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  code!: string;

  @IsString()
  @MinLength(32)
  @MaxLength(128)
  state!: string;
}
