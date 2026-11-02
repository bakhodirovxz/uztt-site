import { INestApplication } from '@nestjs/common';
import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';
import sharp from 'sharp';
import type { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { ACCOUNTS, ORIGIN, createTestApp, login } from './e2e-utils';

/** Reklama turlari (rasm / rolik / promo), rolik yuklash xavfsizligi va bo'sh vaqt ma'lumoti */
describe('Reklama va bo‘sh vaqt aylanmasi (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let admin: string[];
  let player: string[];
  const ids: string[] = [];
  const api = () => request(app.getHttpServer());
  const post = (u: string, c?: string[]) => { const r = api().post(u).set('Origin', ORIGIN); return c ? r.set('Cookie', c) : r; };

  let mp4: Buffer | null = null;
  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    admin = await login(app, ACCOUNTS.root);
    player = await login(app, ACCOUNTS.player);
    try {
      const f = join(mkdtempSync(join(tmpdir(), 'ad-')), 't.mp4');
      execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=320x180:d=2', '-pix_fmt', 'yuv420p', f]);
      mp4 = readFileSync(f);
    } catch { mp4 = null; }
  });
  afterAll(async () => {
    await prisma.overlayAd.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  });

  it('rolik yuklash: huquqsiz 401/403', async () => {
    await post('/api/uploads/video').attach('file', Buffer.from('x'), 'a.mp4').expect(401);
    await post('/api/uploads/video', player).attach('file', Buffer.from('x'), 'a.mp4').expect(403);
  });

  it('video bo‘lmagan fayl (.mp4 nomi bilan) va PHP rad etiladi', async () => {
    await post('/api/uploads/video', admin).attach('file', Buffer.from('<?php echo 1; ?>'), { filename: 'x.mp4', contentType: 'video/mp4' }).expect(400);
    await post('/api/uploads/video', admin).attach('file', Buffer.alloc(30, 0), { filename: 'x.mp4', contentType: 'video/mp4' }).expect(400);
  });

  it('20 MB dan katta rolik 413', async () => {
    await post('/api/uploads/video', admin).attach('file', Buffer.alloc(21 * 1024 * 1024, 1), { filename: 'big.mp4', contentType: 'video/mp4' }).expect(413);
  });

  it('haqiqiy MP4 yuklanadi va davomiylik qaytadi; undan VIDEO reklama yaratiladi', async () => {
    if (!mp4) return; // ffmpeg yo'q muhit
    const up = await post('/api/uploads/video', admin).attach('file', mp4, { filename: 't.mp4', contentType: 'video/mp4' }).expect(201);
    const b = up.body as { url: string; durationS: number | null };
    expect(b.url).toMatch(/^\/uploads\/videos\/[\w-]+\.mp4$/);
    expect(b.durationS).toBeGreaterThanOrEqual(2);
    const ad = await post('/api/showcase/ads', admin).send({ title: 'Rolik', kind: 'VIDEO', videoUrl: b.url, durationS: 8 }).expect(201);
    ids.push((ad.body as { id: string }).id);
    const pub = await api().get('/api/showcase/ads').expect(200);
    const row = (pub.body as Array<{ id: string; kind: string; videoUrl: string | null }>).find((x) => x.id === ids[0]);
    expect(row?.kind).toBe('VIDEO');
    expect(row?.videoUrl).toBe(b.url);
  });

  it('davomiylik chegaralari: rolik ≤ 15 s, promo ≤ 30 s, rasm ≤ 15 s', async () => {
    const v = '/uploads/videos/abc.mp4';
    await post('/api/showcase/ads', admin).send({ title: 'x', kind: 'VIDEO', videoUrl: v, durationS: 20 }).expect(400);
    await post('/api/showcase/ads', admin).send({ title: 'x', kind: 'IMAGE', imageUrl: '/uploads/images/a.webp', durationS: 20 }).expect(400);
    const ok = await post('/api/showcase/ads', admin).send({ title: 'Promo', kind: 'PROMO', videoUrl: v, durationS: 30 }).expect(201);
    ids.push((ok.body as { id: string }).id);
    await post('/api/showcase/ads', admin).send({ title: 'x', kind: 'PROMO', videoUrl: v, durationS: 31 }).expect(400);
  });

  it('tashqi/xavfli manzil va turga mos bo‘lmagan maydon rad etiladi', async () => {
    await post('/api/showcase/ads', admin).send({ title: 'x', kind: 'VIDEO', videoUrl: 'https://evil.example/a.mp4' }).expect(400);
    await post('/api/showcase/ads', admin).send({ title: 'x', kind: 'VIDEO', videoUrl: 'javascript:alert(1)' }).expect(400);
    await post('/api/showcase/ads', admin).send({ title: 'x', kind: 'VIDEO' }).expect(400); // rolik yo'q
    await post('/api/showcase/ads', admin).send({ title: 'x', kind: 'IMAGE' }).expect(400); // rasm yo'q
    await post('/api/showcase/ads', player).send({ title: 'x', kind: 'PROMO', videoUrl: '/uploads/videos/a.mp4' }).expect(403);
  });

  it('bo‘sh vaqt ma’lumoti ommaviy; faqat ism/natija, id/email yo‘q', async () => {
    const res = await api().get('/api/showcase/idle?table=1').expect(200);
    const b = res.body as { results: unknown[]; upcoming: unknown[]; groupCategories: unknown[] };
    expect(Array.isArray(b.results) && Array.isArray(b.upcoming) && Array.isArray(b.groupCategories)).toBe(true);
    expect(JSON.stringify(res.body)).not.toMatch(/@|passwordHash|refereeCode|overlayToken/);
  });

  it('rasm reklama (eski oqim) ishlashda davom etadi', async () => {
    const png = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#223' } }).png().toBuffer();
    const up = await post('/api/uploads/image', admin).attach('file', png, 'a.png').expect(201);
    const ad = await post('/api/showcase/ads', admin).send({ title: 'Rasm', imageUrl: (up.body as { url: string }).url, durationS: 10 }).expect(201);
    ids.push((ad.body as { id: string }).id);
    expect((ad.body as { kind: string }).kind).toBe('IMAGE');
  });
});
