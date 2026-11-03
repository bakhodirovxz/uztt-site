import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  Max,
  Min,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Gender, TournamentStatus } from '@prisma/client';

export class CreateTournamentDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'NATIONAL' })
  @IsString()
  levelCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  venue?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiProperty({ example: '2026-09-01' })
  @IsISO8601()
  startDate!: string;

  @ApiProperty({ example: '2026-09-05' })
  @IsISO8601()
  endDate!: string;

  // Scoreboard'dagi stollar soni (COURTS, standart 10) bilan bir xil chegara
  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  tableCount?: number;

  @ApiPropertyOptional({ example: [1, 2], type: [Number] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(10, { each: true })
  mainTables?: number[];
}

export class UpdateTournamentDto extends PartialType(CreateTournamentDto) {
  @ApiPropertyOptional({ enum: TournamentStatus })
  @IsOptional()
  @IsEnum(TournamentStatus)
  status?: TournamentStatus;
}
