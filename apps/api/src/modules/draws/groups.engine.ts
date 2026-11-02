/**
 * Guruh bosqichi (doira tizimi) — sof funksiyalar.
 * Manba: musobaqa qoidalari 4.2 (hisoblash), 4.7.2 (zmeyka bilan taqsimlash), 4.7.3 (guruhdan setkaga),
 * 27-ilova (hisoblash misollari), 11-ilova (o'yin navbati).
 */
import { drawSize, meetingRound, byePositions } from './draw.engine';

// ====================== 1) ZMEYKA BILAN TAQSIMLASH (4.7.2) ======================

export interface GroupPlayer {
  playerId: string;
  rating: number;
  org?: string | null;
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Zmeyka: 1-qator chapdan o'ngga (1-guruh → oxirgi), 2-qator o'ngdan chapga, 3-qator yana chapdan o'ngga.
 * `modified` — "o'zgartirilgan zmeyka": 1-qatordan keyin har qator reyting bo'yicha kichik
 * kichik bo'laklarga (guruhlar soni / 2) bo'linadi va har bo'lak ichida jereb tashlanadi.
 * Tashkilot (viloyat) bo'yicha: bir tashkilotning o'yinchilari soni guruhlar sonidan kam bo'lsa, ular
 * turli guruhlarga tushadi (4.7.2.5–6: bu zmeykadan ustun).
 * Natija: groups[g] — g-guruhdagi o'yinchilar (qator tartibida).
 */
export function snakeDraw(
  players: GroupPlayer[],
  groupCount: number,
  opts: { modified?: boolean; rng?: () => number } = {},
): GroupPlayer[][] {
  const rng = opts.rng ?? Math.random;
  const G = Math.max(1, Math.floor(groupCount));
  const sorted = [...players].sort((a, b) => b.rating - a.rating);
  const groups: GroupPlayer[][] = Array.from({ length: G }, () => []);
  const orgSize = new Map<string, number>();
  for (const p of sorted) {
    const o = p.org?.trim();
    if (o) orgSize.set(o, (orgSize.get(o) ?? 0) + 1);
  }
  const hasOrg = (g: number, org: string) => groups[g].some((x) => x.org?.trim() === org);

  const rows = Math.ceil(sorted.length / G);
  for (let r = 0; r < rows; r++) {
    const row = sorted.slice(r * G, r * G + G);
    // shu qatorda guruhlarning zmeyka tartibi
    const base = Array.from({ length: G }, (_, i) => i);
    const order = r % 2 === 0 ? base : [...base].reverse();
    const used = order.slice(0, row.length); // oxirgi to'lmagan qatorda faqat bir qism guruh

    // o'zgartirilgan zmeyka: 2-qatordan boshlab bo'laklar ichida jereb
    let assignment: number[] = [];
    if (opts.modified && r > 0 && G >= 4) {
      const chunk = Math.ceil(G / 2);
      for (let i = 0; i < row.length; i += chunk) {
        const slotChunk = shuffle(used.slice(i, i + chunk), rng);
        assignment.push(...slotChunk);
      }
    } else {
      assignment = used;
    }

    const remaining = new Set(assignment);
    row.forEach((p, i) => {
      const org = p.org?.trim();
      const small = org && (orgSize.get(org) ?? 0) < G;
      let g = assignment[i];
      if (!remaining.has(g)) g = [...remaining][0];
      if (small && hasOrg(g, org!)) {
        // eng yaqin (keyingi/oldingi) guruh, shu tashkilot yo'q, shu qatorda bo'sh
        const cands = [...remaining]
          .filter((x) => !hasOrg(x, org!))
          .sort((a, b) => Math.abs(a - g) - Math.abs(b - g) || b - a);
        if (cands.length) g = cands[0];
      }
      remaining.delete(g);
      groups[g].push(p);
    });
  }
  return groups;
}

// ====================== 2) DOIRA JADVALI (Berger, 11-ilova) ======================

/** Doira tizimi turlari: har tur — [a, b] juftliklari (1-indeks). Toq n da bo'sh o'tadigan (0) tushiriladi. */
export function roundRobinRounds(n: number): Array<Array<[number, number]>> {
  if (n < 2) return [];
  const m = n % 2 === 0 ? n : n + 1; // toq bo'lsa "dam olish" uchun qo'shimcha
  const arr = Array.from({ length: m }, (_, i) => i + 1);
  const rounds: Array<Array<[number, number]>> = [];
  for (let r = 0; r < m - 1; r++) {
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < m / 2; i++) {
      const a = arr[i];
      const b = arr[m - 1 - i];
      if (a <= n && b <= n) pairs.push(a < b ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    // aylantirish: 1-raqam joyida, qolganlar soat yo'nalishida
    arr.splice(1, 0, arr.pop()!);
  }
  return rounds;
}

/** N(N−1)/2 (4.5.4.6) */
export function roundRobinMatchCount(n: number): number {
  return (n * (n - 1)) / 2;
}

// ====================== 3) NATIJALARNI HISOBLASH (4.2, 27-ilova) ======================

export interface GroupMatchResult {
  a: string;
  b: string;
  /** PLAYED — to'liq o'ynalgan; FORFEIT — biri kelmadi yoki tugatmadi (g'olib belgilangan); NONE — o'ynalmagan */
  kind: 'PLAYED' | 'FORFEIT' | 'NONE';
  winner?: string | null;
  /** To'liq o'ynalgan setlar (a va b nuqtai nazaridan) */
  sets?: Array<{ a: number; b: number }>;
  /** Boshlangan, tugallanmagan set (FORFEIT da) */
  partial?: { a: number; b: number } | null;
  bestOf?: number;
}

export interface Standing {
  playerId: string;
  place: number;
  points: number;
  played: number;
  won: number;
  lost: number;
  setsWon: number;
  setsLost: number;
  pointsWon: number;
  pointsLost: number;
  /** Teng ko'rsatkichda faqat jereb hal qiladi (4.2.4) */
  lot: boolean;
  /** 4.2.6: o'yinlarining yarmidan kami o'ynagan — natijalari bekor */
  annulled: boolean;
}

interface Norm {
  a: string;
  b: string;
  pa: number; // a ning match ochkosi (2/1/0)
  pb: number;
  sa: number; // setlar
  sb: number;
  ra: number; // rally ochkolari
  rb: number;
}

/** 4.2.7: o'ynalmagan/tugallanmagan uchrashuv uchun setlar va ochkolar */
function normalize(m: GroupMatchResult, annulled: Set<string>): Norm | null {
  if (annulled.has(m.a) || annulled.has(m.b)) return null; // 4.2.6: bekor qilinganlar bilan o'yinlar hisobdan chiqadi
  const need = Math.ceil((m.bestOf ?? 5) / 2);
  if (m.kind === 'NONE' || !m.winner) {
    return { a: m.a, b: m.b, pa: 0, pb: 0, sa: 0, sb: 0, ra: 0, rb: 0 };
  }
  const sets = m.sets ?? [];
  if (m.kind === 'PLAYED') {
    let sa = 0, sb = 0, ra = 0, rb = 0;
    for (const s of sets) {
      if (s.a > s.b) sa++; else sb++;
      ra += s.a;
      rb += s.b;
    }
    const aWon = m.winner === m.a;
    return { a: m.a, b: m.b, pa: aWon ? 2 : 1, pb: aWon ? 1 : 2, sa, sb, ra, rb };
  }
  // FORFEIT: g'olibga 2 ochko, yutqazgan (kelmagan/tugatmagan) 0
  const aWon = m.winner === m.a;
  let sa = 0, sb = 0, ra = 0, rb = 0;
  for (const s of sets) {
    if (s.a > s.b) sa++; else sb++;
    ra += s.a;
    rb += s.b;
  }
  if (m.partial && (m.partial.a > 0 || m.partial.b > 0)) {
    // boshlangan setda: yutqazgan o'z ochkolarini saqlaydi, g'olibga set yutishga yetarlisi beriladi
    const loserPts = aWon ? m.partial.b : m.partial.a;
    const winPts = Math.max(11, loserPts + 2);
    if (aWon) { ra += winPts; rb += loserPts; sa++; } else { rb += winPts; ra += loserPts; sb++; }
  }
  // g'olib kerakli setlargacha qolgan setlarni 11:0 bilan oladi
  let winSets = aWon ? sa : sb;
  while (winSets < need) {
    if (aWon) { sa++; ra += 11; } else { sb++; rb += 11; }
    winSets++;
  }
  return { a: m.a, b: m.b, pa: aWon ? 2 : 0, pb: aWon ? 0 : 2, sa, sb, ra, rb };
}

type Frac = [number, number]; // [yutgan, yutqazgan]
/** Kasrlarni solishtirish: katta qiymat — yaxshiroq (0 maxraj = cheksiz) */
function cmpFrac(x: Frac, y: Frac): number {
  const [xn, xd] = x;
  const [yn, yd] = y;
  if (xd === 0 && yd === 0) return Math.sign(xn - yn);
  if (xd === 0) return xn > 0 ? 1 : -1;
  if (yd === 0) return yn > 0 ? -1 : 1;
  return Math.sign(xn * yd - yn * xd);
}

/** Bir nechta o'yinchi tengligini faqat o'zaro o'yinlar bo'yicha ketma-ket hal qilish (4.2.2–4.2.4) */
function resolveTied(ids: string[], matches: Norm[], rng: () => number): Array<{ id: string; lot: boolean }> {
  if (ids.length === 1) return [{ id: ids[0], lot: false }];
  const set = new Set(ids);
  const mutual = matches.filter((m) => set.has(m.a) && set.has(m.b));
  const metric = (kind: 'points' | 'sets' | 'rally'): Map<string, Frac> => {
    const out = new Map<string, Frac>(ids.map((i) => [i, [0, 0]]));
    for (const m of mutual) {
      const add = (id: string, w: number, l: number) => {
        const f = out.get(id)!;
        f[0] += w;
        f[1] += l;
      };
      if (kind === 'points') { add(m.a, m.pa, 0); add(m.b, m.pb, 0); }
      else if (kind === 'sets') { add(m.a, m.sa, m.sb); add(m.b, m.sb, m.sa); }
      else { add(m.a, m.ra, m.rb); add(m.b, m.rb, m.ra); }
    }
    return out;
  };
  for (const kind of ['points', 'sets', 'rally'] as const) {
    const mt = metric(kind);
    const cmp = (x: string, y: string) =>
      kind === 'points' ? mt.get(y)![0] - mt.get(x)![0] : -cmpFrac(mt.get(x)!, mt.get(y)!);
    const sorted = [...ids].sort(cmp);
    // sinflarga bo'lish
    const classes: string[][] = [];
    for (const id of sorted) {
      const last = classes[classes.length - 1];
      if (last && cmp(last[0], id) === 0) last.push(id);
      else classes.push([id]);
    }
    if (classes.length > 1) {
      // 4.2.3: joylari aniqlanganlar hisobdan chiqadi, qolgan teng sinflar yangidan hal qilinadi
      return classes.flatMap((c) => resolveTied(c, matches, rng));
    }
  }
  // 4.2.4: jereb
  return shuffle([...ids], rng).map((id) => ({ id, lot: true }));
}

/**
 * Guruh jadvali (4.2.1 – 4.2.7). `playerIds` — guruh a'zolari, `results` — barcha uchrashuvlar
 * (o'ynalmaganlari ham: kind 'NONE'). `rng` faqat jereb uchun.
 */
export function groupStandings(
  playerIds: string[],
  results: GroupMatchResult[],
  rng: () => number = Math.random,
  opts: { final?: boolean } = {},
): Standing[] {
  const n = playerIds.length;
  const total = n - 1; // har bir o'yinchining uchrashuvlari soni
  // 4.2.6: to'liq o'ynagan uchrashuvlari 50% dan kam bo'lsa — natijalari bekor (faqat yakuniy hisobda)
  const annulled = new Set<string>();
  if (opts.final) {
    for (const id of playerIds) {
      const done = results.filter((m) => (m.a === id || m.b === id) && m.kind === 'PLAYED').length;
      if (total > 0 && done < total / 2) annulled.add(id);
    }
  }
  const norms = results.map((m) => normalize(m, annulled)).filter((x): x is Norm => x !== null);

  const stat = new Map<string, Standing>();
  for (const id of playerIds) {
    stat.set(id, {
      playerId: id, place: 0, points: 0, played: 0, won: 0, lost: 0,
      setsWon: 0, setsLost: 0, pointsWon: 0, pointsLost: 0, lot: false,
      annulled: annulled.has(id),
    });
  }
  for (const m of norms) {
    const A = stat.get(m.a);
    const B = stat.get(m.b);
    if (!A || !B) continue;
    A.points += m.pa; B.points += m.pb;
    A.setsWon += m.sa; A.setsLost += m.sb; B.setsWon += m.sb; B.setsLost += m.sa;
    A.pointsWon += m.ra; A.pointsLost += m.rb; B.pointsWon += m.rb; B.pointsLost += m.ra;
    if (m.pa + m.pb > 0) {
      A.played++; B.played++;
      if (m.pa > m.pb) { A.won++; B.lost++; } else { B.won++; A.lost++; }
    }
  }

  // 4.2.1: umumiy ochko bo'yicha; tenglar — faqat o'zaro o'yinlar bo'yicha
  const active = playerIds.filter((id) => !annulled.has(id));
  const byPoints = [...active].sort((x, y) => stat.get(y)!.points - stat.get(x)!.points);
  const blocks: string[][] = [];
  for (const id of byPoints) {
    const last = blocks[blocks.length - 1];
    if (last && stat.get(last[0])!.points === stat.get(id)!.points) last.push(id);
    else blocks.push([id]);
  }
  const ordered: Array<{ id: string; lot: boolean }> = blocks.flatMap((b) => resolveTied(b, norms, rng));
  // bekor qilinganlar eng oxirida (natijasiz)
  for (const id of playerIds) if (annulled.has(id)) ordered.push({ id, lot: false });
  return ordered.map((o, i) => {
    const s = stat.get(o.id)!;
    s.place = i + 1;
    s.lot = o.lot;
    return s;
  });
}

// ====================== 4) GURUHDAN SETKAGA (4.7.3) ======================

export interface Qualifier {
  playerId: string;
  group: number; // 1-indeks
  place: number; // guruhdagi o'rni (1 = g'olib)
  org?: string | null;
}

/** 2 ning darajasiga yuqoriga */
function pow2up(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Bo'lak k ning joyi (0-indeks): toq bo'lak (k juft indeks) — pastki; aks holda tepa. `flip` — teskari */
function partPos(size: number, parts: number, k: number, flip = false): number {
  const bottom = flip ? k % 2 === 1 : k % 2 === 0;
  return bottom ? ((k + 1) * size) / parts - 1 : (k * size) / parts;
}

/**
 * Guruhdan chiqqanlarni setkaga joylash (4.7.3). Natija: joy (0-indeks) → o'yinchi; BYE — bo'sh joylar (28-ilova).
 * - 1-guruh g'olibi — tepada, 2-guruh g'olibi — pastda; 3–4, 5–8, 9–16, 17–32-guruh g'oliblari o'z joylari orasida jereb;
 * - 2-o'rindagilar g'olibning qarama-qarshi yarmiga (guruhlar soniga mos bo'laklar), 3–4-o'rindagilar mos qoidalar bilan;
 * - bir tashkilot imkon qadar uzoqroq (4.7.3.5) — yuqoridagilar ustun.
 */
export function placeQualifiers(
  qualifiers: Qualifier[],
  groupCount: number,
  rng: () => number = Math.random,
): Array<string | null> {
  const n = qualifiers.length;
  const size = drawSize(n);
  const out: Array<string | null> = new Array(size).fill(null);
  const byes = new Set(byePositions(size, size - n));
  const taken = new Set<number>();
  const posOf = new Map<string, number>();
  const put = (pos: number, q: Qualifier) => {
    out[pos] = q.playerId;
    taken.add(pos);
    posOf.set(q.playerId, pos);
  };
  const winners = qualifiers.filter((q) => q.place === 1).sort((a, b) => a.group - b.group);

  // g'oliblar
  const GROUPS: Array<[number, number, number]> = [[3, 4, 2], [5, 8, 4], [9, 16, 8], [17, 32, 16]];
  winners.forEach((q) => {
    if (q.group === 1) put(0, q);
    else if (q.group === 2) put(size - 1, q);
  });
  for (const [lo, hi, parts] of GROUPS) {
    const gs = winners.filter((q) => q.group >= lo && q.group <= hi);
    if (!gs.length) continue;
    const positions = shuffle(
      Array.from({ length: parts }, (_, k) => partPos(size, parts, k)).filter((p) => !taken.has(p)),
      rng,
    );
    gs.forEach((q, i) => put(positions[i], q));
  }

  // keyingi o'rindagilar: o'rin 2 — g'olibning qarama-qarshi yarmiga
  const G = pow2up(Math.max(2, groupCount));
  const half = (p: number) => (p < size / 2 ? 0 : 1);
  const quarter = (p: number) => Math.floor(p / (size / 4));
  for (const place of [2, 3, 4]) {
    const qs = qualifiers.filter((q) => q.place === place);
    if (!qs.length) continue;
    // 4.7.3.2–4: bo'laklar soni: 2-o'rin: G (kamida 4), 3-o'rin: G (teskari), 4-o'rin: 2G (to'g'ri)
    const parts = Math.min(size, place === 4 ? Math.max(8, G * 2) : Math.max(4, G));
    const flip = place === 3;
    const candidates = Array.from({ length: parts }, (_, k) => partPos(size, parts, k, flip));
    for (const q of shuffle([...qs], rng)) {
      const w = winners.find((x) => x.group === q.group);
      const wp = w ? posOf.get(w.playerId) : undefined;
      const sameGroupPos = qualifiers
        .filter((x) => x.group === q.group && posOf.has(x.playerId))
        .map((x) => posOf.get(x.playerId)!);
      const sameOrgPos = q.org
        ? qualifiers.filter((x) => x.org && x.org === q.org && posOf.has(x.playerId)).map((x) => posOf.get(x.playerId)!)
        : [];
      let pool = [...candidates, ...Array.from({ length: size }, (_, i) => i)].filter(
        (p) => !taken.has(p) && !byes.has(p),
      );
      // ustuvorlik: 1) shu guruhdan boshqa o'yinchi bilan imkon qadar kech uchrashish va (2-o'rin) boshqa yarim;
      // 2) belgilangan joylar; 3) tashkilot
      const score = (p: number) => {
        let sc = 0;
        if (place === 2 && wp !== undefined && half(p) !== half(wp)) sc += 1000;
        if (place >= 3 && wp !== undefined && half(p) === half(wp)) sc += 200;
        if (place >= 3 && sameGroupPos.every((sp) => quarter(sp) !== quarter(p))) sc += 100;
        if (candidates.includes(p)) sc += 500;
        if (sameGroupPos.length) sc += 10 * Math.min(...sameGroupPos.map((sp) => meetingRound(p, sp)));
        if (sameOrgPos.length) sc += Math.min(...sameOrgPos.map((sp) => meetingRound(p, sp)));
        return sc;
      };
      const best = Math.max(...pool.map(score));
      pool = pool.filter((p) => score(p) === best);
      put(pool[Math.floor(rng() * pool.length)], q);
    }
  }
  // qolganlar (5+ o'rin) — bo'sh joylarga jereb
  const rest = qualifiers.filter((q) => !posOf.has(q.playerId));
  const free = shuffle(Array.from({ length: size }, (_, i) => i).filter((p) => !taken.has(p) && !byes.has(p)), rng);
  rest.forEach((q, i) => put(free[i], q));
  return out;
}
