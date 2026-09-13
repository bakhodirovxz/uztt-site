import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService, TokenPair } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
} from './auth.constants';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly isProd: boolean;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.isProd = config.get('NODE_ENV') === 'production';
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 900_000 } }) // 20 urinish / 15 daqiqa / IP
  @ApiOperation({ summary: 'Email+parol bilan kirish (cookie beriladi)' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.auth.login(dto.email, dto.password, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    this.setCookies(res, tokens);
    return { user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Access tokenni yangilash (rotation)' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw = (req.cookies as Record<string, string>)?.[REFRESH_COOKIE];
    if (!raw) throw new UnauthorizedException('Sessiya topilmadi');
    const { user, tokens } = await this.auth.refresh(raw, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    this.setCookies(res, tokens);
    return { user };
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Chiqish — sessiya oilasi bekor qilinadi' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = (req.cookies as Record<string, string>)?.[REFRESH_COOKIE];
    await this.auth.logout(raw);
    this.clearCookies(res);
    return { ok: true };
  }

  @Get('me')
  @ApiOperation({ summary: 'Joriy foydalanuvchi (permissionlar bilan)' })
  async me(@CurrentUser() user: AuthUser) {
    // Bazadan yangilangan holat — rol o'zgargan bo'lsa darhol ko'rinadi
    return { user: await this.auth.me(user.id) };
  }

  // ==================== cookie yordamchilari ====================

  private setCookies(res: Response, tokens: TokenPair) {
    const common = {
      httpOnly: true,
      secure: this.isProd,
      sameSite: 'lax' as const,
    };
    res.cookie(ACCESS_COOKIE, tokens.accessToken, {
      ...common,
      path: '/',
      // access token qisqa umrli — cookie muddati ham qisqa (brauzer tozalaydi)
      maxAge: 60 * 60 * 1000,
    });
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      ...common,
      path: REFRESH_COOKIE_PATH,
      expires: tokens.refreshExpiresAt,
    });
  }

  private clearCookies(res: Response) {
    res.clearCookie(ACCESS_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
  }
}
