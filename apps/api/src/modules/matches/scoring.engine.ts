/**
 * Stol tennisi hisob dvigateli — legacy backend/src/routes/matches.js dan
 * 1:1 portlangan pure funksiya. Hech qanday I/O yo'q — to'liq testlanadi.
 *
 * Qoidalar:
 *  - Set: kamida 11 ochko VA kamida 2 ochko farq (deuce'da 12-10, 13-11, ...)
 *  - Match: bestOf setning yarmidan ko'pini olgan g'olib (bestOf 5 → 3 set)
 *  - Birinchi ochko kiritilganda SCHEDULED → LIVE
 */

export interface SetScore {
  p1: number;
  p2: number;
}

export interface ScoreState {
  bestOf: number;
  status: 'SCHEDULED' | 'LIVE' | 'FINISHED';
  currentSet: SetScore;
  sets: SetScore[]; // tugagan setlar
  player1SetsWon: number;
  player2SetsWon: number;
  /** 1 | 2 | null — slot bo'yicha g'olib (ID'ga xizmat qatlami bog'laydi) */
  winnerSlot: 1 | 2 | null;
}

export interface PointResult {
  state: ScoreState;
  setFinished: boolean;
  matchFinished: boolean;
}

export function initialState(bestOf = 5): ScoreState {
  return {
    bestOf,
    status: 'SCHEDULED',
    currentSet: { p1: 0, p2: 0 },
    sets: [],
    player1SetsWon: 0,
    player2SetsWon: 0,
    winnerSlot: null,
  };
}

export function setsToWin(bestOf: number): number {
  return Math.ceil(bestOf / 2);
}

/** Set tugadimi? Legacy: (p1>=11 || p2>=11) && |p1-p2|>=2 */
export function isSetWon(set: SetScore): boolean {
  return (set.p1 >= 11 || set.p2 >= 11) && Math.abs(set.p1 - set.p2) >= 2;
}

export function applyPoint(state: ScoreState, player: 1 | 2): PointResult {
  if (state.status === 'FINISHED') {
    throw new Error("O'yin allaqachon yakunlangan");
  }

  const next: ScoreState = {
    ...state,
    currentSet: { ...state.currentSet },
    sets: [...state.sets],
  };

  if (next.status === 'SCHEDULED') next.status = 'LIVE';

  if (player === 1) next.currentSet.p1 += 1;
  else next.currentSet.p2 += 1;

  let setFinished = false;
  let matchFinished = false;

  if (isSetWon(next.currentSet)) {
    setFinished = true;
    next.sets.push({ ...next.currentSet });
    if (next.currentSet.p1 > next.currentSet.p2) next.player1SetsWon += 1;
    else next.player2SetsWon += 1;
    next.currentSet = { p1: 0, p2: 0 };

    const target = setsToWin(next.bestOf);
    if (next.player1SetsWon >= target || next.player2SetsWon >= target) {
      matchFinished = true;
      next.status = 'FINISHED';
      next.winnerSlot = next.player1SetsWon > next.player2SetsWon ? 1 : 2;
    }
  }

  return { state: next, setFinished, matchFinished };
}

/**
 * Podachani kim beryapti (WTT scorebug "service indicator").
 * Qoida: har 2 ochkoda podacha almashadi; 10-10 (deuce) dan keyin har ochkoda.
 * Har yangi setda boshlovchi tomon almashadi.
 *
 * @param firstServer 1-setni kim boshlagan (default 1 — toss natijasi)
 */
export function serverSlot(state: ScoreState, firstServer: 1 | 2 = 1): 1 | 2 {
  const { p1, p2 } = state.currentSet;
  const total = p1 + p2;
  const deuce = p1 >= 10 && p2 >= 10;
  // Nechta "podacha bloki" o'tgani
  const blocks = deuce ? 10 + (total - 20) : Math.floor(total / 2);
  const setIndex = state.sets.length; // 0 = 1-set
  const flips = (blocks + setIndex) % 2;
  const base = firstServer === 1 ? 0 : 1;
  return (base + flips) % 2 === 0 ? 1 : 2;
}

export interface PointAlert {
  /** Kim bir ochko qolganini bildiradi */
  player: 1 | 2;
  /** true — bu ochko butun o'yinni hal qiladi (matchpoint) */
  isMatchPoint: boolean;
}

/**
 * Setpoint / matchpoint indikatori (WTT scorebug "Gamepoint/Matchpoint").
 * Setpoint: o'yinchi ≥10 ochko va raqibidan kamida 1 ochko oldinda.
 */
export function pointAlert(state: ScoreState): PointAlert | null {
  if (state.status === 'FINISHED') return null;
  const { p1, p2 } = state.currentSet;
  const target = setsToWin(state.bestOf);

  const check = (
    mine: number,
    theirs: number,
    slot: 1 | 2,
  ): PointAlert | null => {
    if (mine < 10 || mine - theirs < 1) return null;
    const setsWon = slot === 1 ? state.player1SetsWon : state.player2SetsWon;
    return { player: slot, isMatchPoint: setsWon === target - 1 };
  };

  return check(p1, p2, 1) ?? check(p2, p1, 2);
}

/** Diskvalifikatsiya: raqib g'olib, o'yin darhol tugaydi (legacy semantikasi) */
export function applyDisqualification(
  state: ScoreState,
  disqualifiedPlayer: 1 | 2,
): ScoreState {
  if (state.status === 'FINISHED') {
    throw new Error("O'yin allaqachon yakunlangan");
  }
  return {
    ...state,
    status: 'FINISHED',
    winnerSlot: disqualifiedPlayer === 1 ? 2 : 1,
  };
}
