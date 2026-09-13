import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TournamentStatus } from '@prisma/client';
import { TournamentsService } from './tournaments.service';
import { CreateTournamentDto, UpdateTournamentDto } from './dto/tournament.dto';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Revalidates } from '../../common/revalidate/revalidate.decorator';

const LOCALES = ['uz', 'ru', 'en'];

@ApiTags('tournaments')
@Revalidates('tournaments')
@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournaments: TournamentsService) {}

  @Public()
  @Get()
  list(
    @Query('status') status?: TournamentStatus,
    @Query('locale') locale?: string,
  ) {
    return this.tournaments.list({
      status:
        status && Object.values(TournamentStatus).includes(status)
          ? status
          : undefined,
      locale: LOCALES.includes(locale ?? '') ? locale : undefined,
    });
  }

  @Public()
  @Get('levels')
  levels() {
    return this.tournaments.levels();
  }

  @Public()
  @Get(':idOrSlug')
  detail(
    @Param('idOrSlug') idOrSlug: string,
    @Query('locale') locale?: string,
  ) {
    return this.tournaments.detail(
      idOrSlug,
      LOCALES.includes(locale ?? '') ? locale : undefined,
    );
  }

  @Post()
  @RequirePermissions('tournament.manage')
  create(@Body() dto: CreateTournamentDto) {
    return this.tournaments.create(dto);
  }

  @Put(':id')
  @RequirePermissions('tournament.manage')
  update(@Param('id') id: string, @Body() dto: UpdateTournamentDto) {
    return this.tournaments.update(id, dto);
  }
}
