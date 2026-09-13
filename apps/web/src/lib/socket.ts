'use client';

import type { Socket } from 'socket.io-client';

/**
 * /live namespace — jonli hisob uchun yagona socket.
 *
 * socket.io-client DINAMIK yuklanadi: u faqat jonli hisob kerak bo'lgan
 * sahifalarda (va birinchi chizishdan keyin) tarmoqdan olinadi, shuning uchun
 * boshlang'ich JS to'plamiga tushmaydi.
 */
let socketPromise: Promise<Socket> | null = null;

function connect(): Promise<Socket> {
  if (!socketPromise) {
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    socketPromise = import('socket.io-client').then(({ io }) =>
      io(`${base}/live`, {
        transports: ['websocket', 'polling'],
        // Aloqa uzilsa o'zi tiklanadi (zal monitori/overlay soatlab ishlaydi)
        reconnection: true,
        reconnectionDelay: 500,
        reconnectionDelayMax: 5_000,
      }),
    );
  }
  return socketPromise;
}

/**
 * Bir yoki bir nechta o'yin xonasiga obuna. Sinxron tozalash funksiyasini
 * qaytaradi — komponent socket yuklanishini kutmaydi.
 */
function subscribe(
  matchIds: string[],
  onUpdate: (payload: MatchPayload) => void,
): () => void {
  let cancelled = false;
  let cleanup = () => {};

  void connect().then((socket) => {
    if (cancelled) return;
    const handler = (p: MatchPayload) => {
      if (matchIds.length === 0 || matchIds.includes(p.id)) onUpdate(p);
    };
    const joinAll = () => {
      for (const id of matchIds) socket.emit('join', { matchId: id });
    };

    joinAll();
    // Aloqa uzilib qayta ulanganda xonalar yo'qoladi — qayta qo'shilamiz.
    // Busiz overlay/monitor jimgina yangilanishdan to'xtab qolardi.
    socket.on('connect', joinAll);
    socket.on('score:update', handler);

    cleanup = () => {
      for (const id of matchIds) socket.emit('leave', { matchId: id });
      socket.off('connect', joinAll);
      socket.off('score:update', handler);
    };
  });

  return () => {
    cancelled = true;
    cleanup();
  };
}

/** Bitta o'yin xonasiga obuna (kartochka, overlay, monitor, hakam paneli) */
export function subscribeToMatch(
  matchId: string,
  onUpdate: (payload: MatchPayload) => void,
): () => void {
  return subscribe([matchId], onUpdate);
}

/** Bir nechta o'yinga obuna (bosh sahifadagi jonli lenta) */
export function subscribeToMatches(
  matchIds: string[],
  onUpdate: (payload: MatchPayload) => void,
): () => void {
  return subscribe(matchIds, onUpdate);
}

export interface MatchPayload {
  id: string;
  tournamentId: string;
  tournament?: { id: string; slug: string; name: string };
  stage: string;
  status: 'SCHEDULED' | 'LIVE' | 'FINISHED';
  tableNumber: number | null;
  scheduledAt: string | null;
  bestOf: number;
  seq: number;
  player1Name: string;
  player2Name: string;
  currentSetP1: number;
  currentSetP2: number;
  player1SetsWon: number;
  player2SetsWon: number;
  sets: Array<{ setNumber: number; p1Points: number; p2Points: number }>;
  cards: Array<{ player: 1 | 2; type: 'YELLOW' | 'RED'; setNumber: number }>;
  winnerId: string | null;
  winnerInfo: {
    playerId: string;
    name: string;
    pointsAwarded: number;
    totalPoints: number;
  } | null;
  refereeVerified: boolean;
  disqualifiedPlayerId: string | null;
  disqualificationReason: string | null;
  /** Podacha kimda (faqat LIVE holatda) */
  server: 1 | 2 | null;
  /** Setpoint/matchpoint indikatori (faqat LIVE holatda) */
  pointAlert: { player: 1 | 2; isMatchPoint: boolean } | null;
}
