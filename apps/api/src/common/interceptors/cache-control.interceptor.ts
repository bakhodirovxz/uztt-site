import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

export const CACHE_FOR_KEY = 'cache:seconds';

/**
 * Ochiq va kam o'zgaruvchi javoblarni keshlash muddati (soniya).
 * Jonli hisob endpointlariga QO'YILMAYDI — ular har so'rovda yangi bo'lishi kerak.
 */
export const CacheFor = (seconds: number) =>
  SetMetadata(CACHE_FOR_KEY, seconds);

/**
 * Kesh siyosati:
 * - autentifikatsiya talab qiladigan javoblar — `no-store` (admin ma'lumoti
 *   brauzer yoki proksida qolib ketmasin);
 * - `@CacheFor(n)` bilan belgilangan ochiq javoblar — `public, max-age=n`
 *   va `stale-while-revalidate` (yangilanish fonda bo'ladi);
 * - qolgan ochiq javoblar — `no-cache` (validatsiya bilan, tez o'zgaradi).
 */
@Injectable()
export class CacheControlInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const http = context.switchToHttp();
    const req = http.getRequest<{ method: string }>();
    const res = http.getResponse<Response>();

    if (req?.method === 'GET' && typeof res?.setHeader === 'function') {
      const isPublic = this.reflector.getAllAndOverride<boolean>(
        IS_PUBLIC_KEY,
        [context.getHandler(), context.getClass()],
      );
      const seconds = this.reflector.getAllAndOverride<number>(CACHE_FOR_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

      if (!isPublic) {
        res.setHeader('Cache-Control', 'no-store');
      } else if (seconds && seconds > 0) {
        res.setHeader(
          'Cache-Control',
          `public, max-age=${seconds}, stale-while-revalidate=${seconds * 4}`,
        );
      } else {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }

    return next.handle();
  }
}
