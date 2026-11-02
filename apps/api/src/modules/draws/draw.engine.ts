/**
 * Turnir setkasi dvigateli — pure funksiyalar (I/O yo'q, to'liq testlanadi).
 *
 * Standart seeding: 1-seed va 2-seed faqat finalda uchrashadi,
 * 1 va 4 yarim finalda, va h.k. Bye'lar kuchli seedlarga beriladi
 * (to'ldirilmagan joylar seeding tartibida oxirgi raqamlarga to'g'ri keladi).
 */

export interface DrawPlayer {
  playerId: string;
  rankingPoints: number;
}

export interface DrawSlot {
  position: number; // 1..size
  seed: number | null; // 1..k (bye uchun null)
  playerId: string | null; // null = bye
}

export interface PlannedMatch {
  roundNumber: number; // 1 = birinchi raund
  bracketPosition: number; // raund ichidagi tartib (1..)
  player1Id: string | null;
  player2Id: string | null;
  /** Keyingi raunddagi o'yin (roundNumber+1, ceil(pos/2)) va slot (1|2) */
  nextBracketPosition: number | null;
  nextSlot: 1 | 2 | null;
  /** Bye tufayli o'yin o'tkazilmaydi — g'olib avtomatik keyingi raundga */
  walkoverWinnerId: string | null;
}

/** count o'yinchi uchun setka o'lchami: keyingi 2 ning darajasi (min 2) */
export function drawSize(count: number): number {
  let size = 2;
  while (size < count) size *= 2;
  return size;
}

/**
 * Klassik seeding tartibi: pozitsiya i (0-index) qaysi seedni oladi.
 * n=2 → [1,2]; n=4 → [1,4,2,3]; n=8 → [1,8,4,5,2,7,3,6] ...
 */
export function seedOrder(n: number): number[] {
  if (n === 1) return [1];
  const prev = seedOrder(n / 2);
  const out: number[] = [];
  for (const s of prev) {
    out.push(s, n + 1 - s);
  }
  return out;
}

/** O'yinchilarni (reyting bo'yicha kamayish tartibida) setka joylariga qo'yish */
export function placePlayers(players: DrawPlayer[]): DrawSlot[] {
  const sorted = [...players].sort((a, b) => b.rankingPoints - a.rankingPoints);
  const size = drawSize(sorted.length);
  const order = seedOrder(size);
  return order.map((seed, i) => ({
    position: i + 1,
    seed: seed <= sorted.length ? seed : null,
    playerId: seed <= sorted.length ? sorted[seed - 1].playerId : null,
  }));
}

/**
 * To'liq raundlar rejasi: barcha raundlar uchun o'yinlar, bye'larda
 * o'yinchi darhol keyingi raund slotiga yoziladi (walkover).
 */
export function planMatches(slots: DrawSlot[]): PlannedMatch[] {
  const size = slots.length;
  const totalRounds = Math.log2(size);
  const matches: PlannedMatch[] = [];

  // Raund bo'yicha slot egalari: 1-raund uchun setka joylashuvidan
  let current: Array<string | null> = slots.map((s) => s.playerId);

  for (let round = 1; round <= totalRounds; round++) {
    const matchCount = current.length / 2;
    const next: Array<string | null> = new Array<string | null>(
      matchCount,
    ).fill(null);

    for (let pos = 1; pos <= matchCount; pos++) {
      const p1 = current[(pos - 1) * 2];
      const p2 = current[(pos - 1) * 2 + 1];
      const isLast = round === totalRounds;

      // Walkover (bye) FAQAT 1-raundda: keyingi raundlarda null slot
      // "g'olib hali aniqlanmagan" degani, bye emas.
      let walkover: string | null = null;
      if (round === 1) {
        if (p1 !== null && p2 === null) walkover = p1;
        if (p2 !== null && p1 === null) walkover = p2;
      }

      matches.push({
        roundNumber: round,
        bracketPosition: pos,
        player1Id: p1,
        player2Id: p2,
        nextBracketPosition: isLast ? null : Math.ceil(pos / 2),
        nextSlot: isLast ? null : pos % 2 === 1 ? 1 : 2,
        walkoverWinnerId: walkover,
      });

      // Walkover g'olibi keyingi raundga darhol o'tadi
      if (walkover) next[pos - 1] = walkover;
    }
    current = next;
  }

  return matches;
}

