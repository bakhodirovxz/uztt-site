import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ClubsService } from './clubs.service';
import { Public } from '../../common/decorators/public.decorator';
import { CacheFor } from '../../common/interceptors/cache-control.interceptor';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user';

class ClubDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(120) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) clubType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) regionName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) districtName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) address?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^\+?[0-9 ()-]{7,20}$/, { message: 'Telefon raqami noto‘g‘ri' }) phoneNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) coachName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) managerName?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(200) tableCount?: number;
}

class UpdateClubDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3) @MaxLength(120) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) clubType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) regionName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) districtName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) address?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^\+?[0-9 ()-]{7,20}$/, { message: 'Telefon raqami noto‘g‘ri' }) phoneNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) coachName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) managerName?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(200) tableCount?: number;
}

class ReviewDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'] }) @IsIn(['APPROVE', 'REJECT']) decision!: 'APPROVE' | 'REJECT';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

@ApiTags('clubs')
@Controller('clubs')
export class ClubsController {
  constructor(private readonly clubs: ClubsService) {}

  @Public()
  @CacheFor(60)
  @Get()
  list(@Query('q') q?: string, @Query('region') region?: string, @Query('page') page?: string) {
    return this.clubs.list(q, region, Math.min(500, Math.max(1, Number(page) || 1)));
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.clubs.mine(user.id);
  }

  @Get('pending')
  @RequirePermissions('applicant.review')
  pending() {
    return this.clubs.pending();
  }

  @Public()
  @CacheFor(60)
  @Get(':idOrSlug')
  detail(@Param('idOrSlug') idOrSlug: string) {
    return this.clubs.detail(idOrSlug);
  }

  /** Klub ochish arizasi — tasdiqlangan murabbiy; soatiga 10 ta */
  @Post('request')
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @RequirePermissions('coach.players.manage')
  request(@Body() dto: ClubDto, @CurrentUser() user: AuthUser) {
    return this.clubs.request(user.id, dto);
  }

  @Post()
  @RequirePermissions('club.manage')
  create(@Body() dto: ClubDto) {
    return this.clubs.create(dto);
  }

  /** Admin (club.manage) yoki klub egasi (cheklangan maydonlar) */
  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateClubDto, @CurrentUser() user: AuthUser) {
    return this.clubs.update(id, dto, user);
  }

  @Post(':id/review')
  @RequirePermissions('applicant.review')
  review(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewDto) {
    return this.clubs.review(id, dto.decision, dto.reason);
  }
}
