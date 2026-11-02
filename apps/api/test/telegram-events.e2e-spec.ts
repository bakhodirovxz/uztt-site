import { INestApplication } from '@nestjs/common';
import { createServer, Server } from 'http';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { ACCOUNTS, ORIGIN, createTestApp, login } from './e2e-utils';

/** Telegramga avtomatik e'lonlar: soxta Bot API serveri so'rovlarni yig'adi */
describe('Telegram avtomatik e‘lonlar (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let fake: Server;
  let admin: string[];
  const calls: Array<{ method: string; chat: string; text: string; token: string }> = [];
  const stamp = Date.now();
  const TOKEN = '123456789:AAFakeTokenForTestsOnly_0123456789abcd';
  const created = { news: [] as string[], tournaments: [] as string[], users: [] as string[] };
  const post = (u: string, c?: string[]) => { const r = request(app.getHttpServer()).post(u).set('Origin', ORIGIN); return c ? r.set('Cookie', c) : r; };
  const waitFor = async (fn: () => boolean, ms = 8000) => { const t = Date.now(); while (!fn() && Date.now() - t < ms) await new Promise((r) => setTimeout(r, 50)); };

  beforeAll(async () => {
    fake = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        const body = Buffer.concat(chunks).toString('latin1');
        const method = (req.url ?? '').split('/').pop() ?? '';
        const json = body.startsWith('{') ? (JSON.parse(body) as { chat_id: string; text: string }) : null;
        const chat = json?.chat_id ?? /name="chat_id"\r\n\r\n([^\r]+)/.exec(body)?.[1] ?? '';
        const text = json?.text ?? /name="caption"\r\n\r\n([\s\S]*?)\r\n--/.exec(body)?.[1] ?? '';
        calls.push({ method, chat, text, token: (req.url ?? '').split('/')[1] });
        res.setHeader('Content-Type', 'application/json');
        res.end('{"ok":true}');
      });
    });
    await new Promise<void>((r) => fake.listen(0, '127.0.0.1', r));
    const port = (fake.address() as { port: number }).port;
    Object.assign(process.env, {
      TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_CHAT_ID: '-1001', TELEGRAM_ADMIN_CHAT_ID: '-2002',
      TELEGRAM_API_BASE: `http://127.0.0.1:${port}`, PUBLIC_SITE_URL: 'https://stoltennis.uz',
    });
    app = await createTestApp();
    prisma = app.get(PrismaService);
    admin = await login(app, ACCOUNTS.root);
  });
  afterAll(async () => {
    await prisma.newsArticle.deleteMany({ where: { id: { in: created.news } } });
    await prisma.tournament.deleteMany({ where: { id: { in: created.tournaments } } });
    await prisma.user.deleteMany({ where: { email: { contains: `-${stamp}@test.uz` } } });
    await app.close();
    fake.closeAllConnections();
    await new Promise((r) => fake.close(r));
    for (const k of ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'TELEGRAM_ADMIN_CHAT_ID', 'TELEGRAM_API_BASE', 'PUBLIC_SITE_URL']) delete process.env[k];
  });

  it('yangilik nashr qilinganda ommaviy kanalga sarlavha + havola boradi; qoralama — yo‘q', async () => {
    const draft = await post('/api/news', admin).send({ status: 'DRAFT', translations: [{ locale: 'uz', title: `Qoralama ${stamp}`, body: 'Matn matn matn matn' }] }).expect(201);
    created.news.push((draft.body as { id: string }).id);
    const res = await post('/api/news', admin).send({ status: 'PUBLISHED', translations: [{ locale: 'uz', title: `Chempionat ${stamp}`, excerpt: 'Qisqa mazmun', body: 'To‘liq matn bor' }] }).expect(201);
    created.news.push((res.body as { id: string }).id);
    await waitFor(() => calls.some((c) => c.text.includes(`Chempionat ${stamp}`)));
    const c = calls.find((x) => x.text.includes(`Chempionat ${stamp}`))!;
    expect(c.chat).toBe('-1001');
    expect(c.text).toContain('https://stoltennis.uz/yangiliklar/');
    expect(calls.some((x) => x.text.includes(`Qoralama ${stamp}`))).toBe(false);
  });

  it('qoralama nashr qilinganda bir marta e‘lon qilinadi, keyingi tahrirda takrorlanmaydi', async () => {
    const id = created.news[0];
    await request(app.getHttpServer()).put(`/api/news/${id}`).set('Cookie', admin).set('Origin', ORIGIN).send({ status: 'PUBLISHED' }).expect(200);
    await waitFor(() => calls.some((c) => c.text.includes(`Qoralama ${stamp}`)));
    const n1 = calls.filter((c) => c.text.includes(`Qoralama ${stamp}`)).length;
    expect(n1).toBe(1);
    await request(app.getHttpServer()).put(`/api/news/${id}`).set('Cookie', admin).set('Origin', ORIGIN).send({ isFeatured: true }).expect(200);
    await new Promise((r) => setTimeout(r, 400));
    expect(calls.filter((c) => c.text.includes(`Qoralama ${stamp}`)).length).toBe(1);
  });

  it('yangi musobaqa e‘loni', async () => {
    const level = await prisma.tournamentLevel.findFirstOrThrow();
    const res = await post('/api/tournaments', admin).send({ name: `Kubok ${stamp}`, levelCode: level.code, startDate: '2027-03-01', endDate: '2027-03-03', city: 'Toshkent' }).expect(201);
    created.tournaments.push((res.body as { id: string }).id);
    await waitFor(() => calls.some((c) => c.text.includes(`Kubok ${stamp}`)));
    expect(calls.find((c) => c.text.includes(`Kubok ${stamp}`))!.text).toContain('/musobaqalar/');
  });

  it('ariza → faqat ADMIN chatga, shaxsiy ma‘lumotsiz (email/telefon yo‘q)', async () => {
    await post('/api/applications/referee').send({ email: `hk-${stamp}@test.uz`, password: 'Kuchli-Parol-12345', firstName: 'Aziz', lastName: `Sinov${stamp}`, phone: '+998901112233', region: 'Toshkent shahri' }).expect(201);
    await waitFor(() => calls.some((c) => c.text.includes(`Sinov${stamp}`)));
    const c = calls.find((x) => x.text.includes(`Sinov${stamp}`))!;
    expect(c.chat).toBe('-2002');
    expect(c.text).not.toMatch(/@test\.uz|\+998|Kuchli-Parol/);
    // ommaviy kanalga chiqmagan
    expect(calls.some((x) => x.chat === '-1001' && x.text.includes(`Sinov${stamp}`))).toBe(false);
  });

  it('token xabar matnlarida va yo‘lda faqat Bot API yo‘lida bor; matnda yo‘q', () => {
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      expect(c.text).not.toContain(TOKEN);
      expect(c.token).toBe(`bot${TOKEN}`);
    }
  });
});
