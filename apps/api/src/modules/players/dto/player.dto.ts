import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Gender, PlayerStatus } from '@prisma/client';

export class CreatePlayerDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  lastName!: string;

  @ApiProperty({ enum: Gender })
  @IsEnum(Gender)
  gender!: Gender;

  @ApiProperty()
  @IsString()
  @MaxLength(60)
  region!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  club?: string;

  @ApiPropertyOptional({ example: '2010-04-15' })
  @IsOptional()
  @IsISO8601()
  birthDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  licenseNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoUrl?: string;
}

export class UpdatePlayerDto extends PartialType(CreatePlayerDto) {
  @ApiPropertyOptional({ enum: PlayerStatus })
  @IsOptional()
  @IsEnum(PlayerStatus)
  status?: PlayerStatus;
}

/**
 * Ommaviy o'yinchilar ro'yxati uchun so'rov parametrlari.
 * Global ValidationPipe `forbidNonWhitelisted` bilan ishlagani uchun bu DTO
 * ham chegaralarni majburlaydi, ham ortiqcha parametrlarni rad etadi.
 * Chegarasiz `search`/`region` satri 5500 qatorli `contains` qidiruviga
 * tushib, arzon protsessor yuki vektorini ochib qo'yardi.
 */
export class ListPlayersQueryDto {
  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  region?: string;

  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  search?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 500, default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}
