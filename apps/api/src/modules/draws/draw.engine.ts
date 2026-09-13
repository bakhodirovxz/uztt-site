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
