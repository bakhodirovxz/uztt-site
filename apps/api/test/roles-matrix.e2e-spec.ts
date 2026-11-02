import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ORIGIN, createTestApp, login } from './e2e-utils';

const U = '00000000-0000-4000-8000-000000000000';

/** [usul, yo'l, kerakli permission] — ruxsatsiz rol 403, ruxsatli rol 401/403 BERMASLIGI kerak */
const ENDPOINTS: Array<[string, string, string]> = [
  ['get', '/api/users', 'user.manage'],
  ['post', '/api/users', 'user.manage'],
  ['get', '/api/roles', 'role.manage'],
  ['get', '/api/applications?type=referee', 'applicant.review'],
  ['post', `/api/applications/referee/${U}/review`, 'applicant.review'],
  ['get', '/api/clubs/pending', 'applicant.review'],
  ['post', `/api/clubs/${U}/review`, 'applicant.review'],
  ['post', `/api/tournaments/${U}/assign-referees`, 'referee.assign'],
  ['put', `/api/matches/${U}/referees`, 'referee.assign'],
  ['post', '/api/tournaments', 'tournament.manage'],
  ['post', '/api/draws/generate', 'draw.manage'],
  ['post', `/api/groups/category/${U}`, 'draw.manage'],
  ['post', '/api/news', 'news.manage'],
  ['post', '/api/uploads/image', 'media.manage'],
  ['post', '/api/uploads/video', 'media.manage'],
  ['post', '/api/showcase/ads', 'media.manage'],
  ['get', '/api/contact/inbox', 'contact.inbox'],
  ['post', `/api/matches/${U}/verify`, 'match.score'],
  ['post', `/api/matches/${U}/point`, 'match.score'],
  ['post', `/api/matches/${U}/regenerate-code`, 'match.manage'],
  ['post', `/api/rankings/players/${U}/exclude`, 'ranking.adjust'],
  ['get', '/api/rankings/inactive', 'ranking.adjust'],
  ['post', '/api/uttf-sync/run', 'uttf.sync'],
  ['get', '/api/registration/pending', 'player.verify'],
  ['post', '/api/players', 'player.manage'],
  ['delete', `/api/players/${U}`, 'player.manage'],
];

const ACCOUNTS: Array<[string, string, string]> = [
  ['PLAYER', 'oyinchi@uztt.uz', 'oyinchi123'],
  ['COACH', 'murabbiy@uztt.uz', 'murabbiy123'],
  ['REFEREE', 'hakam1@uztt.uz', 'hakam123'],
  ['EDITOR', 'muharrir@uztt.uz', 'muharrir123'],
  ['OPERATOR', 'operator@uztt.uz', 'operator123'],
  ['ADMIN', 'mudir@uztt.uz', 'mudir123'],
  ['STREAM', 'overlay1@uztt.uz', 'overlay123'],
  ['SCREEN', 'screen1@uztt.uz', 'screen123'],
  ['SUPERADMIN', 'admin@uztt.uz', 'admin123'],
];

describe('Rollar × endpointlar xavfsizlik matritsasi (e2e)', () => {
  let app: INestApplication<App>;
  beforeAll(async () => { app = await createTestApp(); });
  afterAll(async () => { await app.close(); });

  const call = (method: string, path: string, cookie?: string[]) => {
    const r = (request(app.getHttpServer()) as unknown as Record<string, (u: string) => request.Test>)[method](path).set('Origin', ORIGIN);
    return (cookie ? r.set('Cookie', cookie) : r).send({});
  };

  it('kirmasdan hamma himoyalangan endpoint 401', async () => {
    for (const [m, p] of ENDPOINTS) {
      const res = await call(m, p);
      expect([401, 403]).toContain(res.status); // 401; CSRF/guard 403 ham himoya
    }
  });

  for (const [role, email, password] of ACCOUNTS) {
    it(`${role}: faqat o‘z permissionlari bo‘yicha ruxsat`, async () => {
      let cookie: string[];
      try {
        cookie = await login(app, { email, password });
      } catch {
        return; // bu muhitda shu hisob yo'q (production)
      }
      const me = await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', cookie).expect(200);
      const perms = new Set((me.body as { user: { permissions: string[] } }).user.permissions);
      const violations: string[] = [];
      for (const [m, p, perm] of ENDPOINTS) {
        const res = await call(m, p, cookie);
        const allowed = perms.has(perm);
        if (allowed && (res.status === 401 || res.status === 403)) violations.push(`${m} ${p}: ruxsat bor, lekin ${res.status}`);
        if (!allowed && res.status !== 403) violations.push(`${m} ${p}: ruxsat YO'Q, lekin ${res.status}`);
      }
      expect(violations).toEqual([]);
    });
  }
});
