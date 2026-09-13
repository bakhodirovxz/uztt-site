// UZTT — umumiy kontraktlar (api ↔ web).
// Socket event nomlari va payload tiplari shu yerda yagona manbada turadi.

// ==================== SOCKET KONTRAKTLARI ====================

/** Socket.io xona nomlari */
export const socketRooms = {
  match: (matchId: string) => `match:${matchId}` as const,
  tournament: (tournamentId: string) => `tournament:${tournamentId}` as const,
};

/** Server → mijoz eventlari */
export const socketEvents = {
  scoreUpdate: 'score:update',
  matchFinished: 'match:finished',
  drawUpdate: 'draw:update',
} as const;

/** Mijoz → server eventlari */
export const socketCommands = {
  join: 'join',
  leave: 'leave',
} as const;

export interface ScoreUpdatePayload {
  matchId: string;
  seq: number; // monotonik — eski eventlarni tashlash uchun
  status: 'SCHEDULED' | 'LIVE' | 'FINISHED';
  player1Name: string;
  player2Name: string;
  currentSetP1: number;
  currentSetP2: number;
  player1SetsWon: number;
  player2SetsWon: number;
  sets: Array<{ setNumber: number; p1Points: number; p2Points: number }>;
  cards: Array<{ player: 1 | 2; type: 'YELLOW' | 'RED' }>;
  winnerId?: string | null;
  disqualifiedPlayerId?: string | null;
}

// ==================== UMUMIY ENUMLAR ====================

export type Gender = 'MALE' | 'FEMALE';

export type MatchStage =
  | 'FINAL'
  | 'SEMIFINAL'
  | 'QUARTERFINAL'
  | 'ROUND_OF_16'
  | 'ROUND_OF_32'
  | 'ROUND_1'
  | 'GROUP';

/** Auth foydalanuvchi (api /auth/me javobi) */
export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
}
