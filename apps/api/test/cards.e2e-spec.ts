import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { ACCOUNTS, ORIGIN, createTestApp, login } from './e2e-utils';

/** Qoidalar 3.5.2: sariq → 2-qoidabuzarlikda raqibga 1 ochko, 3-sida 2 ochko, 4-sida bosh hakamga xabar. */
describe('Kartochka jarimalari (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let referee: string[];
  let matchId: string;
  const made: string[] = [];

  const card = (player: 1 | 2, type: 'YELLOW' | 'RED' = 'YELLOW') =>
    request(app.getHttpServer())
      .post(`/api/matches/${matchId}/card`)
      .set('Cookie', referee)
      .set('Origin', ORIGIN)
      .send({ player, cardType: type });
  const state = async () =>
    prisma.match.findUniqueOrThrow({ where: { id: matchId } });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const admin = await login(app, ACCOUNTS.root);
    referee = await login(app, ACCOUNTS.referee);
    const t = await prisma.tournament.findFirstOrThrow();
    const mk = async (tag: string) => {
      const p = await prisma.player.create({
        data: {
          slug: `kart-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
          firstName: tag,
          lastName: 'Karta',
          gender: 'MALE',
          region: 'Test',
          rankingPoints: 100,
        },
      });
      made.push(p.id);
      return p.id;
    };
    const created = await request(app.getHttpServer())
      .post('/api/matches')
      .set('Cookie', admin)
      .set('Origin', ORIGIN)
      .send({
        tournamentId: t.id,
        stage: 'ROUND_1',
        tableNumber: 4,
        bestOf: 3,
        player1Id: await mk('a'),
        player2Id: await mk('b'),
      })
      .expect(201);
    const body = created.body as { id: string; refereeCode: string };
    matchId = body.id;
    await request(app.getHttpServer())
      .post(`/api/matches/${matchId}/verify`)
      .set('Cookie', referee)
      .set('Origin', ORIGIN)
      .send({ code: body.refereeCode })
      .expect(201);
  });

  afterAll(async () => {
    await prisma.player.deleteMany({ where: { id: { in: made } } });
    await app.close();
  });

  it('1-qoidabuzarlik: faqat ogohlantirish (ochko yo‘q)', async () => {
    await card(1).expect(201);
    const m = await state();
    expect(m.currentSetP1 + m.currentSetP2).toBe(0);
  });

  it('2-qoidabuzarlik: raqibga 1 ochko', async () => {
    await card(1).expect(201);
    const m = await state();
    expect(m.currentSetP2).toBe(1);
    expect(m.currentSetP1).toBe(0);
  });

  it('3-qoidabuzarlik: raqibga yana 2 ochko (jami 3)', async () => {
    await card(1).expect(201);
    expect((await state()).currentSetP2).toBe(3);
  });

  it('4-qoidabuzarlik: o‘yin to‘xtatilib bosh hakamga xabar beriladi (400)', async () => {
    const res = await card(1).expect(400);
    expect(JSON.stringify(res.body)).toContain('bosh hakam');
    expect((await state()).currentSetP2).toBe(3);
  });

  it('boshqa o‘yinchining hisobi alohida; qo‘lda RED — ochko bermaydi', async () => {
    await card(2).expect(201); // 2-o'yinchining 1-ogohlantirishi
    expect((await state()).currentSetP1).toBe(0);
    await card(2, 'RED').expect(201); // bosh hakam qarori: faqat qayd
    const m = await state();
    expect(m.currentSetP1).toBe(0);
    expect(m.currentSetP2).toBe(3);
    const cards = await prisma.matchCard.findMany({ where: { matchId }, orderBy: { issuedAt: 'asc' } });
    expect(cards.map((c) => c.type)).toEqual(['YELLOW', 'RED', 'RED', 'YELLOW', 'RED']);
  });

  it('jarima ochkosi o‘yinni tugatsa (set 10:10 → 11) — g‘olib aniqlanadi', async () => {
    // yangi o'yin: 10-0 hisobdan jarima 1 ochko → set tugaydi
    const t = await prisma.tournament.findFirstOrThrow();
    const admin = await login(app, ACCOUNTS.root);
    const [a, b] = made.slice(0, 2);
    const created = await request(app.getHttpServer())
      .post('/api/matches')
      .set('Cookie', admin)
      .set('Origin', ORIGIN)
      .send({ tournamentId: t.id, stage: 'ROUND_1', tableNumber: 4, bestOf: 3, player1Id: a, player2Id: b })
      .expect(201);
    const body = created.body as { id: string; refereeCode: string };
    const id = body.id;
    await request(app.getHttpServer()).post(`/api/matches/${id}/verify`).set('Cookie', referee).set('Origin', ORIGIN).send({ code: body.refereeCode }).expect(201);
    for (let i = 0; i < 10; i++) {
      await request(app.getHttpServer()).post(`/api/matches/${id}/point`).set('Cookie', referee).set('Origin', ORIGIN).send({ player: 2 }).expect(201);
    }
    await request(app.getHttpServer()).post(`/api/matches/${id}/card`).set('Cookie', referee).set('Origin', ORIGIN).send({ player: 1, cardType: 'YELLOW' }).expect(201); // ogohlantirish
    await request(app.getHttpServer()).post(`/api/matches/${id}/card`).set('Cookie', referee).set('Origin', ORIGIN).send({ player: 1, cardType: 'YELLOW' }).expect(201); // 2-: raqibga 1 ochko → 11:0
    const m = await prisma.match.findUniqueOrThrow({ where: { id } });
    expect(m.player2SetsWon).toBe(1);
    expect(m.currentSetP2).toBe(0);
  });
});
