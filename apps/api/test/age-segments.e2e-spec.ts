import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './e2e-utils';

/** Kumulyativ yosh segmenti: U-N = N yosh va undan kichik BARCHA o'yinchilar */
describe('Yosh segmentlari (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const tag = `AgeTest${Date.now()}`;
  const ids: string[] = [];
  const year = new Date().getUTCFullYear();

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    for (const age of [8, 12, 13, 14, 16, 20]) {
      const p = await prisma.player.create({
        data: { slug: `age-${age}-${tag}`.toLowerCase(), firstName: `Y${age}`, lastName: tag, gender: 'MALE', region: 'Toshkent shahri', birthDate: new Date(Date.UTC(year - age, 0, 1)) },
      });
      ids.push(p.id);
    }
    const nobirth = await prisma.player.create({ data: { slug: `age-none-${tag}`.toLowerCase(), firstName: 'Yn', lastName: tag, gender: 'MALE', region: 'Toshkent shahri' } });
    ids.push(nobirth.id);
  });
  afterAll(async () => { await prisma.player.deleteMany({ where: { id: { in: ids } } }); await app.close(); });

  const count = async (cat?: string) => {
    const res = await request(app.getHttpServer()).get(`/api/players?search=${tag}${cat ? `&ageCategory=${cat}` : ''}&pageSize=100`).expect(200);
    return (res.body as { rows: Array<{ firstName: string; age: number | null; birthDate?: unknown }> }).rows;
  };

  it('U-9 faqat 8 yoshli; U-13 — 8, 12, 13 (13 ham kiradi); U-15 — +14; U-17 — +16', async () => {
    expect((await count('U9')).map((r) => r.firstName).sort()).toEqual(['Y8']);
    expect((await count('U13')).map((r) => r.firstName).sort()).toEqual(['Y12', 'Y13', 'Y8']);
    expect((await count('U15')).map((r) => r.firstName).sort()).toEqual(['Y12', 'Y13', 'Y14', 'Y8']);
    expect((await count('U17')).map((r) => r.firstName).sort()).toEqual(['Y12', 'Y13', 'Y14', 'Y16', 'Y8']);
  });

  it('Kattalar va filtrsiz — hamma (tug‘ilgan sanasizlar ham)', async () => {
    expect(await count('SENIOR')).toHaveLength(7);
    expect(await count()).toHaveLength(7);
  });

  it('noma‘lum toifa — bo‘sh; to‘liq tug‘ilgan sana oshkor bo‘lmaydi, faqat yosh', async () => {
    expect(await count('U99')).toHaveLength(0);
    const rows = await count('U13');
    expect(rows.every((r) => r.birthDate === undefined)).toBe(true);
    expect(rows.find((r) => r.firstName === 'Y12')?.age).toBe(12);
  });
});
