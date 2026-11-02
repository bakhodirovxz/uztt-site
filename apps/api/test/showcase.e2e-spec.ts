import { INestApplication } from '@nestjs/common';
import { createServer, type Server } from 'http';
import type { AddressInfo } from 'net';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  ACCOUNTS,
  ORIGIN,
  createTestApp,
  findLeakedKey,
  login,
} from './e2e-utils';

/**
 * Efir qo'shimchalari (e2e): o'yinchi kartochkalari, reyting natijasi, overlay reklamasi,
 * Telegram (soxta Telegram serveriga — token va tarmoq kerak emas).
 */
interface TgCall {
  path: string;
  type: string;
  body: Buffer;
}

describe('Efir qo‘shimchalari (e2e)', () => {
  let app: INestApplication<App>;
  let mock: Server;
  const tgCalls: TgCall[] = [];
  let admin: string[];
  let referee: string[];
  let player: string[];
  let matchId: string;

  beforeAll(async () => {
    mock = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        tgCalls.push({
          path: req.url ?? '',
          type: String(req.headers['content-type'] ?? ''),
          body: Buffer.concat(chunks),
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
    });
    await new Promise<void>((r) => mock.listen(0, '127.0.0.1', r));
    process.env.TELEGRAM_BOT_TOKEN = '123456789:AAFakeTokenForTestsOnly_0123456789abcd';
    process.env.TELEGRAM_CHAT_ID = '-1001234567890';
    process.env.TELEGRAM_API_BASE = `http://127.0.0.1:${(mock.address() as AddressInfo).port}`;

    app = await createTestApp();
    admin = await login(app, ACCOUNTS.root);
    referee = await login(app, ACCOUNTS.referee);
    player = await login(app, ACCOUNTS.player);

    const prisma = app.get(PrismaService);
    const tournament = await prisma.tournament.findFirstOrThrow();
    const players = await prisma.player.findMany({ take: 2, orderBy: { createdAt: 'asc' } });
    const created = await request(app.getHttpServer())
      .post('/api/matches')
      .set('Cookie', admin)
      .set('Origin', ORIGIN)
      .send({
        tournamentId: tournament.id,
        stage: 'ROUND_1',
        tableNumber: 7,
        bestOf: 3,
        player1Id: players[0].id,
        player2Id: players[1].id,
      })
      .expect(201);
    matchId = (created.body as { id: string }).id;
    const code = (created.body as { refereeCode: string }).refereeCode;
    await request(app.getHttpServer())
      .post(`/api/matches/${matchId}/verify`)
      .set('Cookie', referee)
      .set('Origin', ORIGIN)
      .send({ code })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
    await new Promise((r) => mock.close(r));
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    delete process.env.TELEGRAM_API_BASE;
  });

  describe('o‘yin boshidagi kartochkalar', () => {
    it('autentifikatsiyasiz ochiq, ikki o‘yinchi, kerakli maydonlar bor', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/showcase/match/${matchId}/profiles`)
        .expect(200);
      const body = res.body as { players: Array<Record<string, unknown>>; tableNumber: number };
      expect(body.tableNumber).toBe(7);
      expect(body.players).toHaveLength(2);
      for (const p of body.players) {
        expect(typeof p.rating).toBe('number');
        expect(p.rank).toBeGreaterThanOrEqual(1);
        expect(p.played).toBeGreaterThanOrEqual(0);
        expect(p.won).toBeLessThanOrEqual(p.played as number);
        expect(p.age === null || typeof p.age === 'number').toBe(true);
      }
    });

    it('maxfiy ma’lumot (tug‘ilgan sana, tuman, telefon, PINFL, hujjat) chiqmaydi', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/showcase/match/${matchId}/profiles`)
        .expect(200);
      expect(
        findLeakedKey(res.body, [
          'birthDate', 'districtName', 'phone', 'pinfl', 'email', 'userId',
          'documentNumberEnc', 'filePathEnc', 'passwordHash', 'licenseNumber',
        ]),
      ).toBeNull();
    });

    it('noto‘g‘ri id — 400, mavjud bo‘lmagan — 404', async () => {
      await request(app.getHttpServer()).get('/api/showcase/match/abc/profiles').expect(400);
      await request(app.getHttpServer())
        .get('/api/showcase/match/00000000-0000-4000-8000-000000000000/profiles')
        .expect(404);
    });

    it('o‘yin tugamaguncha reyting natijasi yo‘q (404)', async () => {
      await request(app.getHttpServer())
        .get(`/api/showcase/match/${matchId}/rating`)
        .expect(404);
    });
  });

  describe('o‘yin tugashi, reyting va Telegram', () => {
    it('1-o‘yinchi 2 geymni 11:0 hisobida yutadi', async () => {
      for (let i = 0; i < 22; i++) {
        await request(app.getHttpServer())
          .post(`/api/matches/${matchId}/point`)
          .set('Cookie', referee)
          .set('Origin', ORIGIN)
          .send({ player: 1 })
          .expect(201);
      }
    });

    it('reyting natijasi: g‘olib ball oldi, oldin+delta=keyin', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/showcase/match/${matchId}/rating`)
        .expect(200);
      const r = res.body as {
        winnerSlot: number;
        games: number[][];
        players: Array<{ won: boolean; before: number; after: number; delta: number; rankBefore: number; rankAfter: number }>;
      };
      expect(r.winnerSlot).toBe(1);
      expect(r.games).toEqual([[11, 0], [11, 0]]);
      for (const p of r.players) expect(p.before + p.delta).toBe(p.after);
      const w = r.players.find((p) => p.won)!;
      const l = r.players.find((p) => !p.won)!;
      expect(w.delta).toBeGreaterThan(0);
      expect(l.delta).toBeLessThanOrEqual(0); // Nizom 3-formula: mag'lubdan ball ayiriladi (hech qachon ortmaydi)
      expect(l.after).toBeGreaterThanOrEqual(0); // reyting minusga tushmaydi
      expect(w.rankAfter).toBeLessThanOrEqual(w.rankBefore);
    });

    it('Telegramga matn va ikki rasm (1920x1080, 1080x1920) yuborildi', async () => {
      for (let i = 0; i < 40 && tgCalls.filter((c) => c.path.includes('sendPhoto')).length < 2; i++) {
        await new Promise((r) => setTimeout(r, 250));
      }
      const msgs = tgCalls.filter((c) => c.path.endsWith('/sendMessage'));
      const photos = tgCalls.filter((c) => c.path.endsWith('/sendPhoto'));
      expect(msgs).toHaveLength(1);
      expect(photos).toHaveLength(2);
      expect(msgs[0].body.toString()).toContain('-1001234567890');
      expect(msgs[0].body.toString()).toContain('Reyting');
      const sizes = photos.map((p) => {
        const i = p.body.indexOf(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
        return `${p.body.readUInt32BE(i + 16)}x${p.body.readUInt32BE(i + 20)}`;
      });
      expect(sizes.sort()).toEqual(['1080x1920', '1920x1080']);
      // token yo'lda bor, lekin matn/log javobiga chiqmaydi
      expect(msgs[0].path).toContain('/bot123456789:');
    });

    it('o‘yin yana yangilansa (izoh), Telegramga takror yuborilmaydi', async () => {
      const before = tgCalls.length;
      await request(app.getHttpServer())
        .post(`/api/matches/${matchId}/comment`)
        .set('Cookie', referee)
        .set('Origin', ORIGIN)
        .send({ text: 'Sinov izohi' });
      await new Promise((r) => setTimeout(r, 800));
      expect(tgCalls.length).toBe(before);
    });
  });

  describe('overlay reklamasi', () => {
    let adId: string;
    const IMG = '/uploads/images/11111111-2222-4333-8444-555555555555.webp';

    it('ommaviy ro‘yxat autentifikatsiyasiz ishlaydi', async () => {
      const res = await request(app.getHttpServer()).get('/api/showcase/ads').expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('kirmagan foydalanuvchi qo‘sha olmaydi (401)', async () => {
      await request(app.getHttpServer())
        .post('/api/showcase/ads')
        .set('Origin', ORIGIN)
        .send({ title: 'x', imageUrl: IMG })
        .expect(401);
    });

    it('o‘yinchi roli qo‘sha olmaydi (403)', async () => {
      await request(app.getHttpServer())
        .post('/api/showcase/ads')
        .set('Cookie', player)
        .set('Origin', ORIGIN)
        .send({ title: 'x', imageUrl: IMG })
        .expect(403);
    });

    it('tashqi URL / javascript: / noto‘g‘ri stollar rad etiladi (400)', async () => {
      for (const imageUrl of [
        'https://evil.example/x.webp',
        'javascript:alert(1)',
        '/uploads/images/../../etc/passwd',
        '//evil.example/x.webp',
      ]) {
        await request(app.getHttpServer())
          .post('/api/showcase/ads')
          .set('Cookie', admin)
          .set('Origin', ORIGIN)
          .send({ title: 'x', imageUrl })
          .expect(400);
      }
      await request(app.getHttpServer())
        .post('/api/showcase/ads')
        .set('Cookie', admin)
        .set('Origin', ORIGIN)
        .send({ title: 'x', imageUrl: IMG, tables: '1;2' })
        .expect(400);
      await request(app.getHttpServer())
        .post('/api/showcase/ads')
        .set('Cookie', admin)
        .set('Origin', ORIGIN)
        .send({ title: 'x', imageUrl: IMG, durationS: 9999 })
        .expect(400);
    });

    it('admin qo‘shadi, stol bo‘yicha filtr, o‘chirish ishlaydi', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/showcase/ads')
        .set('Cookie', admin)
        .set('Origin', ORIGIN)
        .send({ title: 'Homiy', imageUrl: IMG, durationS: 8, tables: '1,2' })
        .expect(201);
      adId = (created.body as { id: string }).id;

      const forTable1 = await request(app.getHttpServer()).get('/api/showcase/ads?table=1').expect(200);
      expect((forTable1.body as Array<{ id: string }>).some((a) => a.id === adId)).toBe(true);
      // keshni kutmaslik uchun xizmat o'zi tozalaydi; 5-stolda ko'rinmaydi
      const forTable5 = await request(app.getHttpServer()).get('/api/showcase/ads?table=5').expect(200);
      expect((forTable5.body as Array<{ id: string }>).some((a) => a.id === adId)).toBe(false);

      await request(app.getHttpServer())
        .patch(`/api/showcase/ads/${adId}`)
        .set('Cookie', admin)
        .set('Origin', ORIGIN)
        .send({ enabled: false })
        .expect(200);
      const hidden = await request(app.getHttpServer()).get('/api/showcase/ads?table=1').expect(200);
      expect((hidden.body as Array<{ id: string }>).some((a) => a.id === adId)).toBe(false);

      await request(app.getHttpServer())
        .delete(`/api/showcase/ads/${adId}`)
        .set('Cookie', admin)
        .set('Origin', ORIGIN)
        .expect(200);
      await request(app.getHttpServer())
        .delete(`/api/showcase/ads/${adId}`)
        .set('Cookie', admin)
        .set('Origin', ORIGIN)
        .expect(404);
    });
  });

  describe('Telegram test endpointi', () => {
    it('hakam (user.manage yo‘q) chaqira olmaydi', async () => {
      await request(app.getHttpServer())
        .post('/api/showcase/telegram/test')
        .set('Cookie', referee)
        .set('Origin', ORIGIN)
        .send({})
        .expect(403);
    });
    it('admin chaqirsa oxirgi tugagan o‘yin yuboriladi', async () => {
      const before = tgCalls.filter((c) => c.path.endsWith('/sendPhoto')).length;
      const res = await request(app.getHttpServer())
        .post('/api/showcase/telegram/test')
        .set('Cookie', admin)
        .set('Origin', ORIGIN)
        .send({})
        .expect(200);
      expect((res.body as { ok: boolean }).ok).toBe(true);
      expect(tgCalls.filter((c) => c.path.endsWith('/sendPhoto')).length).toBe(before + 2);
    });
  });
});
