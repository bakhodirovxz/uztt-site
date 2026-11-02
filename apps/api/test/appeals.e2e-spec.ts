import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { ACCOUNTS, ORIGIN, createTestApp, login } from './e2e-utils';

/** Apellyatsiya/protest: Nizom 44–47, qoidalar 3.3.2–3.3.5. */
describe('Apellyatsiya va protest (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let admin: string[];
  let player: string[];
  let ownMatch: string;
  let otherMatch: string;
  const extra: string[] = [];

  const post = (url: string, cookie: string[]) => request(app.getHttpServer()).post(url).set('Cookie', cookie).set('Origin', ORIGIN);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    admin = await login(app, ACCOUNTS.root);
    player = await login(app, ACCOUNTS.player);
    const me = await prisma.player.findFirstOrThrow({ where: { slug: 'test-oyinchi' } });
    const t = await prisma.tournament.findFirstOrThrow();
    const mk = async (tag: string) => {
      const p = await prisma.player.create({
        data: { slug: `ap-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, firstName: tag, lastName: 'Apel', gender: 'MALE', region: 'Test' },
      });
      extra.push(p.id);
      return p.id;
    };
    const mkMatch = async (a: string, b: string) =>
      ((await post('/api/matches', admin).send({ tournamentId: t.id, stage: 'ROUND_1', tableNumber: 6, bestOf: 3, player1Id: a, player2Id: b }).expect(201)).body as { id: string }).id;
    ownMatch = await mkMatch(me.id, await mk('x'));
    otherMatch = await mkMatch(await mk('y'), await mk('z'));
  });

  afterAll(async () => {
    await prisma.appeal.deleteMany({ where: { text: { startsWith: 'TEST:' } } });
    await prisma.player.deleteMany({ where: { id: { in: extra } } });
    await app.close();
  });

  it('autentifikatsiyasiz — 401; o‘yinchi bo‘lmagan akkaunt — 403', async () => {
    await request(app.getHttpServer()).post('/api/appeals').set('Origin', ORIGIN).send({ kind: 'RATING', text: 'TEST: yetarlicha uzun matn' }).expect(401);
    await post('/api/appeals', admin).send({ kind: 'RATING', text: 'TEST: yetarlicha uzun matn' }).expect(403);
  });

  it('reyting apellyatsiyasi: 201; takrori (ko‘rib chiqilmagan) — 409', async () => {
    const res = await post('/api/appeals', player).send({ kind: 'RATING', text: 'TEST: bal noto‘g‘ri hisoblangan' }).expect(201);
    expect((res.body as { status: string }).status).toBe('NEW');
    await post('/api/appeals', player).send({ kind: 'RATING', text: 'TEST: bal noto‘g‘ri hisoblangan' }).expect(409);
  });

  it('protest: o‘yinsiz — 400; begona o‘yinga — 403 (3.3.5); o‘z o‘yiniga — 201', async () => {
    await post('/api/appeals', player).send({ kind: 'INTERPRETATION', text: 'TEST: qoida talqini bo‘yicha' }).expect(400);
    await post('/api/appeals', player).send({ kind: 'INTERPRETATION', matchId: otherMatch, text: 'TEST: qoida talqini bo‘yicha' }).expect(403);
    await post('/api/appeals', player).send({ kind: 'INTERPRETATION', matchId: ownMatch, text: 'TEST: qoida talqini bo‘yicha' }).expect(201);
  });

  it('o‘yinchi faqat o‘z murojaatlarini ko‘radi; ro‘yxat va qaror — faqat ruxsatli', async () => {
    const mine = (await request(app.getHttpServer()).get('/api/appeals/mine').set('Cookie', player).expect(200)).body as Array<{ id: string }>;
    expect(mine.length).toBeGreaterThanOrEqual(2);
    await request(app.getHttpServer()).get('/api/appeals').set('Cookie', player).expect(403);
    const list = (await request(app.getHttpServer()).get('/api/appeals?status=NEW').set('Cookie', admin).expect(200)).body as Array<{ id: string }>;
    expect(list.length).toBeGreaterThanOrEqual(2);

    const id = mine[0].id;
    await post(`/api/appeals/${id}/decision`, player).send({ status: 'REJECTED', decision: 'TEST rad' }).expect(403);
    const d = await post(`/api/appeals/${id}/decision`, admin).send({ status: 'REJECTED', decision: 'TEST: asos topilmadi' }).expect(201);
    expect((d.body as { status: string; decidedAt: string }).status).toBe('REJECTED');
    await post(`/api/appeals/${id}/decision`, admin).send({ status: 'ACCEPTED', decision: 'TEST: qayta' }).expect(409); // yakuniy
  });
});
