import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ACCOUNTS, ORIGIN, createTestApp, login } from './e2e-utils';

/**
 * Ommaviy sahifalar uchun API smoke: har bir sahifa ishlashi uchun zarur
 * endpointlar 200 qaytaradi va kutilgan shaklga ega bo'ladi.
 */
describe('Ommaviy API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/health ishlaydi', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);
    expect(res.body).toHaveProperty('status');
  });

  describe('reyting', () => {
    it('movement maydonlari bilan qaytadi', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/rankings?gender=MALE')
        .expect(200);
      const rows = res.body as Array<Record<string, unknown>>;
      if (rows.length > 0) {
        expect(rows[0]).toHaveProperty('rank');
        expect(rows[0]).toHaveProperty('movement');
        expect(rows[0]).toHaveProperty('previousRank');
      }
    });

    it('kesimlar ro‘yxati ochiq', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/rankings/snapshots')
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('mavjud bo‘lmagan kesim 404', async () => {
      await request(app.getHttpServer())
        .get('/api/rankings?snapshot=yoq-bunday-kesim')
        .expect(404);
    });

    it('kesim olish ruxsatsiz 401', async () => {
      await request(app.getHttpServer())
        .post('/api/rankings/snapshots')
        .set('Origin', ORIGIN)
        .send({})
        .expect(401);
    });
  });

  describe('o‘yinchi profili', () => {
    it('tarix va statistika qaytadi', async () => {
      const players = await request(app.getHttpServer())
        .get('/api/players')
        .expect(200);
      const slug = (players.body as Array<{ slug: string }>)[0]?.slug;
      if (!slug) return;

      const res = await request(app.getHttpServer())
        .get(`/api/players/${slug}/history`)
        .expect(200);
      expect(res.body).toHaveProperty('points');
      expect(res.body).toHaveProperty('stats.played');
    });

    it('head-to-head ikki o‘yinchi uchun hisob qaytaradi', async () => {
      const players = await request(app.getHttpServer())
        .get('/api/players')
        .expect(200);
      const [a, b] = players.body as Array<{ slug: string }>;
      if (!a || !b) return;

      const res = await request(app.getHttpServer())
        .get(`/api/players/${a.slug}/vs/${b.slug}`)
        .expect(200);
      expect(res.body).toHaveProperty('totals.aWins');
      expect(res.body).toHaveProperty('matches');
    });

    it('bir xil o‘yinchi tanlansa 400', async () => {
      const players = await request(app.getHttpServer())
        .get('/api/players')
        .expect(200);
      const slug = (players.body as Array<{ slug: string }>)[0]?.slug;
      if (!slug) return;

      await request(app.getHttpServer())
        .get(`/api/players/${slug}/vs/${slug}`)
        .expect(400);
    });
  });

  describe('qidiruv (FTS + trigram)', () => {
    it('qisqa so‘rovda bo‘sh natija', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/search?q=a')
        .expect(200);
      expect(res.body).toEqual({ players: [], tournaments: [], news: [] });
    });

    it('guruhlangan natija qaytaradi', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/search?q=chempionat&locale=uz')
        .expect(200);
      expect(res.body).toHaveProperty('players');
      expect(res.body).toHaveProperty('tournaments');
      expect(res.body).toHaveProperty('news');
    });

    it('typeahead o‘yinchilarni qaytaradi', async () => {
      const players = await request(app.getHttpServer())
        .get('/api/players')
        .expect(200);
      const name = (players.body as Array<{ lastName: string }>)[0]?.lastName;
      if (!name) return;

      const res = await request(app.getHttpServer())
        .get(`/api/search/typeahead?q=${encodeURIComponent(name.slice(0, 4))}`)
        .expect(200);
      expect(Array.isArray((res.body as { players: unknown[] }).players)).toBe(
        true,
      );
    });
  });

  describe('statik sahifalar', () => {
    it('footer ro‘yxati ochiq', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/pages?locale=uz')
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('maxfiylik sahifasi matn bilan qaytadi', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/pages/privacy?locale=uz')
        .expect(200);
      expect((res.body as { body: string }).body.length).toBeGreaterThan(20);
    });

    it('tizim sahifasini o‘chirib bo‘lmaydi', async () => {
      const admin = await login(app, ACCOUNTS.root);
      const all = await request(app.getHttpServer())
        .get('/api/pages/admin/all')
        .set('Cookie', admin)
        .set('Origin', ORIGIN)
        .expect(200);
      const system = (
        all.body as Array<{ id: string; isSystem: boolean }>
      ).find((p) => p.isSystem);
      if (!system) return;

      await request(app.getHttpServer())
        .delete(`/api/pages/${system.id}`)
        .set('Cookie', admin)
        .set('Origin', ORIGIN)
        .expect(400);
    });
  });

  describe('federatsiya kontenti', () => {
    it('xodimlar, hujjatlar, homiylar ochiq', async () => {
      await request(app.getHttpServer())
        .get('/api/federation/staff')
        .expect(200);
      await request(app.getHttpServer())
        .get('/api/federation/documents')
        .expect(200);
      await request(app.getHttpServer())
        .get('/api/federation/sponsors')
        .expect(200);
    });

    it('admin xodim qo‘shadi va o‘chiradi', async () => {
      const admin = await login(app, ACCOUNTS.root);
      const created = await request(app.getHttpServer())
        .post('/api/federation/staff')
        .set('Cookie', admin)
        .set('Origin', ORIGIN)
        .send({
          type: 'STAFF',
          translations: [
            { locale: 'uz', fullName: 'E2E Test', position: 'Sinov xodimi' },
          ],
        })
        .expect(201);

      const id = (created.body as { id: string }).id;
      await request(app.getHttpServer())
        .delete(`/api/federation/staff/${id}`)
        .set('Cookie', admin)
        .set('Origin', ORIGIN)
        .expect(200);
    });
  });
});
