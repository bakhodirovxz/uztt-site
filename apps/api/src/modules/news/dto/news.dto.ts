import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { NewsStatus } from '@prisma/client';

export class NewsTranslationDto {
  @ApiProperty({ enum: ['uz', 'ru', 'en'] })
  @IsIn(['uz', 'ru', 'en'])
  locale!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  excerpt?: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  body!: string;
}

export class CreateNewsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ enum: NewsStatus })
  @IsOptional()
  @IsEnum(NewsStatus)
  status?: NewsStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImageUrl?: string;

  @ApiPropertyOptional({
    description: "Musobaqaga bog'lash (event sahifasidagi yangiliklar tabi)",
  })
  @IsOptional()
  @IsUUID()
  tournamentId?: string;

  @ApiProperty({ type: [NewsTranslationDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => NewsTranslationDto)
  translations!: NewsTranslationDto[];
}

export class UpdateNewsDto extends PartialType(CreateNewsDto) {}