/** Bosqich nomi: raund raqami va umumiy raundlar sonidan (StagePoints bilan mos) */
export function stageForRound(
  roundNumber: number,
  totalRounds: number,
):
  | 'FINAL'
  | 'SEMIFINAL'
  | 'QUARTERFINAL'
  | 'ROUND_OF_16'
  | 'ROUND_OF_32'
  | 'ROUND_1' {
  const fromEnd = totalRounds - roundNumber; // 0 = final
  if (fromEnd === 0) return 'FINAL';
  if (fromEnd === 1) return 'SEMIFINAL';
  if (fromEnd === 2) return 'QUARTERFINAL';
  if (fromEnd === 3) return 'ROUND_OF_16';
  if (fromEnd === 4) return 'ROUND_OF_32';
  return 'ROUND_1';
}

// ====================== QURA (JEREBYOVKA) — qoidalar bo'yicha ======================
// Qoidalar (3.6): 1-seed setkaning tepasiga, 2-seed pastki yarmining pastiga; 3–4, 5–8,
// 9–16, 17–32-seedlar o'z guruhlarining joylari orasida JEREB bilan; qolganlar jereb bilan;
// bo'sh joylar (BYE) kuchli seedlar qarshisida; bir viloyat/klub o'yinchilari imkon
// qadar kech uchrashadigan qilib ajratiladi (3.6.3).

export interface RuleDrawPlayer extends DrawPlayer {
  /** Tashkilot (viloyat/klub) — bir tashkilot o'yinchilari ajratiladi */
  org?: string | null;
}

/** Seedlar soni: setka/4 (kamida 2), eng ko'pi 32 va o'yinchilar sonidan oshmaydi */
export function defaultSeedCount(playerCount: number): number {
  const size = drawSize(playerCount);
  return Math.min(playerCount, Math.min(32, Math.max(2, size / 4)));
}

/** Ikki joy (0-indeks) qaysi raundda uchrashadi: katta qiymat — kechroq (yaxshiroq) */
export function meetingRound(i: number, j: number): number {
  let r = 0;
  while (Math.floor(i / 2 ** r) !== Math.floor(j / 2 ** r)) r++;
  return r;
}

function shuffleInPlace<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Seed guruhlari: [pastki raqam, yuqori raqam, setka bo'laklari soni] (3.6.2.3.x) */
const SEED_GROUPS: Array<[number, number, number]> = [
  [3, 4, 2], // yarimlar chegarasi
  [5, 8, 4], // choraklar chegarasi
  [9, 16, 8], // sakkizdan birlar
  [17, 32, 16], // o'n oltidan birlar
];

/**
 * 28-ilova ("Свободные места в сетке"): bo'sh joylar (BYE) o'rni QAT'IY — jadvaldagi tartib
 * bo'yicha. Quyida har bir guruhda, ketma-ket raqamlar uchun bo'lak indeksi (k): toq bo'lakda
 * pastki joy, juft bo'lakda tepa joy. Masalan 16 lik setka: BYE o'rinlari 2, 15, 10, 7, 6, 11, 14.
 */
const BYE_ORDER: Record<number, number[]> = {
  2: [1, 0], // 3-, 4-raqam
  4: [1, 2, 3, 0], // 5…8
  8: [1, 6, 5, 2, 3, 4, 7, 0], // 9…16
  16: [1, 14, 9, 6, 5, 10, 13, 2, 3, 12, 11, 4, 7, 8, 15, 0], // 17…32
};

/**
 * Guruh joylari: har bo'lak uchun toq bo'lakda — PASTKI joy, juft bo'lakda — TEPA joy
 * ("pastki joylar toq choraklarda, tepa joylar juft choraklarda").
 */
export function groupPositions(size: number, parts: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < parts; k++) {
    out.push(k % 2 === 0 ? ((k + 1) * size) / parts - 1 : (k * size) / parts);
  }
  return out;
}

/** k-bo'lak joyi (0-indeks) */
function partPosition(size: number, parts: number, k: number): number {
  return k % 2 === 0 ? ((k + 1) * size) / parts - 1 : (k * size) / parts;
}

/**
 * BYE o'rinlari (0-indeks, 28-ilova jadvali bo'yicha). Setka 64 dan katta bo'lsa — yetmaganlari
 * klassik tartibda (seedOrder) to'ldiriladi.
 */
export function byePositions(size: number, byeCount: number): number[] {
  const out: number[] = [];
  const add = (seedPos: number) => out.push(seedPos ^ 1);
  if (byeCount >= 1) add(0); // 1-raqam: tepa
  if (byeCount >= 2) add(size - 1); // 2-raqam: past
  for (const [lo, hi, parts] of SEED_GROUPS) {
    const seq = BYE_ORDER[parts];
    for (let r = lo; r <= hi && out.length < byeCount; r++) {
      add(partPosition(size, parts, seq[r - lo]));
    }
  }
  if (out.length < byeCount) {
    const order = seedOrder(size);
    const have = new Set(out);
    for (let i = 0; i < size && out.length < byeCount; i++) {
      if (!have.has(i) && order[i] > size - byeCount) out.push(i);
    }
  }
  return out.slice(0, byeCount);
}

