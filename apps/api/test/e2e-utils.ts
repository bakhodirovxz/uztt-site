import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * E2E testlar UCHUN muhit:
 * - ishlaydigan Postgres (DATABASE_URL) va qo'llangan migratsiyalar,
 * - seed bajarilgan bo'lishi (test hisoblari shundan keladi).
 * Ishga tushirish: pnpm --filter @uztt/api test:e2e
 */

/** CSRF guard uchun: cookie yuborilganda Origin allowlist'da bo'lishi shart */
export const ORIGIN = (process.env.WEB_ORIGIN ?? 'http://localhost:3100')
  .split(',')[0]
  .trim();

export const ACCOUNTS = {
  root: { email: 'admin@uztt.uz', password: 'admin123' },
  editor: { email: 'muharrir@uztt.uz', password: 'muharrir123' },
  referee: { email: 'hakam1@uztt.uz', password: 'hakam123' },
  player: { email: 'oyinchi@uztt.uz', password: 'oyinchi123' },
} as const;

/** main.ts dagi global sozlamalar bilan bir xil ilova (prefiks, pipe, cookie) */
export async function createTestApp(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();
  return app;
}

/** Tizimga kiradi va cookie'larni qaytaradi (keyingi so'rovlarda ishlatiladi) */
export async function login(
  app: INestApplication<App>,
  account: { email: string; password: string },
): Promise<string[]> {
  // Login @HttpCode(200) bilan javob beradi (yangi resurs yaratilmaydi)
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .set('Origin', ORIGIN)
    .send(account)
    .expect(200);

  const raw = res.headers['set-cookie'];
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (cookies.length === 0) {
    throw new Error('Login cookie qaytarmadi — seed bajarilganini tekshiring');
  }
  return cookies;
}

/** Javob ichida (chuqur) berilgan kalitlardan biri bormi? */
export function findLeakedKey(value: unknown, keys: string[]): string | null {
  const seen = new Set<unknown>();
  const walk = (node: unknown): string | null => {
    if (!node || typeof node !== 'object') return null;
    if (seen.has(node)) return null;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) {
        const hit = walk(item);
        if (hit) return hit;
      }
      return null;
    }
    for (const [k, v] of Object.entries(node)) {
      if (keys.includes(k)) return k;
      const hit = walk(v);
      if (hit) return hit;
    }
    return null;
  };
  return walk(value);
}
