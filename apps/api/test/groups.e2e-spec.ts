import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { ACCOUNTS, ORIGIN, createTestApp, login } from './e2e-utils';

interface ViewGroup {
  number: number;
  standings: Array<{ playerId: string; place: number; points: number }>;
  matches: Array<{ id: string; status: string; player1Id: string; player2Id: string }>;
}
interface View {
  status: string;
  allMatchesFinished: boolean;
  groups: ViewGroup[];
}

/** Guruh bosqichi: zmeyka, doira, jadval (2/1/0), setkaga o'tkazish (4.2, 4.7.2–4.7.3). */
describe('Guruh bosqichi (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let admin: string[];
  let referee: string[];
  let tournamentId: string;
  let categoryId: string;
  const players: string[] = [];

  const api = () => request(app.getHttpServer());
  const post = (url: string, cookie: string[]) => api().post(url).set('Cookie', cookie).set('Origin', ORIGIN);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    admin = await login(app, ACCOUNTS.root);
    referee = await login(app, ACCOUNTS.referee);
    const base = await prisma.tournament.findFirstOrThrow({ include: { level: true } });
    const age = await prisma.ageCategory.findFirstOrThrow({ where: { maxAge: null } });
    const t = await prisma.tournament.create({
      data: {
        slug: `guruh-test-${Date.now()}`, name: 'Guruh test', levelId: base.levelId,
        startDate: base.startDate, endDate: base.endDate,
      },
    });
    tournamentId = t.id;
    const cat = await prisma.tournamentCategory.create({
      data: { tournamentId, ageCategoryId: age.id, gender: 'MALE', eventType: 'SINGLES' },
    });
    categoryId = cat.id;
    for (let i = 0; i < 8; i++) {
      const p = await prisma.player.create({
        data: {
          slug: `guruh-${i}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
          firstName: `G${i}`, lastName: 'Guruh', gender: 'MALE',
          region: i % 2 === 0 ? 'Toshkent' : 'Samarqand', rankingPoints: 800 - i * 10,
        },
      });
      players.push(p.id);
      await prisma.tournamentRegistration.create({
        data: { playerId: p.id, tournamentCategoryId: categoryId, status: 'CONFIRMED' },
      });
    }
  });

  afterAll(async () => {
    await prisma.tournament.delete({ where: { id: tournamentId } });
    await prisma.player.deleteMany({ where: { id: { in: players } } });
    await app.close();
  });

  const play = async (matchId: string, winnerSlot: 1 | 2) => {
    const code = (await post(`/api/matches/${matchId}/regenerate-code`, admin).expect(201)).body as { refereeCode: string };
    await post(`/api/matches/${matchId}/verify`, referee).send({ code: code.refereeCode }).expect(201);
    for (let i = 0; i < 22; i++) {
      await post(`/api/matches/${matchId}/point`, referee).send({ player: winnerSlot }).expect(201);
    }
  };

  it('talablar tekshiriladi: kam o‘yinchi / noto‘g‘ri chiquvchilar soni', async () => {
    await post(`/api/groups/category/${categoryId}`, admin).send({ groupCount: 5, advancing: 1 }).expect(400); // 10 ta kerak
    await post(`/api/groups/category/${categoryId}`, admin).send({ groupCount: 2, advancing: 4 }).expect(400); // guruh 4 ta: 1..3
  });

  it('zmeyka: 8 o‘yinchi → 2 guruh × 4; doira: har guruhda 6 ta uchrashuv', async () => {
    const res = await post(`/api/groups/category/${categoryId}`, admin).send({ groupCount: 2, advancing: 2, bestOf: 3 }).expect(201);
    const v = res.body as View;
    expect(v.groups).toHaveLength(2);
    for (const g of v.groups) {
      expect(g.standings).toHaveLength(4);
      expect(g.matches).toHaveLength(6);
    }
    // zmeyka: 1-qator 1-o'yinchi → 1-guruh, 2-o'yinchi → 2-guruh; 2-qator teskari: 4-o'yinchi → 1-guruh? (3→2-guruh)
    const g1 = v.groups[0].standings.map((s) => s.playerId);
    const g2 = v.groups[1].standings.map((s) => s.playerId);
    expect(g1).toEqual(expect.arrayContaining([players[0], players[3], players[4], players[7]]));
    expect(g2).toEqual(expect.arrayContaining([players[1], players[2], players[5], players[6]]));
    // takroriy yaratish rad etiladi
    await post(`/api/groups/category/${categoryId}`, admin).send({ groupCount: 2, advancing: 2 }).expect(409);
  });

  it('jadval ommaviy; o‘ynalmagan o‘yinlarda hamma 0 ochko', async () => {
    const v = (await api().get(`/api/groups/category/${categoryId}`).expect(200)).body as View;
    expect(v.allMatchesFinished).toBe(false);
    for (const g of v.groups) for (const s of g.standings) expect(s.points).toBe(0);
  });

  it('o‘yinlar tugamaguncha setkaga o‘tkazib bo‘lmaydi', async () => {
    await post(`/api/groups/category/${categoryId}/advance`, admin).expect(400);
  });

  it('barcha o‘yinlarda 1-o‘yinchi (yuqori reyting) yutadi: jadval 2/1 ochko va tartib', async () => {
    const v0 = (await api().get(`/api/groups/category/${categoryId}`).expect(200)).body as View;
    for (const g of v0.groups) {
      for (const m of g.matches) {
        // kuchliroq (reytingi yuqori = indeksi kichik) yutadi
        const i1 = players.indexOf(m.player1Id);
        const i2 = players.indexOf(m.player2Id);
        await play(m.id, i1 < i2 ? 1 : 2);
      }
    }
    const v = (await api().get(`/api/groups/category/${categoryId}`).expect(200)).body as View;
    expect(v.allMatchesFinished).toBe(true);
    for (const g of v.groups) {
      // 4 kishi: g'alabalar 3,2,1,0 → ochkolar 2*3+0=6, 2*2+1=5, 2*1+2=4, 0+3=3
      expect(g.standings.map((s) => s.points)).toEqual([6, 5, 4, 3]);
      const ids = g.standings.map((s) => s.playerId);
      expect(ids).toEqual([...ids].sort((a, b) => players.indexOf(a) - players.indexOf(b)));
    }
  });

  it('setkaga o‘tkazish: 1-guruh g‘olibi tepada, 2-guruh g‘olibi pastda; 2-o‘rindagilar qarama-qarshi yarimda', async () => {
    const res = await post(`/api/groups/category/${categoryId}/advance`, admin).expect(201);
    const bracket = res.body as { size: number; rounds?: unknown };
    expect(bracket.size).toBe(4);
    const draw = await prisma.draw.findFirstOrThrow({
      where: { tournamentCategoryId: categoryId },
      include: { entries: { orderBy: { position: 'asc' } } },
    });
    const pos = (id: string) => draw.entries.findIndex((e) => e.playerId === id);
    // guruh g'oliblari: har guruhdagi eng kuchli (players[0] 1-guruhda, players[1] 2-guruhda)
    // 3-o'rin uchun o'yin (yarim final yutqazganlari) yaratilgan
    const third = await prisma.match.findFirst({ where: { drawId: draw.id, stage: 'THIRD_PLACE' } });
    expect(third).not.toBeNull();
    const semis = await prisma.match.findMany({ where: { drawId: draw.id, stage: 'SEMIFINAL' } });
    expect(semis.every((m) => m.loserNextMatchId === third!.id)).toBe(true);
    expect(pos(players[0])).toBe(0);
    expect(pos(players[1])).toBe(3);
    const v = (await api().get(`/api/groups/category/${categoryId}`).expect(200)).body as View;
    expect(v.status).toBe('ADVANCED');
    const second1 = v.groups[0].standings[1].playerId;
    const second2 = v.groups[1].standings[1].playerId;
    expect(Math.floor(pos(second1) / 2)).toBe(1); // 1-guruh 2-o'rini pastki yarimda
    expect(Math.floor(pos(second2) / 2)).toBe(0); // 2-guruh 2-o'rini yuqori yarimda
    await post(`/api/groups/category/${categoryId}/advance`, admin).expect(409);
  });
});