/**
 * Qoidalar bo'yicha qura. `rng` — [0,1) tasodifiy (testda urug'li beriladi).
 * Natija `placePlayers` bilan bir xil shaklda (DrawSlot[]): `planMatches` o'zgarishsiz ishlaydi.
 * `seed` faqat haqiqiy seedlarda (qolgan o'yinchilarda null), BYE — playerId null.
 */
export function drawByRules(
  players: RuleDrawPlayer[],
  opts: { seedCount?: number; rng?: () => number } = {},
): DrawSlot[] {
  const rng = opts.rng ?? Math.random;
  const sorted = [...players].sort(
    (a, b) => b.rankingPoints - a.rankingPoints,
  );
  const n = sorted.length;
  const size = drawSize(n);
  const byeCount = size - n;

  // Seedlar: kamida setka/4; har bir BYE seed qarshisida bo'lishi uchun to'liq guruh chegarasigacha
  let seedCount = Math.min(n, Math.max(1, opts.seedCount ?? defaultSeedCount(n)));
  if (byeCount > seedCount) {
    seedCount = Math.min(n, byeCount <= 2 ? 2 : byeCount <= 4 ? 4 : byeCount <= 8 ? 8 : byeCount <= 16 ? 16 : 32);
  }

  const slots: DrawSlot[] = Array.from({ length: size }, (_, i) => ({
    position: i + 1,
    seed: null,
    playerId: null,
  }));
  const byes = new Set(byePositions(size, byeCount));
  const taken = new Set<number>();
  const placed: Array<{ pos: number; org: string | null }> = [];
  const put = (idx: number, pos: number, seed: number | null) => {
    const p = sorted[idx];
    slots[pos] = { position: pos + 1, seed, playerId: p.playerId };
    taken.add(pos);
    placed.push({ pos, org: p.org?.trim() ? p.org.trim() : null });
  };

  // 1) 1-seed — tepada, 2-seed — pastda
  put(0, 0, 1);
  if (seedCount >= 2) put(1, size - 1, 2);

  // 2) 3–4, 5–8, 9–16, 17–32: o'z guruh joylari orasida jereb (BYE yonidagi joylar ham shu guruhda)
  for (const [lo, hi, parts] of SEED_GROUPS) {
    if (lo > seedCount) break;
    const positions = shuffleInPlace(groupPositions(size, parts), rng);
    for (let r = lo; r <= Math.min(hi, seedCount); r++) {
      put(r - 1, positions[r - lo], r);
    }
  }
  for (const b of byes) {
    if (taken.has(b)) return placePlayers(sorted); // g'ayritabiiy sozlama — klassik tartibga
  }

  // 3) Qolganlar — jereb + tashkilot bo'yicha ajratish
  const free = new Set<number>();
  for (let i = 0; i < size; i++) if (!taken.has(i) && !byes.has(i)) free.add(i);
  const orgSize = new Map<string, number>();
  for (const p of sorted) {
    const o = p.org?.trim();
    if (o) orgSize.set(o, (orgSize.get(o) ?? 0) + 1);
  }
  const rest = sorted
    .map((p, idx) => ({ p, idx }))
    .slice(seedCount)
    .sort((a, b) => {
      const sa = orgSize.get(a.p.org?.trim() ?? '') ?? 0;
      const sb = orgSize.get(b.p.org?.trim() ?? '') ?? 0;
      if (sb !== sa) return sb - sa; // katta tashkilotlar birinchi
      if (b.p.rankingPoints !== a.p.rankingPoints)
        return b.p.rankingPoints - a.p.rankingPoints; // tashkilot ichida kuchlisi birinchi
      return a.idx - b.idx;
    });

  for (const { p, idx } of rest) {
    const org = p.org?.trim() ? p.org.trim() : null;
    const sameOrg = org ? placed.filter((x) => x.org === org) : [];
    let best = -1;
    let candidates: number[] = [];
    for (const pos of free) {
      const score = sameOrg.length
        ? Math.min(...sameOrg.map((x) => meetingRound(pos, x.pos)))
        : 0;
      if (score > best) {
        best = score;
        candidates = [pos];
      } else if (score === best) {
        candidates.push(pos);
      }
    }
    const chosen = candidates[Math.floor(rng() * candidates.length)];
    free.delete(chosen);
    put(idx, chosen, null);
  }
  return slots;
}
