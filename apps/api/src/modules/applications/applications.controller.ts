import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApplicationsService } from './applications.service';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user';

const PHONE = /^\+?[0-9 ()-]{7,20}$/;

class ApplicantBase {
  @ApiProperty() @IsEmail() @MaxLength(254) email!: string;
  @ApiProperty({ description: 'Kamida 10 belgi' })
  @IsString()
  @MinLength(10)
  @MaxLength(128)
  password!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(60) firstName!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(60) lastName!: string;
  @ApiPropertyOptional() @IsOptional() @Matches(PHONE, { message: 'Telefon raqami noto‘g‘ri' }) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) region?: string;
}

class RefereeApplicationDto extends ApplicantBase {
  @ApiPropertyOptional({ enum: ['INTERNATIONAL', 'NATIONAL', 'FIRST', 'SECOND', 'THIRD'] })
  @IsOptional()
  @IsIn(['INTERNATIONAL', 'NATIONAL', 'FIRST', 'SECOND', 'THIRD'])
  category?: 'INTERNATIONAL' | 'NATIONAL' | 'FIRST' | 'SECOND' | 'THIRD';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) certification?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1950) @Max(2100) since?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) bio?: string;
}

class CoachApplicationDto extends ApplicantBase {
  @ApiPropertyOptional() @IsOptional() @IsUUID() clubId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) licenseNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) bio?: string;
}

class ReviewDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'] })
  @IsIn(['APPROVE', 'REJECT'])
  decision!: 'APPROVE' | 'REJECT';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

@ApiTags('applications')
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly apps: ApplicationsService) {}

  /** Hakam bo'lib ro'yxatdan o'tish (ommaviy). IP bo'yicha soatiga 5 ta. Rol berilmaydi — admin tasdiqlaydi. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @Post('referee')
  applyReferee(@Body() dto: RefereeApplicationDto) {
    return this.apps.applyReferee(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @Post('coach')
  applyCoach(@Body() dto: CoachApplicationDto) {
    return this.apps.applyCoach(dto);
  }

  @Get('me')
  mine(@CurrentUser() user: AuthUser) {
    return this.apps.mine(user.id);
  }

  @Get()
  @RequirePermissions('applicant.review')
  list(
    @Query('type') type: 'referee' | 'coach' = 'referee',
    @Query('status') status?: 'PENDING' | 'APPROVED' | 'REJECTED',
  ) {
    return this.apps.list(type === 'coach' ? 'coach' : 'referee', status);
  }

  @Post(':type/:userId/review')
  @RequirePermissions('applicant.review')
  review(
    @Param('type') type: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: ReviewDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (type !== 'coach' && type !== 'referee') throw new BadRequestException("Tur 'referee' yoki 'coach'");
    const t = type;
    return this.apps.review(t, userId, dto.decision, user.id, dto.reason);
  }
}
