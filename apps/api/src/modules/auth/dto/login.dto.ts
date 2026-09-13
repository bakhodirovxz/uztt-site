import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@uztt.uz' })
  @IsEmail({}, { message: 'Email formati noto‘g‘ri' })
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'kuchli-parol' })
  @IsString()
  @MinLength(6, { message: 'Parol kamida 6 belgi' })
  @MaxLength(128)
  password!: string;
}
