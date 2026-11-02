import { INestApplication } from '@nestjs/common';
import * as argon2 from 'argon2';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { ACCOUNTS, ORIGIN, createTestApp, login } from './e2e-utils';

/** Boshlang'ich parol: kirish → faqat parol almashtirish mumkin → almashtirgach hammasi ochiladi */
describe('Parol almashtirish (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const email = `pw-${Date.now()}@test.uz`;
  const first = 'Boshlangich-Parol-1';
  const api = () => request(app.getHttpServer());
  const post = (u: string, c?: string[]) => { const r = api().post(u).set('Origin', ORIGIN); return c ? r.set('Cookie', c) : r; };
  let cookies: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const role = await prisma.role.findUniqueOrThrow({ where: { code: 'PLAYER' } });
    await prisma.user.create({
      data: { email, passwordHash: await argon2.hash(first, { type: argon2.argon2id }), firstName: 'P', lastName: 'W', mustChangePassword: true, roles: { create: { roleId: role.id } } },
    });
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('/auth/session: kirmaganda 200 {authenticated:false} (401 shovqini yo‘q), kirganda true', async () => {
    const anon = await api().get('/api/auth/session').expect(200);
    expect(anon.body).toEqual({ authenticated: false });
    const res = await post('/api/auth/login').send({ email, password: first }).expect(200);
    const c = (res.headers['set-cookie'] as unknown as string[]).map((x) => x.split(';')[0]);
    const ok = await api().get('/api/auth/session').set('Cookie', c).expect(200);
    expect(ok.body).toEqual({ authenticated: true });
  });

  it('boshlang‘ich parol bilan kirish mumkin, me da mustChangePassword=true', async () => {
    const res = await post('/api/auth/login').send({ email, password: first }).expect(200);
    cookies = (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]);
    expect((res.body as { user: { mustChangePassword?: boolean } }).user.mustChangePassword).toBe(true);
    const me = await api().get('/api/auth/me').set('Cookie', cookies).expect(200);
    expect((me.body as { user: { mustChangePassword?: boolean } }).user.mustChangePassword).toBe(true);
  });

  it('parol almashtirilmaguncha himoyalangan endpointlar 403 PASSWORD_CHANGE_REQUIRED', async () => {
    const r = await api().get('/api/applications/me').set('Cookie', cookies).expect(403);
    expect((r.body as { code: string }).code).toBe('PASSWORD_CHANGE_REQUIRED');
    // ommaviy endpointlar ishlaydi
    await api().get('/api/rankings?pageSize=1').set('Cookie', cookies).expect(200);
  });

  it('noto‘g‘ri joriy parol 401, bir xil parol 400, qisqa parol 400, ortiqcha maydon 400', async () => {
    await post('/api/auth/change-password', cookies).send({ currentPassword: 'xato-parol', newPassword: 'Yangi-Parol-12345' }).expect(401);
    await post('/api/auth/change-password', cookies).send({ currentPassword: first, newPassword: first }).expect(400);
    await post('/api/auth/change-password', cookies).send({ currentPassword: first, newPassword: 'qisqa' }).expect(400);
    await post('/api/auth/change-password', cookies).send({ currentPassword: first, newPassword: 'Yangi-Parol-12345', role: 'ADMIN' }).expect(400);
  });

  it('ruxsatsiz change-password 401', async () => {
    await post('/api/auth/change-password').send({ currentPassword: first, newPassword: 'Yangi-Parol-12345' }).expect(401);
  });

  it('muvaffaqiyatli almashtirish: yangi cookie, flag o‘chadi, eski parol ishlamaydi, eski sessiya bekor', async () => {
    const oldRefresh = (await post('/api/auth/login').send({ email, password: first }).expect(200)).headers['set-cookie'] as unknown as string[];
    const res = await post('/api/auth/change-password', cookies).send({ currentPassword: first, newPassword: 'Yangi-Parol-12345' }).expect(200);
    expect((res.body as { user: { mustChangePassword?: boolean } }).user.mustChangePassword).toBeUndefined();
    const fresh = (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]);
    await api().get('/api/applications/me').set('Cookie', fresh).expect(200);
    await post('/api/auth/login').send({ email, password: first }).expect(401);
    await post('/api/auth/login').send({ email, password: 'Yangi-Parol-12345' }).expect(200);
    // eski refresh token endi yaroqsiz
    const refresh = oldRefresh.map((c) => c.split(';')[0]).filter((c) => c.startsWith('uztt_rt') || /refresh/i.test(c));
    if (refresh.length) await post('/api/auth/refresh').set('Cookie', refresh).expect(401);
  });
});

