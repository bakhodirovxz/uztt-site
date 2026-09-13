import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF himoyasi (cookie-auth uchun): mutatsiya so'rovlarida Origin
 * allowlist'da bo'lishi shart. SameSite=Lax cookie + shu tekshiruv
 * JSON API uchun yetarli himoya beradi.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly allowedOrigins: Set<string>;

  constructor(config: ConfigService) {
    const origins = (config.get<string>('WEB_ORIGIN') ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    this.allowedOrigins = new Set(origins);
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;

    // Cookie yuborilmagan bo'lsa (masalan, server-to-server yoki test),
    // CSRF xavfi yo'q — brauzer sessiyasi ishlatilmayapti.
    if (!req.headers.cookie) return true;

    const origin = req.headers.origin;
    if (origin && this.allowedOrigins.has(origin)) return true;

    // Ba'zi brauzer so'rovlarida Origin bo'lmaydi (masalan, same-origin GET
    // form emas) — Referer'ga qaraymiz.
    const referer = req.headers.referer;
    if (referer) {
      try {
        const refOrigin = new URL(referer).origin;
        if (this.allowedOrigins.has(refOrigin)) return true;
      } catch {
        // noto'g'ri Referer — rad etiladi
      }
    }

    throw new ForbiddenException('CSRF tekshiruvi muvaffaqiyatsiz');
  }
}
