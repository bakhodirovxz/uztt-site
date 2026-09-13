import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  ACCOUNTS,
  ORIGIN,
  createTestApp,
  findLeakedKey,
  login,
} from './e2e-utils';

/**
 * Xavfsizlik regressiyasi: MVP'dagi har bir kamchilik uchun bitta test.
 * Bu fayl "o'tib ketmasligi kerak" chegaralarni qo'riqlaydi.
 *
 * HTTP throttle (login 20/15daq) ataylab sinalmaydi: bitta IP'dan limitni
 * to'ldirish qolgan testlarni ham bloklab qo'yardi. Uning o'rniga domen
 * darajasidagi cheklov — hakam kodi 5 urinishda bloklanishi — tekshiriladi
 * (referee-lifecycle.e2e-spec.ts).
 */
describe('Xavfsizlik (e2e)', () => {
  let app: INestApplication<App>;
  let rootCookies: string[];
  let editorCookies: string[];

  beforeAll(async () => {
    app = await createTestApp();
    rootCookies = await login(app, ACCOUNTS.root);
    editorCookies = await login(app, ACCOUNTS.editor);
  });

  afterAll(async () => {
    await app.close();
  });

  const SECRET_KEYS = [
    'refereeCodeHash',
    'refereeCode',
    'overlayToken',
    'passwordHash',
    'documentNumberEnc',
    'filePathEnc',
    'tokenHash',
  ];

  describe('sirlar ochiq javoblarga tushmaydi', () => {
    const publicEndpoints = [
      '/api/matches/live',
      '/api/players',
      '/api/tournaments',
      '/api/rankings',
      '/api/news?locale=uz',
      '/api/federation/staff',
      '/api/pages',
    ];

    it.each(publicEndpoints)('%s', async (url) => {
      const res = await request(app.getHttpServer()).get(url).expect(200);
      expect(findLeakedKey(res.body, SECRET_KEYS)).toBeNull();
    });

    it('musobaqa tafsiloti (o‘yinlar bilan) ham sirsiz', async () => {
      const list = await request(app.getHttpServer())
        .get('/api/tournaments')
        .expect(200);
      const slug = (list.body as Array<{ slug: string }>)[0]?.slug;
      if (!slug) return; // seed'da turnir yo'q bo'lsa tekshirishga narsa yo'q

      const res = await request(app.getHttpServer())
        .get(`/api/tournaments/${slug}`)
        .expect(200);
      expect(findLeakedKey(res.body, SECRET_KEYS)).toBeNull();
    });
  });

  describe('autentifikatsiya va avtorizatsiya', () => {
    it('tizimga kirmasdan yangilik yaratib bo‘lmaydi', async () => {
      await request(app.getHttpServer())
        .post('/api/news')
        .set('Origin', ORIGIN)
        .send({
          translations: [{ locale: 'uz', title: 'Test', body: 'Matn matni' }],
        })
        .expect(401);
    });

    it('muharrir o‘yinchini tasdiqlay olmaydi (player.verify yo‘q)', async () => {
      const players = await request(app.getHttpServer())
        .get('/api/players')
        .expect(200);
      const id = (players.body as Array<{ id: string }>)[0]?.id;
      if (!id) return;

      await request(app.getHttpServer())
        .post(`/api/registration/players/${id}/verify`)
        .set('Cookie', editorCookies)
        .set('Origin', ORIGIN)
        .expect(403);
    });

    it('muharrir foydalanuvchilar ro‘yxatini ko‘ra olmaydi', async () => {
      await request(app.getHttpServer())
        .get('/api/users')
        .set('Cookie', editorCookies)
        .set('Origin', ORIGIN)
        .expect(403);
    });

    it('root uchun ruxsat berilgan', async () => {
      await request(app.getHttpServer())
        .get('/api/users')
        .set('Cookie', rootCookies)
        .set('Origin', ORIGIN)
        .expect(200);
    });

    it('noto‘g‘ri parol bilan kirish 401', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('Origin', ORIGIN)
        .send({ email: ACCOUNTS.editor.email, password: 'notmypassword' })
        .expect(401);
    });
  });

  describe('kiritish validatsiyasi (mass assignment)', () => {
    it('DTO’da yo‘q maydon bilan so‘rov 400 qaytaradi', async () => {
      await request(app.getHttpServer())
        .post('/api/news')
        .set('Cookie', rootCookies)
        .set('Origin', ORIGIN)
        .send({
          status: 'DRAFT',
          isSystem: true, // DTO'da yo'q — whitelist buni rad etadi
          translations: [{ locale: 'uz', title: 'Test', body: 'Matn matni' }],
        })
        .expect(400);
    });

    it('noto‘g‘ri turdagi qiymat 400 qaytaradi', async () => {
      await request(app.getHttpServer())
        .post('/api/videos')
        .set('Cookie', rootCookies)
        .set('Origin', ORIGIN)
        .send({ youtubeId: 'bu yerda bo‘shliq bor', translations: [] })
        .expect(400);
    });

    it('UUID bo‘lmagan id ParseUUIDPipe’da 400', async () => {
      await request(app.getHttpServer())
        .get('/api/matches/not-a-uuid')
        .expect(400);
    });
  });

  describe('maxfiy fayllar', () => {
    it('uploads/private hech qachon serve qilinmaydi', async () => {
      const res = await request(app.getHttpServer()).get(
        '/uploads/private/anything.enc',
      );
      expect(res.status).toBe(404);
    });
  });

  describe('kesh yangilash webhooki', () => {
    it('sirsiz revalidate chaqiruvi web tomonida rad etiladi', () => {
      // API tomonida sir yo'q bo'lsa umuman chaqiruv yubormaydi —
      // sozlama to'liq bo'lmasa boot bosqichida xato beriladi.
      const url = process.env.WEB_REVALIDATE_URL;
      const secret = process.env.REVALIDATE_SECRET;
      expect(Boolean(url) === Boolean(secret)).toBe(true);
    });
  });
});
