import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { AppealsService } from './appeals.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user';

class CreateAppealDto {
  @ApiProperty({ enum: ['RATING', 'INTERPRETATION', 'ORGANIZATION'] })
  @IsIn(['RATING', 'INTERPRETATION', 'ORGANIZATION'])
  kind!: 'RATING' | 'INTERPRETATION' | 'ORGANIZATION';

  @ApiPropertyOptional({ description: 'Protest uchun majburiy' })
  @IsOptional()
  @IsUUID()
  matchId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  text!: string;
}

class DecideDto {
  @ApiProperty({ enum: ['REJECTED', 'ACCEPTED', 'RECALCULATE'] })
  @IsIn(['REJECTED', 'ACCEPTED', 'RECALCULATE'])
  status!: 'REJECTED' | 'ACCEPTED' | 'RECALCULATE';

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  decision!: string;
}

@ApiTags('appeals')
@Controller('appeals')
export class AppealsController {
  constructor(private readonly appeals: AppealsService) {}

  /** O'yinchi (shaxsiy kabinet) apellyatsiya/protest beradi */
  @Post()
  create(@Body() dto: CreateAppealDto, @CurrentUser() user: AuthUser) {
    return this.appeals.create(user.id, dto);
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.appeals.mine(user.id);
  }

  @Get()
  @RequirePermissions('ranking.adjust')
  list(@Query('status') status?: 'NEW' | 'REJECTED' | 'ACCEPTED' | 'RECALCULATE') {
    return this.appeals.list(status);
  }

  @Post(':id/decision')
  @RequirePermissions('ranking.adjust')
  decide(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideDto, @CurrentUser() user: AuthUser) {
    return this.appeals.decide(id, user.id, dto.status, dto.decision);
  }
}
