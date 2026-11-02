import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { ACCOUNTS, ORIGIN, createTestApp, login } from './e2e-utils';

/** Taym-aut (3.4.4.2): har o'yinchiga o'yinda bir marta, 1 daqiqagacha. */
describe('Taym-aut (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let referee: string[];
  let matchId: string;
  const made: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const admin = await login(app, ACCOUNTS.root);
    referee = await login(app, ACCOUNTS.referee);
    const t = await prisma.tournament.findFirstOrThrow();
    for (const tag of ['a', 'b']) {
      const p = await prisma.player.create({
        data: { slug: `tm-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, firstName: tag, lastName: 'Taym', gender: 'MALE', region: 'Test', rankingPoints: 50 },
      });
      made.push(p.id);
    }
    const created = await request(app.getHttpServer()).post('/api/matches').set('Cookie', admin).set('Origin', ORIGIN)
      .send({ tournamentId: t.id, stage: 'ROUND_1', tableNumber: 5, bestOf: 3, player1Id: made[0], player2Id: made[1] }).expect(201);
    const body = created.body as { id: string; refereeCode: string };
    matchId = body.id;
    await request(app.getHttpServer()).post(`/api/matches/${matchId}/verify`).set('Cookie', referee).set('Origin', ORIGIN).send({ code: body.refereeCode }).expect(201);
  });

  afterAll(async () => {
    await prisma.player.deleteMany({ where: { id: { in: made } } });
    await app.close();
  });

  const timeout = (player: 1 | 2) =>
    request(app.getHttpServer()).post(`/api/matches/${matchId}/timeout`).set('Cookie', referee).set('Origin', ORIGIN).send({ player });

  it('1-o‘yinchi taym-aut oladi: faol (≈60 s), ikkinchi marta rad etiladi', async () => {
    const res = await timeout(1).expect(201);
    const to = (res.body as { timeout: { p1Used: boolean; p2Used: boolean; activePlayer: number | null; activeUntil: string | null } }).timeout;
    expect(to.p1Used).toBe(true);
    expect(to.p2Used).toBe(false);
    expect(to.activePlayer).toBe(1);
    const left = new Date(to.activeUntil!).getTime() - Date.now();
    expect(left).toBeGreaterThan(50_000);
    expect(left).toBeLessThanOrEqual(60_000);
    await timeout(1).expect(400);
  });

  it('2-o‘yinchi o‘zining taym-autini oladi (alohida hisob)', async () => {
    const res = await timeout(2).expect(201);
    expect((res.body as { timeout: { p1Used: boolean; p2Used: boolean } }).timeout).toMatchObject({ p1Used: true, p2Used: true });
    await timeout(2).expect(400);
  });

  it('autentifikatsiyasiz — 401', async () => {
    await request(app.getHttpServer()).post(`/api/matches/${matchId}/timeout`).set('Origin', ORIGIN).send({ player: 1 }).expect(401);
  });
});
