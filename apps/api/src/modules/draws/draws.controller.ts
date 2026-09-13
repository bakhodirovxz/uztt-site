import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { EventType, Gender } from '@prisma/client';
import { DrawsService } from './draws.service';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user';

class GenerateDrawDto {
  @ApiProperty()
  @IsUUID()
  tournamentCategoryId!: string;
}

class CreateCategoryDto {
  @ApiProperty()
  @IsUUID()
  tournamentId!: string;

  @ApiProperty({ example: 'U13' })
  @IsString()
  ageCategoryCode!: string;

  @ApiPropertyOptional({
    enum: Gender,
    description: 'Aralash juftlik/jamoaviy uchun bo‘sh qoldiriladi',
  })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ enum: EventType, default: 'SINGLES' })
  @IsOptional()
  @IsEnum(EventType)
  eventType?: EventType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(128)
  maxEntries?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  registrationDeadline?: string;
}

class RegistrationStatusDto {
  @ApiProperty({ enum: ['CONFIRMED', 'REJECTED', 'WAITLIST', 'WITHDRAWN'] })
  @IsIn(['CONFIRMED', 'REJECTED', 'WAITLIST', 'WITHDRAWN'])
  status!: 'CONFIRMED' | 'REJECTED' | 'WAITLIST' | 'WITHDRAWN';

  @ApiPropertyOptional({
    description: 'Rad etish/chetlatish uchun MAJBURIY sabab',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

@ApiTags('draws')
@Controller('draws')
export class DrawsController {
  constructor(private readonly draws: DrawsService) {}

  @Public()
  @Get('tournament/:idOrSlug')
  byTournament(@Param('idOrSlug') idOrSlug: string) {
    return this.draws.byTournament(idOrSlug);
  }

  @Public()
  @Get('categories/:tournamentId')
  categories(@Param('tournamentId', ParseUUIDPipe) tournamentId: string) {
    return this.draws.categoriesOf(tournamentId);
  }

  /** Yosh kategoriyalari spravochnigi (admin formalar uchun) */
  @Public()
  @Get('age-categories')
  ageCategories() {
    return this.draws.ageCategories();
  }

  @Public()
  @Get(':id')
  bracket(@Param('id', ParseUUIDPipe) id: string) {
    return this.draws.bracket(id);
  }

  @Post('generate')
  @RequirePermissions('draw.manage')
  generate(@Body() dto: GenerateDrawDto) {
    return this.draws.generate(dto.tournamentCategoryId);
  }

  @Post('categories')
  @RequirePermissions('tournament.manage')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.draws.createCategory(dto);
  }

  @Get('registrations/:categoryId')
  @RequirePermissions('registration.manage')
  registrations(@Param('categoryId', ParseUUIDPipe) categoryId: string) {
    return this.draws.registrations(categoryId);
  }

  /** Tasdiqlash / rad etish / navbat / turnirdan chetlatish (sabab bilan) */
  @Post('registrations/:id/status')
  @RequirePermissions('registration.manage')
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegistrationStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.draws.setRegistrationStatus(
      id,
      dto.status,
      user.id,
      dto.reason,
    );
  }
}
