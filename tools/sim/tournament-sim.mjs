#!/usr/bin/env node
/**
 * To'liq musobaqa simulyatsiyasi — platformani boshidan oxirigacha haqiqiy
 * ish oqimida sinaydi:
 *
 *   1. o'yinchilar bazasini to'ldirish (yosh toifalari va jins bo'yicha),
 *   2. musobaqa ochish,
 *   3. guruhlar (yosh toifasi × jins) yaratish,
 *   4. ishtirokchilarni yozish,
 *   5. qura o'tkazish (setka) va stollarni taqsimlash,
 *   6. musobaqani boshlash: har o'yinda hakam kodi → tasdiqlash → ochkolar,
 *   7. musobaqani yakunlash va hisobot (chempionlar, berilgan ballar).
 *
 * DIQQAT: bu skript bazaga REAL ma'lumot yozadi (o'yinchi, turnir, o'yin,
 * reyting balli). Faqat test/demo bazasida ishlating.
 *
 * Ishga tushirish:
 *   node tools/sim/tournament-sim.mjs
 *   API_URL=http://localhost:4000 PER_GROUP=8 node tools/sim/tournament-sim.mjs
 */

const API = process.env.API_URL ?? 'http://localhost:4000';
const ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:3100';
/** Har guruhdagi ishtirokchilar soni (2 ning darajasi bo'lgani ma'qul) */
const PER_GROUP = Number(process.env.PER_GROUP ?? 8);
const YEAR = Number(process.env.TOURNAMENT_YEAR ?? 2026);

const ADMIN = { email: 'admin@uztt.uz', password: 'admin123' };
const REFEREE = { email: 'hakam1@uztt.uz', password: 'hakam123' };

/** Har yugurishning belgisi — litsenziya raqamlari takrorlanmasin */
const RUN_ID = new Date().toISOString().slice(5, 16).replace(/[-:T]/g, '');

/** Yosh toifalari: kod → shu toifaga tushadigan tug'ilgan yillar oralig'i */
const AGE_BANDS = [
  { code: 'U13', label: 'U-13', minAge: 11, maxAge: 13 },
  { code: 'U15', label: 'U-15', minAge: 14, maxAge: 15 },
  { code: 'U17', label: 'U-17', minAge: 16, maxAge: 17 },
  { code: 'U19', label: 'U-19', minAge: 18, maxAge: 19 },
  { code: 'SENIOR', label: 'Kattalar', minAge: 20, maxAge: 32 },
];

const GENDERS = [
  { code: 'MALE', label: 'Erkaklar' },
  { code: 'FEMALE', label: 'Ayollar' },
];

const REGIONS = [
  'Toshkent', 'Samarqand', "Farg'ona", 'Andijon', 'Buxoro',
  'Namangan', 'Qashqadaryo', 'Surxondaryo', 'Xorazm', 'Navoiy',
  'Jizzax', 'Sirdaryo', "Qoraqalpog'iston",
];

const MALE_NAMES = [
  'Jasur', 'Sardor', 'Bekzod', 'Otabek', 'Sherzod', 'Diyorbek', 'Aziz',
  'Islom', 'Ulugbek', 'Doston', 'Javohir', 'Shohruh', 'Alisher', 'Temur',
  'Bobur', 'Sanjar', 'Nodir', 'Rustam', 'Farrux', 'Umid',
];
const FEMALE_NAMES = [
  'Madina', 'Nilufar', 'Zarina', 'Kamola', 'Sevara', 'Gulnoza', 'Dilnoza',
  'Malika', 'Shahzoda', 'Aziza', 'Nigora', 'Feruza', 'Sabina', 'Robiya',
  'Iroda', 'Zilola', 'Muslima', 'Nasiba', 'Oysha', 'Barno',
];
const SURNAMES = [
  'Rahimov', 'Yusupov', 'Qodirov', 'Nazarov', 'Tursunov', 'Ergashev',
  'Karimov', 'Xolov', 'Ismoilov', 'Rashidov', 'Aminov', 'Sultonov',
  'Mirzayev', 'Toshpulatov', 'Abdullayev', 'Xasanov', 'Yo‘ldoshev',
  'Sobirov', 'Nematov', 'Qurbonov',
];

