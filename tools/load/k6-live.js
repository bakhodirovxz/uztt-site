/**
 * k6 yuklama testi: 20 ta stol bir vaqtda jonli hisob kiritganda API va
 * baza qanday turadi. Row-lock tranzaksiyalari real yuklamada ham
 * to'g'ri ishlashini va javob vaqti chegarada qolishini tekshiradi.
 *
 * Talab: k6 (https://k6.io/docs/get-started/installation/) va ishlab turgan API.
 *
 * Ishga tushirish:
 *   k6 run tools/load/k6-live.js
 *   API_URL=http://localhost:4000 TABLES=20 k6 run tools/load/k6-live.js
 *
 * DIQQAT: bu test o'yinlarga real ochko yozadi — faqat test bazasida ishlating.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const API = __ENV.API_URL || 'http://localhost:4000';
const TABLES = Number(__ENV.TABLES || 20);
const REFEREE_EMAIL = __ENV.REFEREE_EMAIL || 'hakam1@uztt.uz';
const REFEREE_PASSWORD = __ENV.REFEREE_PASSWORD || 'hakam123';

const pointLatency = new Trend('point_latency', true);

export const options = {
  scenarios: {
    referees: {
      executor: 'per-vu-iterations',
      vus: TABLES,
      iterations: 20, // har hakam 20 ta ochko kiritadi
      maxDuration: '2m',
    },
  },
  thresholds: {
    // Hakam bosgan tugma sezilarli kechikmasligi kerak
    'point_latency': ['p(95)<400'],
    'http_req_failed': ['rate<0.01'],
  },
};

/** Ochiq jonli o'yinlar ro'yxati — VU'lar shular orasida taqsimlanadi */
export function setup() {
  const login = http.post(
    `${API}/api/auth/login`,
    JSON.stringify({ email: REFEREE_EMAIL, password: REFEREE_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(login, { 'hakam tizimga kirdi': (r) => r.status === 201 });

  const cookies = login.cookies;
  const list = http.get(`${API}/api/matches/referee/list`, {
    cookies: toCookieJar(cookies),
  });
  const matches = list.json();

  return {
    cookies: toCookieJar(cookies),
    matchIds: (matches || []).map((m) => m.id),
  };
}

function toCookieJar(cookies) {
  const jar = {};
  for (const [name, values] of Object.entries(cookies || {})) {
    jar[name] = values.map((v) => v.value).join('');
  }
  return jar;
}

export default function (data) {
  if (!data.matchIds || data.matchIds.length === 0) {
    return; // jonli o'yin yo'q — testga ma'lumot kerak
  }
  const matchId = data.matchIds[(__VU - 1) % data.matchIds.length];

  const res = http.post(
    `${API}/api/matches/${matchId}/point`,
    JSON.stringify({ player: __ITER % 2 === 0 ? 1 : 2 }),
    {
      headers: { 'Content-Type': 'application/json' },
      cookies: data.cookies,
    },
  );

  pointLatency.add(res.timings.duration);
  check(res, {
    'ochko qabul qilindi': (r) => r.status === 201 || r.status === 200,
  });

  sleep(0.3); // real hakam tezligiga yaqin ritm
}
