import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { ACCOUNTS, ORIGIN, createTestApp, login } from './e2e-utils';

/** Nizom bo'yicha rasmiy reyting: g'olib/mag'lub ballari, undo, teng reyting, texnik g'alaba, bonus. */
describe('Rasmiy reyting — Nizom (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let admin: string[];
  let referee: string[];
  let tournamentId: string;
  let levelId: string;
  const made: string[] = [];

  const mkPlayer = async (rating: number, tag: string) => {
    const p = await prisma.player.create({
      data: {
        slug: `nizom-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        firstName: tag,
        lastName: 'Nizom',
        gender: 'MALE',
        region: 'Test',
        rankingPoints: rating,
      },
    });
    made.push(p.id);
    return p.id;
  };
  const pts = async (id: string) =>
    (await prisma.player.findUniqueOrThrow({ where: { id } })).rankingPoints;

  const newMatch = async (p1: string, p2: string, stage = 'ROUND_1') => {
    const created = await request(app.getHttpServer())
      .post('/api/matches')
      .set('Cookie', admin)
      .set('Origin', ORIGIN)
      .send({ tournamentId, stage, tableNumber: 3, bestOf: 3, player1Id: p1, player2Id: p2 })
      .expect(201);
    const body = created.body as { id: string; refereeCode: string };
    await request(app.getHttpServer())
      .post(`/api/matches/${body.id}/verify`)
      .set('Cookie', referee)
      .set('Origin', ORIGIN)
      .send({ code: body.refereeCode })
      .expect(201);
    return body.id;
  };
  const score = async (matchId: string, player: 1 | 2, n = 22) => {
    for (let i = 0; i < n; i++) {
      await request(app.getHttpServer())
        .post(`/api/matches/${matchId}/point`)
        .set('Cookie', referee)
        .set('Origin', ORIGIN)
        .send({ player })
        .expect(201);
    }
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    admin = await login(app, ACCOUNTS.root);
    referee = await login(app, ACCOUNTS.referee);
    const base = await prisma.tournament.findFirstOrThrow();
    // K = 1.0 (O'zbekiston chempionati), katta yoshlar, rasmiy rejim — alohida daraja va musobaqa
    // (bonus bir musobaqada faqat bir marta beriladi, shuning uchun har ishga tushirishda yangi musobaqa)
    const level = await prisma.tournamentLevel.create({
      data: {
        code: `T${Date.now()}`.slice(0, 20),
        name: 'Test daraja',
        coefficient: 1,
        ratingK: 1.0,
        ratingMode: 'OFFICIAL',
      },
    });
    const t = await prisma.tournament.create({
      data: {
        slug: `nizom-test-${Date.now()}`,
        name: 'Nizom test',
        levelId: level.id,
        startDate: base.startDate,
        endDate: base.endDate,
      },
    });
    tournamentId = t.id;
    levelId = level.id;
  });

  afterAll(async () => {
    await prisma.player.deleteMany({ where: { id: { in: made } } });
    await prisma.tournament.delete({ where: { id: tournamentId } });
    await prisma.tournamentLevel.delete({ where: { id: levelId } });
    await app.close();
  });

  it('kuchsiz g‘olib: (100−(600−640))/10 = +14, mag‘lub −7; undo hammasini qaytaradi', async () => {
    const weak = await mkPlayer(600, 'weak');
    const strong = await mkPlayer(640, 'strong');
    const m = await newMatch(weak, strong);
    await score(m, 1);
    expect(await pts(weak)).toBe(614);
    expect(await pts(strong)).toBe(633);
    const logs = await prisma.playerPointsLog.findMany({ where: { matchId: m } });
    expect(logs.every((l) => l.exact !== null)).toBe(true);

    await request(app.getHttpServer())
      .post(`/api/matches/${m}/undo`)
      .set('Cookie', referee)
      .set('Origin', ORIGIN)
      .expect(201);
    expect(await pts(weak)).toBe(600);
    expect(await pts(strong)).toBe(640);
  });

  it('teng reyting: g‘olibga +10, mag‘lubga −10 (20-band)', async () => {
    const a = await mkPlayer(500, 'eqa');
    const b = await mkPlayer(500, 'eqb');
    const m = await newMatch(a, b);
    await score(m, 2);
    expect(await pts(a)).toBe(490);
    expect(await pts(b)).toBe(510);
  });

  it('farq 100 dan katta: g‘olib ball olmaydi, mag‘lub ham yo‘qotmaydi', async () => {
    const hi = await mkPlayer(800, 'hi');
    const lo = await mkPlayer(600, 'lo');
    const m = await newMatch(hi, lo);
    await score(m, 1);
    expect(await pts(hi)).toBe(800);
    expect(await pts(lo)).toBe(600);
  });

  it('texnik g‘alaba (diskvalifikatsiya) uchun ball yo‘q (21-band)', async () => {
    const a = await mkPlayer(500, 'tda');
    const b = await mkPlayer(500, 'tdb');
    const m = await newMatch(a, b);
    await request(app.getHttpServer())
      .post(`/api/matches/${m}/disqualify`)
      .set('Cookie', referee)
      .set('Origin', ORIGIN)
      .field('player', '1')
      .field('reason', 'Test')
      .expect(201);
    expect(await pts(a)).toBe(500);
    expect(await pts(b)).toBe(500);
  });

  it('bonus o‘yin tugashi bilan beriladi: final g‘olibi +10+50, yutqazgan −10+45; qayta berilmaydi', async () => {
    const a = await mkPlayer(300, 'bfa');
    const b = await mkPlayer(300, 'bfb');
    const m = await newMatch(a, b, 'FINAL');
    await score(m, 1);
    // teng reyting: g'olibga +10, mag'lubga −10 (20-band) + 1/2-o'rin bonuslari (K=1.0: 50 / 45)
    expect(await pts(a)).toBe(300 + 10 + 50);
    expect(await pts(b)).toBe(300 - 10 + 45);
    const logs = await prisma.playerPointsLog.findMany({ where: { matchId: m, note: { startsWith: 'Nizom: bonus' } } });
    expect(logs.map((l) => l.delta).sort()).toEqual([45, 50]);

    // qo'lda endpoint: berilganlarni takrorlamaydi
    const preview = await request(app.getHttpServer()).post(`/api/rankings/tournaments/${tournamentId}/bonuses`).set('Cookie', admin).set('Origin', ORIGIN).expect(201);
    const rows = (preview.body as { rows: Array<{ playerId: string }> }).rows;
    expect(rows.find((r) => r.playerId === a || r.playerId === b)).toBeUndefined();
    await request(app.getHttpServer()).post(`/api/rankings/tournaments/${tournamentId}/bonuses?apply=1`).set('Cookie', admin).set('Origin', ORIGIN).expect(400);

    // undo bonusni ham qaytaradi
    await request(app.getHttpServer()).post(`/api/matches/${m}/undo`).set('Cookie', referee).set('Origin', ORIGIN).expect(201);
    expect(await pts(a)).toBe(300);
    expect(await pts(b)).toBe(300);
  });

  it('chorak final yutqazgani 5-o‘rin bonusini oladi (K=1.0 → 30)', async () => {
    const a = await mkPlayer(200, 'qfa');
    const b = await mkPlayer(200, 'qfb');
    const m = await newMatch(a, b, 'QUARTERFINAL');
    await score(m, 2); // b yutadi, a — 5-o'rin
    expect(await pts(a)).toBe(200 - 10 + 30);
    expect(await pts(b)).toBe(200 + 10);
  });

  it('Nizom 28: reytingdan chiqarilgan sportchi ball olmaydi/yo‘qotmaydi; qaytarish mumkin', async () => {
    const a = await mkPlayer(500, 'exa');
    const b = await mkPlayer(500, 'exb');
    await request(app.getHttpServer()).post(`/api/rankings/players/${a}/exclude`).set('Cookie', admin).set('Origin', ORIGIN).send({}).expect(400); // sabab majburiy
    await request(app.getHttpServer()).post(`/api/rankings/players/${a}/exclude`).set('Cookie', admin).set('Origin', ORIGIN).send({ reason: 'Test: 2 yil qatnashmagan' }).expect(201);
    const m = await newMatch(a, b);
    await score(m, 2); // b yutadi
    expect(await pts(a)).toBe(500); // chiqarilgan — o'zgarmaydi
    expect(await pts(b)).toBe(510);
    await request(app.getHttpServer()).post(`/api/rankings/players/${a}/restore`).set('Cookie', admin).set('Origin', ORIGIN).expect(201);
    expect((await prisma.player.findUniqueOrThrow({ where: { id: a } })).status).toBe('ACTIVE');
  });

  it('2 yildan ortiq qatnashmaganlar ro‘yxati (nomzodlar) ishlaydi va faqat ruxsatli', async () => {
    const res = await request(app.getHttpServer()).get('/api/rankings/inactive?years=2').set('Cookie', admin).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    await request(app.getHttpServer()).get('/api/rankings/inactive').expect(401);
  });

  it('LEGACY rejimda eski qat‘iy ballar ishlaydi (orqaga qaytish mumkin)', async () => {
    await prisma.tournamentLevel.update({ where: { id: levelId }, data: { ratingMode: 'LEGACY' } });
    try {
      const a = await mkPlayer(100, 'lga');
      const b = await mkPlayer(100, 'lgb');
      const m = await newMatch(a, b);
      await score(m, 1);
      expect(await pts(a)).toBeGreaterThan(100);
      expect(await pts(b)).toBeGreaterThanOrEqual(100); // ishtirok balli bo'lishi mumkin
    } finally {
      await prisma.tournamentLevel.update({ where: { id: levelId }, data: { ratingMode: 'OFFICIAL' } });
    }
  });
});
