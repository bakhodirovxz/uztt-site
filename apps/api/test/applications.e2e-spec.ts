import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import sharp from 'sharp';
import type { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { ACCOUNTS, ORIGIN, createTestApp, login } from './e2e-utils';

/** Ommaviy arizalar (hakam/murabbiy/klub), avtomatik hakam tayinlash va rasm yuklash xavfsizligi */
describe('Arizalar, klublar, hakam tayinlash (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let admin: string[];
  let player: string[];
  const stamp = Date.now();
  const mail = (n: string) => `${n}-${stamp}@test.uz`;
  const api = () => request(app.getHttpServer());
  const post = (url: string, c?: string[]) => {
    const r = api().post(url).set('Origin', ORIGIN);
    return c ? r.set('Cookie', c) : r;
  };
  const clubIds = (b: unknown): string[] =>
    ((Array.isArray(b) ? b : ((b as { rows?: Array<{ id: string }> }).rows ?? [])) as Array<{ id: string }>).map((x) => x.id);
  const created = { users: [] as string[], clubs: [] as string[], tournaments: [] as string[], players: [] as string[] };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    admin = await login(app, ACCOUNTS.root);
    player = await login(app, ACCOUNTS.player);
  });

  afterAll(async () => {
    await prisma.tournament.deleteMany({ where: { id: { in: created.tournaments } } });
    await prisma.player.deleteMany({ where: { id: { in: created.players } } });
    await prisma.club.deleteMany({ where: { id: { in: created.clubs } } });
    await prisma.user.deleteMany({ where: { email: { contains: `-${stamp}@test.uz` } } });
    await app.close();
  });

  const refBody = (n: string, extra: object = {}) => ({
    email: mail(n), password: 'Parol12345!', firstName: 'Hakam', lastName: n, region: 'Toshkent shahri', category: 'FIRST', ...extra,
  });

  describe('hakam bo‘lib ro‘yxatdan o‘tish', () => {
    it('ariza rol bermaydi, PENDING bo‘ladi', async () => {
      const res = await post('/api/applications/referee').send(refBody('h0')).expect(201);
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|password_hash/);
      const u = await prisma.user.findUniqueOrThrow({ where: { email: mail('h0') }, include: { roles: true, refereeProfile: true } });
      created.users.push(u.id);
      expect(u.roles).toHaveLength(0);
      expect(u.refereeProfile?.status).toBe('PENDING');
    });

    it('PENDING hakam o‘yinni boshqara olmaydi (403)', async () => {
      const c = await login(app, { email: mail('h0'), password: 'Parol12345!' });
      await api().get('/api/matches/referee/list').set('Cookie', c).expect(403);
    });

    it('takroriy email 409, zaif parol/yomon email 400, ortiqcha maydon (roles) 400', async () => {
      await post('/api/applications/referee').send(refBody('h0')).expect(409);
      await post('/api/applications/referee').send(refBody('h1', { password: 'qisqa' })).expect(400);
      await post('/api/applications/referee').send(refBody('h2', { email: 'yomon' })).expect(400);
      await post('/api/applications/referee').send(refBody('h3', { roles: ['ADMIN'] })).expect(400);
    });

    it('ommaviy ro‘yxat ruxsatsiz / oddiy foydalanuvchiga yopiq', async () => {
      await api().get('/api/applications?type=referee').expect(401);
      await api().get('/api/applications?type=referee').set('Cookie', player).expect(403);
      await post('/api/applications/referee/' + '00000000-0000-4000-8000-000000000000' + '/review', player).send({ decision: 'APPROVE' }).expect(403);
    });

    it('admin tasdiqlaydi → REFEREE roli beriladi; rad etish sababsiz 400', async () => {
      const u = await prisma.user.findUniqueOrThrow({ where: { email: mail('h0') } });
      await post(`/api/applications/referee/${u.id}/review`, admin).send({ decision: 'REJECT' }).expect(400);
      await post(`/api/applications/referee/${u.id}/review`, admin).send({ decision: 'APPROVE' }).expect(201);
      const after = await prisma.user.findUniqueOrThrow({ where: { id: u.id }, include: { roles: { include: { role: true } } } });
      expect(after.roles.map((r) => r.role.code)).toContain('REFEREE');
      // qayta ko'rib chiqib bo'lmaydi
      await post(`/api/applications/referee/${u.id}/review`, admin).send({ decision: 'APPROVE' }).expect(409);
    });
  });

  describe('murabbiy va klub', () => {
    it('murabbiy arizasi PENDING; tasdiqlangach COACH roli', async () => {
      await post('/api/applications/coach')
        .send({ email: mail('c0'), password: 'Parol12345!', firstName: 'Mur', lastName: 'Rabbiy', region: 'Samarqand viloyati' })
        .expect(201);
      const u = await prisma.user.findUniqueOrThrow({ where: { email: mail('c0') }, include: { roles: true } });
      created.users.push(u.id);
      expect(u.roles).toHaveLength(0);
      await post(`/api/applications/coach/${u.id}/review`, admin).send({ decision: 'APPROVE' }).expect(201);
      const roles = await prisma.userRole.findMany({ where: { userId: u.id }, include: { role: true } });
      expect(roles.map((r) => r.role.code)).toContain('COACH');
    });

    it('klub ochish: oddiy foydalanuvchi 403; murabbiy so‘raydi → admin tasdiqlaydi → ommaviy ro‘yxatda', async () => {
      await post('/api/clubs/request', player).send({ name: `Test klub ${stamp}`, regionName: 'Toshkent shahri' }).expect(403);
      const c = await login(app, { email: mail('c0'), password: 'Parol12345!' });
      const res = await post('/api/clubs/request', c).send({ name: `Test klub ${stamp}`, regionName: 'Toshkent shahri' }).expect(201);
      const id = (res.body as { id: string }).id;
      created.clubs.push(id);
      // tasdiqlanmaguncha ommaviy emas
      const before = await api().get(`/api/clubs?q=${stamp}`).expect(200);
      expect(clubIds(before.body).includes(id)).toBe(false);
      await post(`/api/clubs/${id}/review`, player).send({ decision: 'APPROVE' }).expect(403);
      await post(`/api/clubs/${id}/review`, admin).send({ decision: 'APPROVE' }).expect(201);
      const after = await api().get(`/api/clubs?q=${stamp}`).expect(200);
      expect(clubIds(after.body).includes(id)).toBe(true);
    });

    it('bir xil nomli klub ikki marta ochilmaydi', async () => {
      const c = await login(app, { email: mail('c0'), password: 'Parol12345!' });
      await post('/api/clubs/request', c).send({ name: `Test klub ${stamp}`, regionName: 'Toshkent shahri' }).expect(409);
    });
  });

  describe('avtomatik hakam tayinlash', () => {
    let tid: string;
    const matchIds: string[] = [];
    const refIds: string[] = [];

    beforeAll(async () => {
      const base = await prisma.tournament.findFirstOrThrow({ include: { level: true } });
      const t = await prisma.tournament.create({
        data: { slug: `asg-${stamp}`, name: 'Tayinlash test', levelId: base.levelId, startDate: base.startDate, endDate: base.endDate },
      });
      tid = t.id;
      created.tournaments.push(t.id);
      const role = await prisma.role.findUniqueOrThrow({ where: { code: 'REFEREE' } });
      for (let i = 0; i < 3; i++) {
        const u = await prisma.user.create({
          data: { email: mail(`r${i}`), passwordHash: 'x', firstName: 'Ref', lastName: `R${i}`, status: 'ACTIVE',
            roles: { create: { roleId: role.id } },
            refereeProfile: { create: { status: 'APPROVED', region: i === 0 ? 'Toshkent' : 'Buxoro', category: 'FIRST', available: true } } },
        });
        created.users.push(u.id);
        refIds.push(u.id);
      }
      const ps: string[] = [];
      for (let i = 0; i < 4; i++) {
        const p = await prisma.player.create({ data: { slug: `asg-${stamp}-${i}`, firstName: 'A', lastName: `P${i}`, gender: 'MALE', region: 'Toshkent' } });
        created.players.push(p.id);
        ps.push(p.id);
      }
      // ikki bir vaqtdagi o'yin + bittasida hakamlardan biri ishtirokchi
      await prisma.player.update({ where: { id: ps[0] }, data: { userId: refIds[1] } });
      const at = new Date(Date.now() + 86_400_000);
      for (const [a, b, n] of [[0, 1, 1], [2, 3, 2]] as const) {
        const m = await prisma.match.create({
          data: { tournamentId: tid, stage: 'ROUND_1', tableNumber: n, scheduledAt: at, player1Id: ps[a], player2Id: ps[b], refereeCodeHash: 'h' + n + stamp },
        });
        matchIds.push(m.id);
      }
    });

    it('huquqsiz foydalanuvchi tayinlay olmaydi', async () => {
      await post(`/api/tournaments/${tid}/assign-referees`, player).send({}).expect(403);
      await post(`/api/tournaments/${tid}/assign-referees`).send({}).expect(401);
    });

    it('dryRun hech narsani yozmaydi', async () => {
      const r = await post(`/api/tournaments/${tid}/assign-referees`, admin).send({ dryRun: true }).expect(201);
      expect((r.body as { assigned: number }).assigned).toBeGreaterThan(0);
      expect(await prisma.match.count({ where: { tournamentId: tid, refereeUserId: { not: null } } })).toBe(0);
    });

    it('tayinlaydi: ishtirokchi o‘z o‘yinida emas, bir vaqtda band emas, yordamchi boshqa odam', async () => {
      await post(`/api/tournaments/${tid}/assign-referees`, admin).send({}).expect(201);
      const ms = await prisma.match.findMany({ where: { id: { in: matchIds } } });
      const first = ms.find((m) => m.tableNumber === 1)!;
      expect(first.refereeUserId).toBeTruthy();
      expect(first.refereeUserId).not.toBe(refIds[1]); // r1 — 1-o'yin ishtirokchisi (ps[0])
      expect(first.assistantUserId).not.toBe(refIds[1]);
      const used = ms.flatMap((m) => [m.refereeUserId, m.assistantUserId]).filter(Boolean);
      // ikki bir vaqtdagi o'yinda 4 ta turli hakam kerak, bizda 3 ta: hech kim ikki o'yinda bo'lmasligi shart
      expect(new Set(used).size).toBe(used.length);
      expect(ms.every((m) => m.refereeUserId)).toBe(true);
    });

    it('ommaviy o‘yin ma’lumotida hakam FAQAT ismi (id/email yo‘q)', async () => {
      const res = await api().get(`/api/matches/${matchIds[0]}`).expect(200);
      expect(typeof (res.body as { referee: unknown }).referee).toBe('string');
      expect(JSON.stringify(res.body)).not.toContain('@test.uz');
    });

    it('qo‘lda: ishtirokchini hakam qilib bo‘lmaydi, bir odam ikki rolda bo‘lmaydi', async () => {
      await api().put(`/api/matches/${matchIds[0]}/referees`).set('Cookie', admin).set('Origin', ORIGIN).send({ refereeUserId: refIds[1] }).expect(400);
      await api().put(`/api/matches/${matchIds[0]}/referees`).set('Cookie', admin).set('Origin', ORIGIN).send({ refereeUserId: refIds[0], assistantUserId: refIds[0] }).expect(400);
      await api().put(`/api/matches/${matchIds[0]}/referees`).set('Cookie', admin).set('Origin', ORIGIN).send({ refereeUserId: 'yomon' }).expect(400);
    });

    it('tasdiqlanmagan (PENDING) hakamni tayinlab bo‘lmaydi', async () => {
      const u = (await prisma.user.create({ data: { email: mail('pend'), passwordHash: 'x', firstName: 'P', lastName: 'P', refereeProfile: { create: { status: 'PENDING' } } } }));
      created.users.push(u.id);
      await api().put(`/api/matches/${matchIds[0]}/referees`).set('Cookie', admin).set('Origin', ORIGIN).send({ refereeUserId: u.id }).expect(400);
    });

    it('guruh yaratilganda hakamlar AVTOMATIK tayinlanadi (hook)', async () => {
      const age = await prisma.ageCategory.findFirstOrThrow({ where: { maxAge: null } });
      const cat = await prisma.tournamentCategory.create({ data: { tournamentId: tid, ageCategoryId: age.id, gender: 'MALE', eventType: 'SINGLES' } });
      const ps: string[] = [];
      for (let i = 0; i < 4; i++) {
        const p = await prisma.player.create({ data: { slug: `hook-${stamp}-${i}`, firstName: 'H', lastName: `K${i}`, gender: 'MALE', region: 'Toshkent', rankingPoints: 500 - i } });
        created.players.push(p.id);
        ps.push(p.id);
        await prisma.tournamentRegistration.create({ data: { playerId: p.id, tournamentCategoryId: cat.id, status: 'CONFIRMED' } });
      }
      await post(`/api/groups/category/${cat.id}`, admin).send({ groupCount: 1, advancing: 2, bestOf: 3 }).expect(201);
      const ms = await prisma.match.findMany({ where: { tournamentId: tid, player1Id: { in: ps } }, select: { refereeUserId: true } });
      expect(ms).toHaveLength(6);
      expect(ms.every((m) => m.refereeUserId)).toBe(true);
    });

    it('boshqa hakam kodni kirita olmaydi (tayinlangan hakamdan boshqa)', async () => {
      const m = await prisma.match.findUniqueOrThrow({ where: { id: matchIds[0] } });
      const code = (await post(`/api/matches/${m.id}/regenerate-code`, admin).expect(201)).body as { refereeCode: string };
      // seed'dagi hakam1 tayinlanmagan → 403
      const other = await login(app, ACCOUNTS.referee);
      await post(`/api/matches/${m.id}/verify`, other).send({ code: code.refereeCode }).expect(403);
    });
  });

  describe('o‘yinchi rasmi yuklash', () => {
    let pid: string;
    beforeAll(async () => {
      const p = await prisma.player.create({ data: { slug: `foto-${stamp}`, firstName: 'Foto', lastName: 'Test', gender: 'MALE', region: 'Toshkent' } });
      pid = p.id;
      created.players.push(p.id);
    });
    const png = (w = 300, h = 400) => sharp({ create: { width: w, height: h, channels: 3, background: '#335' } }).png().toBuffer();

    it('ruxsatsiz 401, begona foydalanuvchi 403', async () => {
      await post(`/api/players/${pid}/photo`).attach('file', await png(), 'a.png').expect(401);
      await post(`/api/players/${pid}/photo`, player).attach('file', await png(), 'a.png').expect(403);
    });

    it('admin yuklaydi: WebP + kichik nusxa yaratiladi, URL yangilanadi', async () => {
      const res = await post(`/api/players/${pid}/photo`, admin).attach('file', await png(), 'a.png').expect(201);
      const b = res.body as { photoUrl: string; thumbUrl: string };
      expect(b.photoUrl).toMatch(/^\/uploads\/players\/.+\.webp$/);
      expect(b.thumbUrl).toMatch(/-thumb\.webp$/);
      const p = await prisma.player.findUniqueOrThrow({ where: { id: pid } });
      expect(p.photoUrl).toBe(b.photoUrl);
    });

    it('rasm bo‘lmagan fayl (.png nomi bilan) rad etiladi', async () => {
      await post(`/api/players/${pid}/photo`, admin).attach('file', Buffer.from('<?php echo 1; ?>'), { filename: 'x.png', contentType: 'image/png' }).expect(400);
      await post(`/api/players/${pid}/photo`, admin).attach('file', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>'), { filename: 'x.svg', contentType: 'image/svg+xml' }).expect(400);
    });

    it('juda kichik rasm va 5 MB dan katta fayl rad etiladi', async () => {
      await post(`/api/players/${pid}/photo`, admin).attach('file', await png(50, 50), 'k.png').expect(400);
      await post(`/api/players/${pid}/photo`, admin).attach('file', Buffer.alloc(6 * 1024 * 1024, 1), { filename: 'big.png', contentType: 'image/png' }).expect(413);
    });
  });
});
