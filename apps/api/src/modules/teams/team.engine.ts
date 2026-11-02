/**
 * Jamoaviy o'yinlar (musobaqa qoidalari 4.3, 4.4, 4.7.1) — sof funksiyalar.
 * Harflar: uy jamoasi A, B, C, D; mehmon jamoasi X, Y, Z, W (A–X kabi).
 */

export type TeamSystem =
  | 'SWAYTHLING_MODIFIED' // 4.3.1 — 5 yakka (o'zgartirilgan Sveytling kubogi)
  | 'CORBILLON' // 4.3.2 — 4 yakka + 1 juft (Korbilon kubogi)
  | 'OLYMPIC' // 4.3.3 — 4 yakka + 1 juft (olimpiya tizimi)
  | 'EVANS' // 4.3.4 — 6 yakka + 1 juft (Evans kubogi)
  | 'SWAYTHLING_OLD' // 4.3.5 — 9 yakka (avvalgi Sveytling kubogi)
  | 'SWAYTHLING_MODERN'; // 4.3.6 — 5 yakka, almashtirish bilan (zamonaviy Sveytling)

export interface TeamSlot {
  kind: 'single' | 'double';
  /** Uy jamoasi harflari (juft uchun ikkita) */
  home: string[];
  away: string[];
}

export interface TeamSystemSpec {
  id: TeamSystem;
  totalMatches: 5 | 7 | 9;
  /** Jamoadagi o'yinchilar soni [min, max] */
  teamSize: [number, number];
  /** Matchda ishtirok etadigan o'yinchilar soni (minimal) */
  minPlaying: number;
}

export const TEAM_SYSTEMS: Record<TeamSystem, TeamSystemSpec> = {
  SWAYTHLING_MODIFIED: { id: 'SWAYTHLING_MODIFIED', totalMatches: 5, teamSize: [3, 5], minPlaying: 3 },
  CORBILLON: { id: 'CORBILLON', totalMatches: 5, teamSize: [2, 4], minPlaying: 2 },
  OLYMPIC: { id: 'OLYMPIC', totalMatches: 5, teamSize: [3, 5], minPlaying: 3 },
  EVANS: { id: 'EVANS', totalMatches: 7, teamSize: [3, 5], minPlaying: 3 },
  SWAYTHLING_OLD: { id: 'SWAYTHLING_OLD', totalMatches: 9, teamSize: [3, 5], minPlaying: 3 },
  SWAYTHLING_MODERN: { id: 'SWAYTHLING_MODERN', totalMatches: 5, teamSize: [3, 5], minPlaying: 3 },
};

const s = (home: string, away: string): TeamSlot => ({ kind: 'single', home: [home], away: [away] });
const SINGLES: Record<'SWAYTHLING_MODIFIED' | 'CORBILLON' | 'EVANS' | 'SWAYTHLING_OLD' | 'SWAYTHLING_MODERN', TeamSlot[]> = {
  // 4.3.1.2
  SWAYTHLING_MODIFIED: [s('A', 'X'), s('B', 'Y'), s('C', 'Z'), s('A', 'Y'), s('B', 'X')],
  // 4.3.2.2 — 3-o'yin juft (juftlik tarkibi hozircha belgilanmagan)
  CORBILLON: [s('A', 'X'), s('B', 'Y'), { kind: 'double', home: [], away: [] }, s('A', 'Y'), s('B', 'X')],
  // 4.3.4.2
  EVANS: [s('A', 'Y'), s('B', 'X'), s('C', 'Z'), { kind: 'double', home: [], away: [] }, s('A', 'X'), s('C', 'Y'), s('B', 'Z')],
  // 4.3.5.2
  SWAYTHLING_OLD: [s('A', 'X'), s('B', 'Y'), s('C', 'Z'), s('B', 'X'), s('A', 'Z'), s('C', 'Y'), s('B', 'Z'), s('C', 'X'), s('A', 'Y')],
  // 4.3.6.2 — 4–5-o'yinlarda D/W almashtirish mumkin (replace*)
  SWAYTHLING_MODERN: [s('A', 'Y'), s('B', 'X'), s('C', 'Z'), s('A', 'X'), s('B', 'Y')],
};

/**
 * Olimpiya tizimi (4.3.3): juftlikka A yoki B chiqadi (C bilan), raqib tomondan X yoki Y (Z bilan).
 * 4) juftlikda o'ynamagan A/B — Z ga qarshi; 5) C — juftlikda o'ynamagan X/Y ga qarshi.
 */
