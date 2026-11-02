import { applyPoint, initialState } from '../matches/scoring.engine';

export type ReplayPlan =
  | { ok: true; order: Array<1 | 2>; winnerSlot: 1 | 2 }
  | { ok: false; reason: string };

/** Bitta geym uchun ochkolar ketma-ketligi: avval navbatma-navbat (durang), keyin g'olibning qolgan ochkolari */
function setOrder(a: number, b: number): Array<1 | 2> {
  const order: Array<1 | 2> = [];
  const lo = Math.min(a, b);
  for (let i = 0; i < lo; i++) order.push(1, 2);
  const winner: 1 | 2 = a > b ? 1 : 2;
  for (let i = 0; i < Math.abs(a - b); i++) order.push(winner);
  return order;
}

/**
 * Scoreboard'dan kelgan geymlar hisobini SAYT qoidalari (scoring.engine) bo'yicha oldindan o'ynab ko'radi.
 * Har geym aynan o'zining oxirgi ochkosida tugashi, o'yin esa aynan oxirgi geymning oxirgi ochkosida
 * tugashi shart. Aks holda (masalan, yakunlanmagan hal qiluvchi geym 5-3, 11-10, 15-3 yoki ortiqcha geym)
 * hech narsa yozilmaydi — bazada yarim qolgan o'yin paydo bo'lmasin.
 */
export function planReplay(sets: unknown, bestOf: number): ReplayPlan {
  if (!Array.isArray(sets) || sets.length === 0) return { ok: false, reason: "Geymlar hisobi bo'sh" };
  for (const s of sets) {
    if (!Array.isArray(s) || s.length !== 2 || s.some((v) => !Number.isInteger(v) || v < 0 || v > 60)) {
      return { ok: false, reason: "Geym hisobi noto'g'ri" };
    }
  }
  let state = initialState(bestOf);
  const all: Array<1 | 2> = [];
  for (let si = 0; si < sets.length; si++) {
    const [a, b] = sets[si] as [number, number];
    const order = setOrder(a, b);
    if (!order.length) return { ok: false, reason: `${si + 1}-geym hisobi bo'sh (0-0)` };
    for (let pi = 0; pi < order.length; pi++) {
      if (state.status === 'FINISHED') {
        return { ok: false, reason: `${si + 1}-geym: o'yin bundan oldin tugagan (ortiqcha geym)` };
      }
      const r = applyPoint(state, order[pi]);
      state = r.state;
      all.push(order[pi]);
      const last = pi === order.length - 1;
      if (r.setFinished !== last) {
        return { ok: false, reason: `${si + 1}-geym hisobi (${a}-${b}) sayt qoidalariga mos emas (11 ochko, 2 ochko farq)` };
      }
    }
  }
  if (state.status !== 'FINISHED' || !state.winnerSlot) {
    return { ok: false, reason: `O'yin yakunlanmagan: ${state.player1SetsWon}-${state.player2SetsWon} (${bestOf} geymdan)` };
  }
  return { ok: true, order: all, winnerSlot: state.winnerSlot };
}
