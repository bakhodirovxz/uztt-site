import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { MatchesService } from './matches.service';
import {
  CardDto,
  CreateMatchDto,
  DisqualifyDto,
  PointDto,
  UpdateMatchDto,
  VerifyCodeDto,
} from './dto/match.dto';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user';

/** `match.manage` — istalgan o'yinda hisob kiritishi mumkin (tayinlangan hakam bo'lmasa ham) */
const isManager = (user: AuthUser) => user.permissions.includes('match.manage');

@ApiTags('matches')
@Controller('matches')
export class MatchesController {
  constructor(private readonly matches: MatchesService) {}

  // ==================== PUBLIC ====================

  @Public()
  @Get('live')
  liveList() {
    return this.matches.liveList();
  }

  @Public()
  @Get('overlay/:token')
  overlay(@Param('token') token: string) {
    return this.matches.publicByOverlayToken(token);
  }

  /** Stol overlay/monitori: joriy o'yin (OBS URL'i kun bo'yi o'zgarmaydi) */
  @Public()
  @Get('table/:tableNumber/current')
  tableCurrent(@Param('tableNumber', ParseIntPipe) tableNumber: number) {
    return this.matches.currentByTable(tableNumber);
  }

  /** Monitor uchun keyingi o'yinlar jadvali */
  @Public()
  @Get('table/:tableNumber/schedule')
  tableSchedule(@Param('tableNumber', ParseIntPipe) tableNumber: number) {
    return this.matches.scheduleByTable(tableNumber);
  }

  @Public()
  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.matches.publicById(id);
  }

  // ==================== ADMIN ====================

  @Get()
  @RequirePermissions('match.manage')
  adminList(@Query('tournamentId') tournamentId?: string) {
    return this.matches.adminList(tournamentId);
  }

  @Post()
  @RequirePermissions('match.manage')
  create(@Body() dto: CreateMatchDto) {
    return this.matches.create(dto);
  }

  @Put(':id')
  @RequirePermissions('match.manage')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMatchDto) {
    return this.matches.update(id, dto);
  }

  @Post(':id/regenerate-code')
  @RequirePermissions('match.manage')
  regenerateCode(@Param('id', ParseUUIDPipe) id: string) {
    return this.matches.regenerateCode(id);
  }

  // ==================== HAKAM ====================

  @Get('referee/list')
  @RequirePermissions('match.score')
  refereeList(@Query('all') all?: string) {
    return this.matches.refereeList({ all: all === '1' || all === 'true' });
  }

  @Post(':id/verify')
  @RequirePermissions('match.score')
  verify(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyCodeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.matches.verify(id, dto.code, user.id, isManager(user));
  }

  /**
   * Hisob kiritish IP chegarasidan CHIQARILGAN: zalda hamma hakam planshetlari va
   * tomoshabinlar bitta Wi-Fi (bitta tashqi IP) orqasida bo'ladi — umumiy 300/daq
   * chegara o'yin o'rtasida hakamga 429 berib qo'yardi (yuk sinovida tasdiqlangan).
   * Himoya: JWT + CSRF + `match.score` ruxsati + hakam kodi bilan tasdiqlangan o'yin.
   */
  @SkipThrottle()
  @Post(':id/point')
  @RequirePermissions('match.score')
  point(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PointDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.matches.point(id, dto.player, user.id, isManager(user));
  }

  @SkipThrottle()
  @Post(':id/undo')
  @RequirePermissions('match.score')
  undo(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.matches.undo(id, user.id, isManager(user));
  }

  @SkipThrottle()
  @Post(':id/card')
  @RequirePermissions('match.score')
  card(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CardDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.matches.card(id, dto.player, dto.cardType, user.id, isManager(user));
  }

  /** Taym-aut: har o'yinchiga o'yinda bir marta, 1 daqiqa (3.4.4.2) */
  @SkipThrottle()
  @Post(':id/timeout')
  @RequirePermissions('match.score')
  timeout(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PointDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.matches.timeout(id, dto.player, user.id, isManager(user));
  }

  @Post(':id/disqualify')
  @RequirePermissions('match.score')
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseInterceptors(
    FileInterceptor('audio', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    }),
  )
  disqualify(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DisqualifyDto,
    @CurrentUser() user: AuthUser,
    @UploadedFile() audio?: Express.Multer.File,
  ) {
    return this.matches.disqualify(
      id,
      Number(dto.player) as 1 | 2,
      dto.reason,
      audio ? { buffer: audio.buffer, mimetype: audio.mimetype } : undefined,
      user.id,
      isManager(user),
    );
  }
}
