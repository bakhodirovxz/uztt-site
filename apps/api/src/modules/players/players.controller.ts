import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Throttle } from '@nestjs/throttler';
import { PlayerPhotoService } from './player-photo.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user';
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
  constructor(
    private readonly players: PlayersService,
    private readonly photos: PlayerPhotoService,
  ) {}

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

  /** Rasm yuklash: admin (player.manage) yoki o'yinchining o'zi. Server qayta kodlaydi (sharp) */
  @Post(':id/photo')
  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  uploadPhoto(@Param('id') id: string, @CurrentUser() user: AuthUser, @UploadedFile() file?: Express.Multer.File) {
    return this.photos.upload(id, file, user);
  }

  @Delete(':id')
  @RequirePermissions('player.manage')
  remove(@Param('id') id: string) {
    return this.players.remove(id);
  }
}