describe('Akkaunt bloklash va parol siyosati (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const email = `lock-${Date.now()}@test.uz`;
  const pw = 'Yaxshi-Parol-12345';
  const api = () => request(app.getHttpServer());
  const post = (u: string, c?: string[]) => { const r = api().post(u).set('Origin', ORIGIN); return c ? r.set('Cookie', c) : r; };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const role = await prisma.role.findUniqueOrThrow({ where: { code: 'PLAYER' } });
    await prisma.user.create({ data: { email, passwordHash: await argon2.hash(pw, { type: argon2.argon2id }), firstName: 'L', lastName: 'K', roles: { create: { roleId: role.id } } } });
  });
  afterAll(async () => { await prisma.user.deleteMany({ where: { email } }); await app.close(); });

  it('8 ta xato paroldan keyin hisob bloklanadi: to‘g‘ri parol ham o‘tmaydi', async () => {
    for (let i = 0; i < 8; i++) await post('/api/auth/login').send({ email, password: 'Xato-Parol-99999' }).expect(401);
    const res = await post('/api/auth/login').send({ email, password: pw }).expect(401);
    expect(JSON.stringify(res.body)).toMatch(/bloklangan/);
    const u = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(u.lockedUntil && u.lockedUntil > new Date()).toBeTruthy();
  });

  it('blok muddati o‘tgach kirish ishlaydi va hisoblagich tozalanadi', async () => {
    await prisma.user.update({ where: { email }, data: { lockedUntil: new Date(Date.now() - 1000) } });
    await post('/api/auth/login').send({ email, password: pw }).expect(200);
    const u = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(u.failedLoginCount).toBe(0);
    expect(u.lockedUntil).toBeNull();
  });

  it('mavjud bo‘lmagan email ham bir xil 401 (vaqt/xabar farqi yo‘q)', async () => {
    const a = await post('/api/auth/login').send({ email: 'yoq-odam@test.uz', password: 'Xato-Parol-99999' }).expect(401);
    const b = await post('/api/auth/login').send({ email, password: 'Xato-Parol-99999' }).expect(401);
    expect(a.body.message).toBe(b.body.message);
  });

  it('administrator parol tiklaydi: boshqaruvchiga zaif parol 400; kuchlisi → vaqtinchalik (majburiy almashtirish) va blok ochiladi', async () => {
    const admin = await login(app, ACCOUNTS.root);
    const role = await prisma.role.findUniqueOrThrow({ where: { code: 'REFEREE' } });
    const mail = `staff-${Date.now()}@test.uz`;
    const u = await prisma.user.create({ data: { email: mail, passwordHash: 'x', firstName: 'S', lastName: 'T', lockedUntil: new Date(Date.now() + 600_000), failedLoginCount: 3, roles: { create: { roleId: role.id } } } });
    try {
      await post(`/api/users/${u.id}/password`, admin).send({ password: 'Parol12345' }).expect(400); // maxsus belgi/uzunlik yo'q
      await post(`/api/users/${u.id}/password`, admin).send({ password: 'Vaqtinchalik-Parol-2026!' }).expect(201);
      const after = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
      expect(after.mustChangePassword).toBe(true);
      expect(after.lockedUntil).toBeNull();
      await post('/api/auth/login').send({ email: mail, password: 'Vaqtinchalik-Parol-2026!' }).expect(200);
    } finally {
      await prisma.user.delete({ where: { id: u.id } });
    }
  });
});
