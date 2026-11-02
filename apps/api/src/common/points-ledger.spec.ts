import { floorApply, loggedExact, netReversal, type LogRow } from './points';

describe('floorApply (0 chegarasi, haqiqiy delta)', () => {
  it('oddiy qo‘shish/ayirish', () => {
    expect(floorApply(50, 7)).toEqual({ after: 57, applied: 7 });
    expect(floorApply(50, -7)).toEqual({ after: 43, applied: -7 });
  });
  it('0 dan pastga tushmaydi — applied kesilgan qism', () => {
    expect(floorApply(2, -10)).toEqual({ after: 0, applied: -2 });
    expect(floorApply(0, -5)).toEqual({ after: 0, applied: 0 });
  });
  it('delta butunga yaxlitlanadi', () => {
    expect(floorApply(10, 2.6)).toEqual({ after: 13, applied: 3 });
  });
});

describe('loggedExact', () => {
  it('kesilmagan bo‘lsa exact o‘zgarmaydi', () => {
    expect(loggedExact(-2.4, -2, -2)).toBeCloseTo(-2.4);
  });
  it('kesilgan qism exact dan ham olib tashlanadi (Σexact − Σdelta saqlanadi)', () => {
    // so'raldi −2 (exact −2.4), haqiqatda 0 → exact −0.4
    expect(loggedExact(-2.4, -2, 0)).toBeCloseTo(-0.4);
  });
  it('null/undefined → null', () => {
    expect(loggedExact(null, 5, 5)).toBeNull();
    expect(loggedExact(undefined, 5, 5)).toBeNull();
  });
});

describe('netReversal (undo: sof yig‘indini teskari qilish)', () => {
  const row = (
    playerId: string,
    delta: number,
    exact: number | null = null,
    note: string | null = 'n',
  ): LogRow => ({ playerId, delta, exact, note });

  it('bitta yakun: har yozuv teskari', () => {
    expect(netReversal([row('A', 7, 7.2, 'win'), row('B', -3, -3.4, 'loss')])).toEqual([
      { playerId: 'A', note: 'win', delta: -7, exact: -7.2 },
      { playerId: 'B', note: 'loss', delta: 3, exact: 3.4 },
    ]);
  });

  it('allaqachon qaytarilgan yozuvlar qayta qaytarilmaydi', () => {
    // 1-yakun +10, undo −10, 2-yakun +8 → faqat 8 qaytariladi (eski xato: 18)
    const rows = [row('A', 10), row('A', -10), row('A', 8)];
    expect(netReversal(rows)).toEqual([{ playerId: 'A', note: 'n', delta: -8, exact: null }]);
  });

  it('to‘liq qaytarilgan o‘yinchi tashlab yuboriladi', () => {
    expect(netReversal([row('A', 10), row('A', -10)])).toEqual([]);
  });

  it('izoh bo‘yicha alohida (ishtirok/bonus/g‘alaba)', () => {
    const out = netReversal([row('A', 5, null, 'bonus'), row('A', 2, 2.1, 'win')]);
    expect(out).toHaveLength(2);
    expect(out.find((r) => r.note === 'bonus')).toEqual({
      playerId: 'A',
      note: 'bonus',
      delta: -5,
      exact: null,
    });
  });

  it('delta 0 bo‘lsa ham kasr qoldig‘i (exact) qaytariladi', () => {
    const [r] = netReversal([row('A', 0, 0.4)]);
    expect(r.delta).toBe(0);
    expect(r.exact).toBeCloseTo(-0.4);
  });
});

/**
 * Jurnal + ball simulyatsiyasi (applyPoints semantikasi bilan): bir necha "tugadi → undo"
 * siklidan keyin ham ball boshlang'ich holatga qaytadi va `ball == boshlang'ich + Σ jurnal`.
 */
describe('ledger simulyatsiyasi: tugadi → undo sikllari', () => {
  type Entry = { playerId: string; delta: number; exact: number | null; note: string | null };
  const apply = (bal: Map<string, number>, log: LogRow[], e: Entry) => {
    const before = bal.get(e.playerId) ?? 0;
    const { after, applied } = floorApply(before, e.delta);
    bal.set(e.playerId, after);
    log.push({ ...e, delta: applied, exact: loggedExact(e.exact, e.delta, applied) });
  };
  const finish = (bal: Map<string, number>, log: LogRow[]) => {
    apply(bal, log, { playerId: 'W', delta: 10, exact: 10, note: 'win' });
    apply(bal, log, { playerId: 'L', delta: -10, exact: -10, note: 'loss' });
  };
  const undo = (bal: Map<string, number>, log: LogRow[]) => {
    for (const r of netReversal(log)) apply(bal, log, r);
  };
  const sum = (log: LogRow[], id: string) =>
    log.filter((r) => r.playerId === id).reduce((s, r) => s + r.delta, 0);

  it('mag‘lub 0 ga yaqin (kesish) — undo yo‘qdan ball yaratmaydi', () => {
    const bal = new Map([['W', 100], ['L', 3]]);
    const log: LogRow[] = [];
    finish(bal, log);
    expect(bal.get('L')).toBe(0);
    undo(bal, log);
    expect(bal.get('L')).toBe(3); // eski xato: 13
    expect(bal.get('W')).toBe(100);
  });

  it('uch marta tugadi → undo, keyin yakun: hisob aniq', () => {
    const bal = new Map([['W', 50], ['L', 4]]);
    const log: LogRow[] = [];
    for (let i = 0; i < 3; i++) {
      finish(bal, log);
      undo(bal, log);
    }
    expect(bal.get('W')).toBe(50);
    expect(bal.get('L')).toBe(4);
    expect(sum(log, 'W')).toBe(0);
    expect(sum(log, 'L')).toBe(0);
    finish(bal, log);
    expect(bal.get('W')).toBe(60);
    expect(bal.get('L')).toBe(0);
    expect(50 + sum(log, 'W')).toBe(bal.get('W'));
    expect(4 + sum(log, 'L')).toBe(bal.get('L'));
  });
});
