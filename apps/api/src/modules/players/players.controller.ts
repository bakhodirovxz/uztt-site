import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PlayersService } from './players.service';
import {
  CreatePlayerDto,
  ListPlayersQueryDto,
  UpdatePlayerDto,
} from './dto/player.dto';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CacheFor } from '../../common/interceptors/cache-control.interceptor';

@ApiTags('players')
@Controller('players')
export class PlayersController {
  constructor(private readonly players: PlayersService) {}

  @Public()
  @Get()
  list(@Query() query: ListPlayersQueryDto) {
    return this.players.list(query);
  }

  /** Filtr uchun viloyatlar ro'yxati — butun ro'yxatni tortmaslik uchun */
  @Public()
  @CacheFor(300)
  @Get('regions')
  regions() {
    return this.players.regions();
  }

  @Public()
  @Get(':idOrSlug')
  detail(@Param('idOrSlug') idOrSlug: string) {
    return this.players.detail(idOrSlug);
  }

  /** Reyting grafigi va o'yin statistikasi (profil sahifasi uchun) */
  @Public()
  @Get(':idOrSlug/history')
  history(@Param('idOrSlug') idOrSlug: string) {
    return this.players.history(idOrSlug);
  }

  /** Qarshilashuvlar tarixi: /players/aliyev/vs/karimov */
  @Public()
  @Get(':a/vs/:b')
  headToHead(@Param('a') a: string, @Param('b') b: string) {
    return this.players.headToHead(a, b);
  }

  @Post()
  @RequirePermissions('player.manage')
  create(@Body() dto: CreatePlayerDto) {
    return this.players.create(dto);
  }

  @Put(':id')
  @RequirePermissions('player.manage')
  update(@Param('id') id: string, @Body() dto: UpdatePlayerDto) {
    return this.players.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('player.manage')
  remove(@Param('id') id: string) {
    return this.players.remove(id);
  }
}
