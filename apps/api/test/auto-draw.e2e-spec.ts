import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { ACCOUNTS, ORIGIN, createTestApp, login } from './e2e-utils';

describe('Qurani avtomatik o‘tkazish (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let admin: string[];
  let tournamentId: string;
  const players: string[] = [];
  const api = () => request(app.getHttpServer());
  const post = (url: string, cookie: string[]) => api().post(url).set('Cookie', cookie).set('Origin', ORIGIN);

  async function category(n: number, gender: 'MALE' | 'FEMALE', eventType: 'SINGLES' | 'TEAM' = 'SINGLES') {
    const age = await prisma.ageCategory.findFirstOrThrow({ where: { maxAge: null } });
    const cat = await prisma.tournamentCategory.create({
      data: { tournamentId, ageCategoryId: age.id, gender, eventType },
    });
    for (let i = 0; i < n; i++) {
      const p = await prisma.player.create({
        data: {
          slug: `auto-${gender}-${n}-${i}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
          firstName: `A${i}`, lastName: 'Auto', gender, region: i % 2 ? 'Toshkent' : 'Samarqand', rankingPoints: 900 - i * 7,
        },
      });
      players.push(p.id);
      await prisma.tournamentRegistration.create({ data: { playerId: p.id, tournamentCategoryId: cat.id, status: 'CONFIRMED' } });
    }
    return cat.id;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    admin = await login(app, ACCOUNTS.root);
    const base = await prisma.tournament.findFirstOrThrow();
    const t = await prisma.tournament.create({
      data: { slug: `auto-${Date.now()}`, name: 'Auto qura', levelId: base.levelId, startDate: base.startDate, endDate: base.endDate },
    });
    tournamentId = t.id;
  });
  afterAll(async () => {
    await prisma.tournament.delete({ where: { id: tournamentId } });
    await prisma.player.deleteMany({ where: { id: { in: players } } });
    await app.close();
  });

  it('12 o‘yinchi → 4 guruh (har guruhda 3), har guruhdan 2 ta chiqadi', async () => {
    const id = await category(12, 'MALE');
    const r = (await post(`/api/groups/category/${id}/auto`, admin).expect(201)).body as { format: string; groupCount: number; advancing: number };
    expect(r).toMatchObject({ format: 'GROUPS', groupCount: 4, advancing: 2 });
    const v = (await api().get(`/api/groups/category/${id}`).expect(200)).body as { groups: { matches: unknown[] }[] };
    expect(v.groups).toHaveLength(4);
    for (const g of v.groups) expect(g.matches).toHaveLength(3);
    const plan = (await api().get(`/api/groups/category/${id}`).expect(200)).body as { bracketPlan: { size: number; firstRound: { a: string | null; b: string | null }[] } };
    expect(plan.bracketPlan.size).toBe(8);
    expect(plan.bracketPlan.firstRound).toHaveLength(4);
    const labels = plan.bracketPlan.firstRound.flatMap((r) => [r.a, r.b]).sort();
    expect(labels).toEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2']);
    await post(`/api/groups/category/${id}/auto`, admin).expect(409);
  });

  it('6 o‘yinchi → to‘g‘ridan-to‘g‘ri setka; 1 o‘yinchi → 400', async () => {
    const id = await category(6, 'FEMALE');
    const r = (await post(`/api/groups/category/${id}/auto`, admin).expect(201)).body as { format: string };
    expect(r.format).toBe('BRACKET');
    const one = await category(1, 'FEMALE', 'TEAM');
    await post(`/api/groups/category/${one}/auto`, admin).expect(400);
  });
});
