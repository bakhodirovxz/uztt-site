import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PointRuleKey } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CacheFor } from '../../common/interceptors/cache-control.interceptor';
import { POINT_RULE_KEYS, RULE_LABEL_UZ } from './level-rules';

class PointRuleDto {
  @ApiProperty({ enum: PointRuleKey })
  @IsEnum(PointRuleKey)
  key!: PointRuleKey;

  @ApiProperty({ description: 'Shu holat uchun beriladigan ball' })
  @IsInt()
  @Min(0)
  @Max(100_000)
  points!: number;
}

class CreateLevelDto {
  @ApiProperty({ example: 'NATIONAL' })
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  @Matches(/^[A-Z0-9_]+$/, {
    message: 'Kod faqat KATTA harf, raqam va _ dan iborat bo‘lsin',
  })
  code!: string;

  @ApiProperty() @IsString() @MinLength(2) @MaxLength(80) name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @ApiPropertyOptional({
    description: 'Reglamentsiz (eski) hisob uchun koeffitsiyent',
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(10)
  coefficient?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sortOrder?: number;

  @ApiPropertyOptional({ type: [PointRuleDto], description: 'Ball reglamenti' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PointRuleDto)
  rules?: PointRuleDto[];
}

class UpdateLevelDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(10)
  coefficient?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sortOrder?: number;

  @ApiPropertyOptional({ type: [PointRuleDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PointRuleDto)
  rules?: PointRuleDto[];
}

/**
 * Musobaqa darajalari = REGLAMENT.
 * Har daraja o'z ball jadvaliga ega; musobaqa ochilganda daraja tanlanadi va
 * o'yinlar aynan shu reglament bo'yicha ball beradi.
 */
@ApiTags('levels')
@Controller('levels')
export class LevelsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Reglament kalitlari spravochnigi (forma uchun) */
  @Public()
  @CacheFor(3600)
  @Get('rule-keys')
  ruleKeys() {
    return POINT_RULE_KEYS.map((key) => ({ key, label: RULE_LABEL_UZ[key] }));
  }

  @Public()
  @CacheFor(300)
  @Get()
  async list() {
    const levels = await this.prisma.tournamentLevel.findMany({
      orderBy: [{ sortOrder: 'asc' }, { coefficient: 'desc' }],
      include: {
        pointsRules: true,
        _count: { select: { tournaments: true } },
      },
    });
    return levels.map(({ _count, pointsRules, ...level }) => ({
      ...level,
      tournamentCount: _count.tournaments,
      rules: this.sortRules(pointsRules),
    }));
  }

  @Public()
  @CacheFor(300)
  @Get(':code')
  async detail(@Param('code') code: string) {
    const level = await this.prisma.tournamentLevel.findUnique({
      where: { code },
      include: { pointsRules: true },
    });
    if (!level) throw new NotFoundException('Daraja topilmadi');
    return { ...level, rules: this.sortRules(level.pointsRules) };
  }

  @Post()
  @RequirePermissions('tournament.manage')
  async create(@Body() dto: CreateLevelDto) {
    const exists = await this.prisma.tournamentLevel.findUnique({
      where: { code: dto.code },
    });
    if (exists) throw new BadRequestException('Bu kod band');

    const level = await this.prisma.tournamentLevel.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        coefficient: dto.coefficient ?? 1,
        sortOrder: dto.sortOrder ?? 0,
        pointsRules: { create: this.dedupeRules(dto.rules) },
      },
      include: { pointsRules: true },
    });
    return { ...level, rules: this.sortRules(level.pointsRules) };
  }

  @Put(':code')
  @RequirePermissions('tournament.manage')
  async update(@Param('code') code: string, @Body() dto: UpdateLevelDto) {
    const level = await this.prisma.tournamentLevel.findUnique({
      where: { code },
    });
    if (!level) throw new NotFoundException('Daraja topilmadi');

    // Reglament yuborilgan bo'lsa — to'liq almashtiriladi (aniq holat)
    if (dto.rules) {
      await this.prisma.levelPointsRule.deleteMany({
        where: { levelId: level.id },
      });
      const rules = this.dedupeRules(dto.rules);
      if (rules.length > 0) {
        await this.prisma.levelPointsRule.createMany({
          data: rules.map((r) => ({ ...r, levelId: level.id })),
        });
      }
    }

    const updated = await this.prisma.tournamentLevel.update({
      where: { code },
      data: {
        name: dto.name,
        description: dto.description,
        coefficient: dto.coefficient,
        sortOrder: dto.sortOrder,
      },
      include: { pointsRules: true },
    });
    return { ...updated, rules: this.sortRules(updated.pointsRules) };
  }

  @Delete(':code')
  @RequirePermissions('tournament.manage')
  async remove(@Param('code') code: string) {
    const level = await this.prisma.tournamentLevel.findUnique({
      where: { code },
      include: { _count: { select: { tournaments: true } } },
    });
    if (!level) throw new NotFoundException('Daraja topilmadi');
    if (level._count.tournaments > 0) {
      throw new BadRequestException(
        `Bu darajada ${level._count.tournaments} ta musobaqa bor — avval ularning darajasini o‘zgartiring`,
      );
    }
    await this.prisma.tournamentLevel.delete({ where: { code } });
    return { ok: true };
  }

  /** Bir kalit ikki marta yuborilsa — oxirgisi qoladi */
  private dedupeRules(rules?: PointRuleDto[]) {
    const map = new Map<PointRuleKey, number>();
    for (const r of rules ?? []) map.set(r.key, r.points);
    return [...map.entries()].map(([key, points]) => ({ key, points }));
  }

  /** Reglament doim bir xil (mantiqiy) tartibda qaytadi */
  private sortRules(rules: Array<{ key: PointRuleKey; points: number }>) {
    return POINT_RULE_KEYS.filter((key) =>
      rules.some((r) => r.key === key),
    ).map((key) => ({
      key,
      label: RULE_LABEL_UZ[key],
      points: rules.find((r) => r.key === key)!.points,
    }));
  }
}
