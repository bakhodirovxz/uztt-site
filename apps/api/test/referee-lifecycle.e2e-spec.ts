import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ACCOUNTS, ORIGIN, createTestApp, login } from './e2e-utils';

/**
 * Hakam ish oqimining to'liq aylanasi:
 * o'yin yaratish → 5 noto'g'ri kod → blok → kod regeneratsiya → tasdiqlash →
 * ochkolar → undo → kartochka → diskvalifikatsiya.
 *
 * Seed'dagi demo turnir va o'yinchilardan foydalanadi; test o'zi yaratgan
 * o'yinni oxirida o'chiradi emas — audit izlari saqlanishi mantiqan to'g'ri
 * (yakunlangan o'yin jonli ro'yxatga tushmaydi).
 */
describe('Hakam ish oqimi (e2e)', () => {
  let app: INestApplication<App>;
  let admin: string[];
  let referee: string[];
  let matchId: string;
  let code: string;

  beforeAll(async () => {
    app = await createTestApp();
    admin = await login(app, ACCOUNTS.root);
    referee = await login(app, ACCOUNTS.referee);

    const tournaments = await request(app.getHttpServer())
      .get('/api/tournaments')
      .expect(200);
    const tournamentId = (tournaments.body as Array<{ id: string }>)[0]?.id;
    const players = await request(app.getHttpServer())
      .get('/api/players')
      .expect(200);
    const [p1, p2] = players.body as Array<{ id: string }>;

    const created = await request(app.getHttpServer())
      .post('/api/matches')
      .set('Cookie', admin)
      .set('Origin', ORIGIN)
      .send({
        tournamentId,
        stage: 'ROUND_1',
        tableNumber: 12,
        bestOf: 3,
        player1Id: p1.id,
        player2Id: p2.id,
      })
      .expect(201);

    matchId = (created.body as { id: string }).id;
    code = (created.body as { refereeCode: string }).refereeCode;
    expect(code).toMatch(/^\d{6}$/);
  });

  afterAll(async () => {
    await app.close();
  });

  it('ochiq javobda hakam kodi va overlay tokeni yo‘q', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/matches/${matchId}`)
      .expect(200);
    expect(res.body).not.toHaveProperty('refereeCode');
    expect(res.body).not.toHaveProperty('refereeCodeHash');
    expect(res.body).not.toHaveProperty('overlayToken');
  });

  it('5 ta noto‘g‘ri kod kiritilsa o‘yin bloklanadi', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post(`/api/matches/${matchId}/verify`)
        .set('Cookie', referee)
        .set('Origin', ORIGIN)
        .send({ code: '000000' })
        .expect(401);
    }

    // 6-urinishda kod to'g'ri bo'lsa ham kirib bo'lmaydi
    await request(app.getHttpServer())
      .post(`/api/matches/${matchId}/verify`)
      .set('Cookie', referee)
      .set('Origin', ORIGIN)
      .send({ code })
      .expect(403);
  });

  it('admin kodni qayta generatsiya qiladi va hakam kiradi', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/matches/${matchId}/regenerate-code`)
      .set('Cookie', admin)
      .set('Origin', ORIGIN)
      .expect(201);

    code = (res.body as { refereeCode: string }).refereeCode;
    expect(code).toMatch(/^\d{6}$/);

    await request(app.getHttpServer())
      .post(`/api/matches/${matchId}/verify`)
      .set('Cookie', referee)
      .set('Origin', ORIGIN)
      .send({ code })
      .expect(201);
  });

  it('ochko qo‘shiladi va undo uni qaytaradi', async () => {
    const after = await request(app.getHttpServer())
      .post(`/api/matches/${matchId}/point`)
      .set('Cookie', referee)
      .set('Origin', ORIGIN)
      .send({ player: 1 })
      .expect(201);
    expect((after.body as { currentSetP1: number }).currentSetP1).toBe(1);

    const undone = await request(app.getHttpServer())
      .post(`/api/matches/${matchId}/undo`)
      .set('Cookie', referee)
      .set('Origin', ORIGIN)
      .expect(201);
    expect((undone.body as { currentSetP1: number }).currentSetP1).toBe(0);
  });

  it('seq monotonik o‘sadi (socket tartibi buzilmaydi)', async () => {
    const first = await request(app.getHttpServer())
      .post(`/api/matches/${matchId}/point`)
      .set('Cookie', referee)
      .set('Origin', ORIGIN)
      .send({ player: 2 })
      .expect(201);
    const second = await request(app.getHttpServer())
      .post(`/api/matches/${matchId}/point`)
      .set('Cookie', referee)
      .set('Origin', ORIGIN)
      .send({ player: 2 })
      .expect(201);

    expect((second.body as { seq: number }).seq).toBeGreaterThan(
      (first.body as { seq: number }).seq,
    );
  });

  it('sariq kartochka yoziladi', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/matches/${matchId}/card`)
      .set('Cookie', referee)
      .set('Origin', ORIGIN)
      .send({ player: 1, cardType: 'YELLOW' })
      .expect(201);
    expect((res.body as { cards: unknown[] }).cards.length).toBeGreaterThan(0);
  });

  it('o‘yinchi (PLAYER roli) hisob kirita olmaydi', async () => {
    const player = await login(app, ACCOUNTS.player);
    await request(app.getHttpServer())
      .post(`/api/matches/${matchId}/point`)
      .set('Cookie', player)
      .set('Origin', ORIGIN)
      .send({ player: 1 })
      .expect(403);
  });

  it('diskvalifikatsiya o‘yinni yakunlaydi (multipart, audiosiz)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/matches/${matchId}/disqualify`)
      .set('Cookie', referee)
      .set('Origin', ORIGIN)
      .field('player', '1')
      .field('reason', 'Test: sport axloqi qoidalari buzildi')
      .expect(201);

    expect((res.body as { status: string }).status).toBe('FINISHED');
    expect((res.body as { winnerInfo: unknown }).winnerInfo).toBeTruthy();
  });
});
