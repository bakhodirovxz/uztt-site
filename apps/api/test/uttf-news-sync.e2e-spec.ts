import { INestApplication } from '@nestjs/common';
import { createServer, Server } from 'http';
import request from 'supertest';
import sharp from 'sharp';
import type { App } from 'supertest/types';
import type { PrismaService as PrismaServiceType } from '../src/prisma/prisma.service';

/** uttf.uz yangiliklar sinxronizatsiyasi — soxta manba serveri bilan (3 til, sahifalash, takrorlanmaslik) */
describe('uttf.uz yangiliklarni olish (e2e, soxta manba)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaServiceType;
  let fake: Server;
  let admin: string[];
  const base = 9_100_000 + (Date.now() % 100_000) * 10; // boshqa testlar bilan to'qnashmasin
  const ids = [base + 1, base + 2, base + 3];
  const data: Record<string, Array<{ id: number; title: string; description: string }>> = {
    uz: [1, 2, 3].map((i) => ({ id: base + i, title: `Yangilik ${i} sarlavha`, description: `O'zbekcha matn ${i} — yetarlicha uzun matn` })),
    ru: [1, 2].map((i) => ({ id: base + i, title: `Новость ${i} заголовок`, description: `Русский текст ${i} достаточно длинный` })),
    en: [
      { id: base + 1, title: 'News 1 title', description: 'English text 1 long enough' },
      { id: base + 3, title: 'Yangilik 3 sarlavha', description: 'same as uz (not translated)' },
    ],
  };
  const hits: string[] = [];

  beforeAll(async () => {
    const png = await sharp({ create: { width: 640, height: 360, channels: 3, background: '#246' } }).png().toBuffer();
    fake = createServer((req, res) => {
      const u = new URL(req.url ?? '/', 'http://x');
      hits.push(u.pathname);
      const lang = String(req.headers['accept-language'] ?? 'uz');
      if (u.pathname.includes('/files/get-file/')) { res.setHeader('Content-Type', 'image/png'); return res.end(png); }
      res.setHeader('Content-Type', 'application/json');
      if (u.pathname.endsWith('/news/index')) {
        const all = data[lang] ?? [];
        const page = Number(u.searchParams.get('page') ?? 0); const size = Number(u.searchParams.get('size') ?? 10);
        const rows = all.slice(page * size, page * size + size).map((n) => ({ ...n, tag: n.title, photoId: 'abcdef12-aaaa-bbbb-cccc-111122223333', createdAt: '05.11.2025', status: '1' }));
        return res.end(JSON.stringify({ success: true, timestamp: '', data: rows, paging: { page, size, total: all.length } }));
      }
      res.end(JSON.stringify({ success: true, timestamp: '', data: [], paging: { page: 0, size: 1, total: 0 } }));
    });
    await new Promise<void>((r) => fake.listen(0, '127.0.0.1', r));
    process.env.UTTF_BASE_URL = `http://127.0.0.1:${(fake.address() as { port: number }).port}`;
    // UTTF_BASE_URL modul yuklanganda o'qiladi — shuning uchun ilova env o'rnatilgandan KEYIN require qilinadi
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createTestApp, login, ACCOUNTS } = require('./e2e-utils') as typeof import('./e2e-utils');
    app = await createTestApp();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    prisma = app.get((require('../src/prisma/prisma.service') as typeof import('../src/prisma/prisma.service')).PrismaService);
    admin = await login(app, ACCOUNTS.root);
  });
  afterAll(async () => {
    await prisma.newsArticle.deleteMany({ where: { externalId: { in: ids } } });
    await app.close();
    fake.closeAllConnections();
    await new Promise((r) => fake.close(r));
    delete process.env.UTTF_BASE_URL;
  });

  const run = (dryRun: boolean) =>
    request(app.getHttpServer()).post('/api/uttf-sync/run').set('Cookie', admin).set('Origin', process.env.WEB_ORIGIN?.split(',')[0] ?? 'http://localhost:3100').send({ scope: 'news', dryRun });

  it('dryRun hech narsa yozmaydi', async () => {
    const r = await run(true).expect(201);
    expect((r.body as { created: number }).created).toBeGreaterThanOrEqual(3);
    expect(await prisma.newsArticle.count({ where: { externalId: { in: ids } } })).toBe(0);
  });

  it('3 ta yangilik yaratiladi: uz hammasida, ru 2 tada, en faqat tarjimasi bor 1 tada (uz bilan bir xili tarjima emas); muqova rasmi saqlanadi', async () => {
    await run(false).expect(201);
    const arts = await prisma.newsArticle.findMany({ where: { externalId: { in: ids } }, include: { translations: true }, orderBy: { externalId: 'asc' } });
    expect(arts).toHaveLength(3);
    expect(arts.map((a) => a.translations.map((t) => t.locale).sort())).toEqual([['en', 'ru', 'uz'], ['ru', 'uz'], ['uz']]);
    expect(arts.every((a) => a.status === 'PUBLISHED' && a.coverImageUrl?.startsWith('/uploads/images/'))).toBe(true);
    expect(arts[0].publishedAt?.toISOString().slice(0, 10)).toBe('2025-11-05');
  });

  it('qayta ishga tushirish dublikat yaratmaydi; o‘chirilgan tarjima qayta to‘ldiriladi, tahrirlangan matn o‘zgarmaydi', async () => {
    const a = await prisma.newsArticle.findUniqueOrThrow({ where: { externalId: ids[0] } });
    await prisma.newsTranslation.updateMany({ where: { articleId: a.id, locale: 'uz' }, data: { title: 'Qo‘lda tahrirlangan sarlavha' } });
    await prisma.newsTranslation.deleteMany({ where: { articleId: a.id, locale: 'en' } });
    await run(false).expect(201);
    expect(await prisma.newsArticle.count({ where: { externalId: { in: ids } } })).toBe(3);
    const tr = await prisma.newsTranslation.findMany({ where: { articleId: a.id } });
    expect(tr.map((t) => t.locale).sort()).toEqual(['en', 'ru', 'uz']);
    expect(tr.find((t) => t.locale === 'uz')!.title).toBe('Qo‘lda tahrirlangan sarlavha');
  });

  it('probe: ulanish va maydon nomlari qaytadi (shaxsiy ma‘lumotsiz)', async () => {
    const r = await request(app.getHttpServer()).get('/api/uttf-sync/probe').set('Cookie', admin).expect(200);
    const news = (r.body as Array<{ name: string; ok: boolean; keys?: string[] }>).find((x) => x.name === 'news')!;
    expect(news.ok).toBe(true);
    expect(news.keys).toContain('title');
  });

  it('huquqsiz foydalanuvchi sinxronizatsiyani ishga tushira olmaydi', async () => {
    await request(app.getHttpServer()).post('/api/uttf-sync/run').send({ scope: 'news' }).expect(401);
    await request(app.getHttpServer()).get('/api/uttf-sync/probe').expect(401);
  });
});
