/** API `/showcase/*` javoblari (apps/api/src/modules/showcase/showcase.types.ts bilan bir xil shakl) */
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
  age: number | null;
  rating: number;
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

export interface OverlayAdPublic {
  id: string;
  title: string;
  kind: 'IMAGE' | 'VIDEO' | 'PROMO';
  imageUrl: string | null;
  videoUrl: string | null;
  durationS: number;
}

export const STAGE_LABEL: Record<string, string> = {
  FINAL: 'FINAL',
  SEMIFINAL: 'YARIM FINAL',
  QUARTERFINAL: 'CHORAK FINAL',
  ROUND_OF_16: '1/8 FINAL',
  ROUND_OF_32: '1/16 FINAL',
  ROUND_1: '1-BOSQICH',
  GROUP: 'GURUH BOSQICHI',
};
