/** Ommaviy (autentifikatsiyasiz) javob shakllari — maxfiy maydonlar (tug'ilgan sana, tuman, telefon, PINFL) BU YERDA YO'Q. */

export interface ProfileCard {
  slot: 1 | 2;
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  countryCode: string;
  photoUrl: string | null;
  region: string;
  club: string | null;
  /** Yosh (butun son) — tug'ilgan sana chiqmaydi */
  age: number | null;
  /** Umumiy reyting bali (Player.rankingPoints) */
  rating: number;
  /** Shu jins ichidagi reyting o'rni (1 = eng yuqori) */
  rank: number;
  played: number;
  won: number;
  lost: number;
}

export interface MatchProfiles {
  matchId: string;
  tableNumber: number | null;
  stage: string;
  tournamentName: string;
  players: ProfileCard[];
}

export interface RatingChange {
  slot: 1 | 2;
  id: string;
  firstName: string;
  lastName: string;
  countryCode: string;
  photoUrl: string | null;
  won: boolean;
  sets: number;
  before: number;
  after: number;
  delta: number;
  rankBefore: number;
  rankAfter: number;
}

export interface MatchRatingResult {
  matchId: string;
  tableNumber: number | null;
  stage: string;
  tournamentName: string;
  games: Array<[number, number]>;
  winnerSlot: 1 | 2 | null;
  players: RatingChange[];
}

/** Yoshni hisoblash: faqat butun son qaytariladi */
export function ageFromBirthDate(
  birthDate: Date | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!birthDate) return null;
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const m = now.getUTCMonth() - birthDate.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < birthDate.getUTCDate())) age--;
  return age >= 0 && age < 120 ? age : null;
}

/** "1,2, 5" -> [1,2,5]; bo'sh qator — hamma stol (null) */
export function parseTables(raw: string | null | undefined): number[] | null {
  const list = String(raw ?? '')
    .split(',')
    .map((x) => parseInt(x.trim(), 10))
    .filter((n) => Number.isInteger(n) && n > 0 && n <= 64);
  return list.length ? list : null;
}