export function olympicOrder(homeDoublesPartner: 'A' | 'B', awayDoublesPartner: 'X' | 'Y'): TeamSlot[] {
  const homeOther = homeDoublesPartner === 'A' ? 'B' : 'A';
  const awayOther = awayDoublesPartner === 'X' ? 'Y' : 'X';
  return [
    s('A', 'X'),
    s('B', 'Y'),
    { kind: 'double', home: ['C', homeDoublesPartner], away: ['Z', awayDoublesPartner] },
    s(homeOther, 'Z'),
    s('C', awayOther),
  ];
}

/** Uchrashuvlar tartibi. Olimpiya uchun `opts` majburiy; Korbilon/Evans uchun juft tarkibi `doubles` bilan beriladi. */
export function teamMatchOrder(
  system: TeamSystem,
  opts: {
    olympic?: { home: 'A' | 'B'; away: 'X' | 'Y' };
    doubles?: { home: [string, string]; away: [string, string] };
  } = {},
): TeamSlot[] {
  if (system === 'OLYMPIC') {
    const o = opts.olympic;
    if (!o) throw new Error("Olimpiya tizimida juftlik tarkibi (home: A|B, away: X|Y) ko'rsatilishi shart");
    return olympicOrder(o.home, o.away);
  }
  const base = SINGLES[system].map((x) => ({ ...x, home: [...x.home], away: [...x.away] }));
  return base.map((slot) => {
    if (slot.kind !== 'double') return slot;
    if (!opts.doubles) throw new Error("Juft uchrashuv tarkibi ko'rsatilishi shart");
    return { kind: 'double', home: [...opts.doubles.home], away: [...opts.doubles.away] };
  });
}

/** Olimpiya tizimida har bir o'yinchi ko'pi bilan 2 ta shaxsiy uchrashuvda (juft ham hisobda) (4.3.3.1) */
export function olympicMaxTwoMatches(order: TeamSlot[]): boolean {
  const count = new Map<string, number>();
  for (const slot of order) for (const p of [...slot.home, ...slot.away]) count.set(p, (count.get(p) ?? 0) + 1);
  return [...count.values()].every((c) => c <= 2);
}

/** Jamoaviy matn g'olibi: uchrashuvlarning ko'pchiligini yutgan (4.4.5) */
export function teamMatchStatus(
  system: TeamSystem,
  homeWins: number,
  awayWins: number,
): { finished: boolean; winner: 'home' | 'away' | null; needed: number } {
  const total = TEAM_SYSTEMS[system].totalMatches;
  const needed = Math.floor(total / 2) + 1;
  if (homeWins >= needed) return { finished: true, winner: 'home', needed };
  if (awayWins >= needed) return { finished: true, winner: 'away', needed };
  return { finished: false, winner: null, needed };
}

/** Jamoa tarkibi talablari (4.3.x.1) */
export function validateTeamSize(system: TeamSystem, size: number): boolean {
  const [min, max] = TEAM_SYSTEMS[system].teamSize;
  return size >= min && size <= max;
}

/**
 * Jamoa reytingi (4.7.1.2): jamoa a'zolaridan o'yinda ishtirok etishi uchun minimal soni
 * (tizimga qarab) eng kuchli o'yinchilarning reyting yig'indisi.
 */
export function teamRating(system: TeamSystem, playerRatings: number[]): number {
  const k = TEAM_SYSTEMS[system].minPlaying;
  return [...playerRatings].sort((a, b) => b - a).slice(0, k).reduce((a, b) => a + b, 0);
}

/** Juft reytingi: ikkala sherik reytinglari yig'indisi (4.7.1.3) */
export function pairRating(r1: number, r2: number): number {
  return r1 + r2;
}

/** Jamoa va juftlik tashkilotini aniqlash: juft — reytingi yuqori o'yinchining tashkiloti (3.6.3.6), aralash — erkak (3.6.3.7) */
export function pairOrg(
  p1: { org: string; rating: number; male?: boolean },
  p2: { org: string; rating: number; male?: boolean },
  mixed = false,
): string {
  if (mixed) return (p1.male ? p1 : p2).org;
  return p1.rating >= p2.rating ? p1.org : p2.org;
}