// ==================== yordamchilar ====================

const t0 = Date.now();
const stamp = () => `${String((Date.now() - t0) / 1000).padStart(6)}s`;
const log = (msg) => console.log(`[${stamp()}] ${msg}`);

/**
 * Takrorlanadigan tasodif (mulberry32) — bir xil urug'da bir xil natija.
 * Oddiy LCG ishlatilgandi, lekin `seed * 1103515245` 2^53 dan oshib
 * aniqlikni yo'qotardi va ketma-ket bir xil qiymatlar chiqib, bir xil
 * ism/klub/ballga ega "egizak" o'yinchilar yaratilardi.
 */
let seed = Number(process.env.SEED ?? 20260811) >>> 0;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

async function api(path, { method = 'GET', body, cookie, retries = 2 } = {}) {
  const res = await fetch(`${API}/api${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { cookie, Origin: ORIGIN } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    // Vaqtinchalik holatlarda (chegara, tarmoq) qayta urinamiz
    if ((res.status === 429 || res.status >= 500) && retries > 0) {
      await new Promise((r) => setTimeout(r, 400));
      return api(path, { method, body, cookie, retries: retries - 1 });
    }
    const msg = Array.isArray(data?.message)
      ? data.message.join(', ')
      : data?.message;
    throw new Error(
      `${method} ${path} → ${res.status}: ${msg ?? text.slice(0, 120)}`,
    );
  }
  return data;
}

async function login({ email, password }) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`${email} kira olmadi: ${res.status}`);
  return (res.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(';')[0])
    .join('; ');
}

/** Vazifalarni cheklangan parallellikda bajarish */
async function pool(items, limit, fn) {
  const results = [];
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (index < items.length) {
        const i = index++;
        results[i] = await fn(items[i], i);
      }
    }),
  );
  return results;
}

// ==================== 1-bosqich: o'yinchilar ====================

async function ensurePlayers(admin) {
  const existing = await api('/players');
  log(`Bazada ${existing.length} ta faol o'yinchi bor`);

  const plan = [];
  for (const band of AGE_BANDS) {
    for (const gender of GENDERS) {
      for (let i = 0; i < PER_GROUP; i++) {
        const age = band.minAge + Math.floor(rnd() * (band.maxAge - band.minAge + 1));
        const birthYear = YEAR - age;
        const month = 1 + Math.floor(rnd() * 12);
        const day = 1 + Math.floor(rnd() * 28);
        const first = pick(gender.code === 'MALE' ? MALE_NAMES : FEMALE_NAMES);
        const base = pick(SURNAMES);
        const last = gender.code === 'FEMALE' ? `${base}a` : base;
        plan.push({
          firstName: first,
          lastName: last,
          gender: gender.code,
          region: pick(REGIONS),
          club: `${pick(REGIONS)} STT klubi`,
          birthDate: `${birthYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          // Litsenziya raqami unique — har yugurishda o'ziga xos bo'lishi kerak
          licenseNumber: `UZ-${YEAR}-${RUN_ID}-${band.code}-${gender.code[0]}${String(i + 1).padStart(2, '0')}`,
          band: band.code,
          bandGender: gender.code,
        });
      }
    }
  }

  log(`${plan.length} ta yangi o'yinchi yaratilmoqda...`);
  const created = await pool(plan, 8, async (p) => {
    const { band, bandGender, ...dto } = p;
    const player = await api('/players', { method: 'POST', body: dto, cookie: admin });
    // Seedlash uchun boshlang'ich reyting balli (kuchlar farqlansin)
    const points = 100 + Math.floor(rnd() * 900);
    await api(`/rankings/players/${player.id}/adjust`, {
      method: 'POST',
      cookie: admin,
      body: { delta: points, note: `Simulyatsiya: boshlang'ich reyting (${band})` },
    });
    return { ...player, band, bandGender, rankingPoints: points };
  });

  const total = (await api('/players')).length;
  log(`Yaratildi: ${created.length} ta · bazadagi jami: ${total} ta o'yinchi`);
  return created;
}

// ==================== 2-3-bosqich: turnir va guruhlar ====================

async function createTournament(admin) {
  const name = `O'zbekiston chempionati ${YEAR}`;
  const tournament = await api('/tournaments', {
    method: 'POST',
    cookie: admin,
    body: {
      name,
      levelCode: 'NATIONAL',
      city: 'Toshkent',
      venue: 'Universal sport majmuasi',
      startDate: `${YEAR}-09-15`,
      endDate: `${YEAR}-09-20`,
    },
  });
  log(`Musobaqa ochildi: ${tournament.name} (/${tournament.slug})`);

  const groups = [];
  for (const band of AGE_BANDS) {
    for (const gender of GENDERS) {
      const category = await api('/draws/categories', {
        method: 'POST',
        cookie: admin,
        body: {
          tournamentId: tournament.id,
          ageCategoryCode: band.code,
          gender: gender.code,
          eventType: 'SINGLES',
          maxEntries: 32,
          registrationDeadline: `${YEAR}-09-10T00:00:00.000Z`,
        },
      });
      groups.push({ ...category, band, gender, label: `${band.label} ${gender.label}` });
    }
  }
  log(`${groups.length} ta guruh ochildi: ${AGE_BANDS.map((b) => b.label).join(', ')} × erkak/ayol`);
  return { tournament, groups };
}

// ==================== 4-bosqich: arizalar ====================

async function registerPlayers(admin, groups, players) {
  let count = 0;
  for (const group of groups) {
    const candidates = players.filter(
      (p) => p.band === group.band.code && p.bandGender === group.gender.code,
    );
    for (const player of candidates) {
      await api(`/registration/categories/${group.id}/participants`, {
        method: 'POST',
        cookie: admin,
        body: { playerId: player.id },
      });
      count++;
    }
    log(`  ${group.label}: ${candidates.length} ishtirokchi yozildi`);
  }
  log(`Jami ${count} ta ariza (hammasi CONFIRMED — operator qo'shgan)`);
}

// ==================== 5-bosqich: qura ====================

async function runDraws(admin, groups) {
  let table = 1;
  const brackets = [];
  for (const group of groups) {
    const bracket = await api('/draws/generate', {
      method: 'POST',
      cookie: admin,
      body: { tournamentCategoryId: group.id },
    });
    brackets.push({ group, bracket });

    // Birinchi raund o'yinlariga stol raqami — zal monitorlari uchun
    const firstRound = bracket.rounds?.[0]?.matches ?? [];
    for (const m of firstRound) {
      await api(`/matches/${m.id}`, {
        method: 'PUT',
        cookie: admin,
        body: { tableNumber: ((table - 1) % 16) + 1 },
      });
      table++;
    }
    const total = (bracket.rounds ?? []).reduce((s, r) => s + r.matches.length, 0);
    log(`  ${group.label}: setka ${bracket.size} kishilik, ${total} o'yin`);
  }
  return brackets;
}

// ==================== 6-bosqich: o'yinlarni o'ynash ====================

/** Bitta o'yin: kod olish → hakam tasdiqlashi → yakungacha ochkolar */
async function playMatch(admin, referee, matchId, strength) {
  const initial = await api(`/matches/${matchId}`);
  // Walkover (bye) o'yinlari yaratilishdayoq yakunlangan — ularga tegmaymiz
  if (initial.status === 'FINISHED') return { state: initial, points: 0 };
  if (!initial.player1?.id || !initial.player2?.id) {
    return { state: initial, points: 0, skipped: true };
  }

  const { refereeCode } = await api(`/matches/${matchId}/regenerate-code`, {
    method: 'POST',
    cookie: admin,
  });
  await api(`/matches/${matchId}/verify`, {
    method: 'POST',
    cookie: referee,
    body: { code: refereeCode },
  });

  let state = initial;
  const p1 = state.player1?.id;
  const p2 = state.player2?.id;
  // Kuchli o'yinchi ko'proq ochko oladi, lekin natija oldindan aniq emas
  const s1 = strength.get(p1) ?? 300;
  const s2 = strength.get(p2) ?? 300;
  const chance = s1 / (s1 + s2);

  let points = 0;
  while (state.status !== 'FINISHED' && points < 400) {
    const player = rnd() < chance ? 1 : 2;
    state = await api(`/matches/${matchId}/point`, {
      method: 'POST',
      cookie: referee,
      body: { player },
    });
    points++;
  }
  return { state, points };
}

async function playTournament(admin, referee, brackets, strength) {
  let played = 0;
  let totalPoints = 0;
  const maxRounds = Math.max(...brackets.map((b) => b.bracket.rounds.length));

  // Raundma-raund: keyingi raund ishtirokchisi oldingi raund g'olibidan keladi
  for (let round = 0; round < maxRounds; round++) {
    const jobs = [];
    for (const { group, bracket } of brackets) {
      const r = bracket.rounds[round];
      if (!r) continue;
      for (const m of r.matches) jobs.push({ group, matchId: m.id, stage: r.stage });
    }
    if (jobs.length === 0) continue;

    const results = await pool(jobs, 10, async (job) => {
      const r = await playMatch(admin, referee, job.matchId, strength);
      return { ...job, ...r };
    });

    played += results.filter((r) => r.points > 0).length;
    totalPoints += results.reduce((s, r) => s + r.points, 0);
    const stage = results[0]?.stage ?? `${round + 1}-raund`;
    log(`  ${round + 1}-raund (${stage}): ${results.length} o'yin o'ynaldi`);
  }
  return { played, totalPoints };
}

// ==================== 7-bosqich: yakunlash va hisobot ====================

async function finishTournament(admin, tournament, brackets) {
  await api(`/tournaments/${tournament.id}`, {
    method: 'PUT',
    cookie: admin,
    body: { status: 'FINISHED' },
  });

  console.log('\n════════ NATIJALAR ════════');
  for (const { group, bracket } of brackets) {
    const fresh = await api(`/draws/${bracket.id}`);
    const final = fresh.rounds.at(-1)?.matches?.[0];
    const champion =
      final?.winnerId === final?.player1?.id ? final?.player1 : final?.player2;
    const runnerUp =
      final?.winnerId === final?.player1?.id ? final?.player2 : final?.player1;
    console.log(
      `${group.label.padEnd(20)} 🏆 ${champion ? `${champion.lastName} ${champion.firstName}` : '—'}` +
        `${runnerUp ? `   (2-o'rin: ${runnerUp.lastName} ${runnerUp.firstName})` : ''}`,
    );
  }
}

// ==================== oqim ====================

log('Kirish...');
const admin = await login(ADMIN);
const referee = await login(REFEREE);

log('1-bosqich: o‘yinchilar');
const players = await ensurePlayers(admin);
const strength = new Map(players.map((p) => [p.id, p.rankingPoints]));

log('2-bosqich: musobaqa va guruhlar');
const { tournament, groups } = await createTournament(admin);

log('3-bosqich: arizalar');
await registerPlayers(admin, groups, players);

log('4-bosqich: qura');
const brackets = await runDraws(admin, groups);

log('5-bosqich: musobaqa boshlandi');
await api(`/tournaments/${tournament.id}`, {
  method: 'PUT',
  cookie: admin,
  body: { status: 'LIVE' },
});
const { played, totalPoints } = await playTournament(admin, referee, brackets, strength);
log(`${played} ta o'yin, ${totalPoints} ta ochko kiritildi`);

log('6-bosqich: yakunlash');
await finishTournament(admin, tournament, brackets);

const ranking = await api('/rankings?gender=MALE');
const rankingF = await api('/rankings?gender=FEMALE');
console.log('\n════════ REYTING (top-5) ════════');
console.log('Erkaklar:');
ranking.slice(0, 5).forEach((r) =>
  console.log(`  ${String(r.rank).padStart(2)}. ${r.lastName} ${r.firstName} — ${r.rankingPoints}`),
);
console.log('Ayollar:');
rankingF.slice(0, 5).forEach((r) =>
  console.log(`  ${String(r.rank).padStart(2)}. ${r.lastName} ${r.firstName} — ${r.rankingPoints}`),
);

console.log(`\nMusobaqa sahifasi: ${ORIGIN}/musobaqalar/${tournament.slug}`);
log('Simulyatsiya tugadi');
