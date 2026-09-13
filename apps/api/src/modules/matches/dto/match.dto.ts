import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
  OmitType,
} from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MatchStage } from '@prisma/client';

export class CreateMatchDto {
  @ApiProperty()
  @IsUUID()
  tournamentId!: string;

  @ApiPropertyOptional({ enum: MatchStage })
  @IsOptional()
  @IsEnum(MatchStage)
  stage?: MatchStage;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(64)
  tableNumber?: number;

  @ApiPropertyOptional({ example: '2026-08-02T14:00:00Z' })
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @IsIn([3, 5, 7])
  bestOf?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  player1Id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  player2Id?: string;
}

export class UpdateMatchDto extends PartialType(
  OmitType(CreateMatchDto, ['tournamentId'] as const),
) {}

export class VerifyCodeDto {
  @ApiProperty({ example: '111111' })
  @IsString()
  @Length(6, 6)
  code!: string;
}

export class PointDto {
  @ApiProperty({ enum: [1, 2] })
  @IsIn([1, 2])
  player!: 1 | 2;
}

export class CardDto {
  @ApiProperty({ enum: [1, 2] })
  @IsIn([1, 2])
  player!: 1 | 2;

  @ApiProperty({ enum: ['YELLOW', 'RED'] })
  @IsIn(['YELLOW', 'RED'])
  cardType!: 'YELLOW' | 'RED';
}

export class DisqualifyDto {
  @ApiProperty({ enum: [1, 2] })
  @IsIn([1, 2])
  player!: 1 | 2;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
