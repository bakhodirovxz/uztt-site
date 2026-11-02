import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { AssignmentService } from './assignment.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user';

class AssignDto {
  @IsOptional() @IsBoolean() dryRun?: boolean;
  @IsOptional() @IsBoolean() onlyUnassigned?: boolean;
  @IsOptional() @IsBoolean() needAssistant?: boolean;
}

class ManualDto {
  @IsOptional() @IsUUID() refereeUserId?: string | null;
  @IsOptional() @IsUUID() assistantUserId?: string | null;
}

@ApiTags('referee-assignment')
@Controller()
export class AssignmentController {
  constructor(private readonly svc: AssignmentService) {}

  @Post('tournaments/:id/assign-referees')
  @RequirePermissions('referee.assign')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  assign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignDto) {
    return this.svc.assignTournament(id, dto);
  }

  @Get('tournaments/:id/referee-overview')
  @RequirePermissions('referee.assign')
  overview(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.overview(id);
  }

  @Put('matches/:id/referees')
  @RequirePermissions('referee.assign')
  manual(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ManualDto) {
    return this.svc.setManual(id, dto.refereeUserId ?? null, dto.assistantUserId ?? null);
  }

  /** Hakamning o'ziga tayinlangan o'yinlar */
  @Get('referee/assigned')
  mine(@CurrentUser() user: AuthUser) {
    return this.svc.mine(user.id);
  }
}
