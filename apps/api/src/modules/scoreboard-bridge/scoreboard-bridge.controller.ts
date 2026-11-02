import { Body, Controller, Get, Headers, HttpCode, Post, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { timingSafeEqual } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../../common/decorators/public.decorator';
import { ScoreboardBridgeService } from './scoreboard-bridge.service';

/** Scoreboard dasturi bilan ulanish: umumiy maxfiy kalit (SB_SECRET) bilan himoyalangan */
@ApiTags('scoreboard-bridge')
@Controller('sb')
export class ScoreboardBridgeController {
  constructor(
    private readonly bridge: ScoreboardBridgeService,
    private readonly prisma: PrismaService,
  ) {}

  private check(secret?: string) {
    const expected = process.env.SB_SECRET;
    if (!expected || expected.length < 16) throw new ServiceUnavailableException('SB_SECRET sozlanmagan');
    const a = Buffer.from(secret ?? '');
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException();
  }

  @Public()
  @Get('export')
  async export(@Headers('x-sb-secret') secret?: string) {
    this.check(secret);
    return this.bridge.export();
  }

  @Public()
  @Post('result')
  @HttpCode(200)
  async result(
    @Headers('x-sb-secret') secret: string | undefined,
    @Body() body: { siteId: string; sets: Array<[number, number]> },
  ) {
    this.check(secret);
    const root = await this.prisma.user.findFirst({
      where: { roles: { some: { role: { code: 'SUPERADMIN' } } } },
      select: { id: true },
    });
    if (!root) throw new ServiceUnavailableException('Administrator topilmadi');
    return this.bridge.applyResult(String(body?.siteId ?? ''), body?.sets ?? [], root.id);
  }
}
