import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty() @IsString() @MinLength(6) @MaxLength(128) currentPassword!: string;
  @ApiProperty({ description: 'Kamida 10 belgi' })
  @IsString()
  @MinLength(10, { message: 'Yangi parol kamida 10 belgi' })
  @MaxLength(128)
  newPassword!: string;
}
