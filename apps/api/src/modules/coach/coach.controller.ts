import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CoachService } from './coach.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user';

class UpdateCoachDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) club?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  licenseNumber?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;
}

class AddPlayerDto {
  @ApiProperty({ example: 'UZ-1001' })
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  licenseNumber!: string;
}

class CoachRegisterDto {
  @ApiProperty() @IsUUID() playerId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
}

@ApiTags('coach')
@Controller('coach')
export class CoachController {
  constructor(private readonly coach: CoachService) {}

  @Get('me')
  @RequirePermissions('coach.players.manage')
  me(@CurrentUser() user: AuthUser) {
    return this.coach.myProfile(user.id);
  }

  @Put('me')
  @RequirePermissions('coach.players.manage')
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateCoachDto) {
    return this.coach.updateProfile(user.id, dto);
  }

  @Post('players')
  @RequirePermissions('coach.players.manage')
  addPlayer(@CurrentUser() user: AuthUser, @Body() dto: AddPlayerDto) {
    return this.coach.addPlayer(user.id, dto.licenseNumber);
  }

  @Delete('players/:playerId')
  @RequirePermissions('coach.players.manage')
  removePlayer(
    @CurrentUser() user: AuthUser,
    @Param('playerId', ParseUUIDPipe) playerId: string,
  ) {
    return this.coach.removePlayer(user.id, playerId);
  }

  @Get('tournaments/:tournamentId/eligible/:playerId')
  @RequirePermissions('coach.players.register')
  eligible(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('playerId', ParseUUIDPipe) playerId: string,
  ) {
    return this.coach.eligibleFor(user.id, playerId, tournamentId);
  }

  @Post('tournaments/:tournamentId/register')
  @RequirePermissions('coach.players.register')
  register(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Body() dto: CoachRegisterDto,
  ) {
    return this.coach.registerPlayer(
      user.id,
      dto.playerId,
      tournamentId,
      dto.categoryId,
    );
  }
}
