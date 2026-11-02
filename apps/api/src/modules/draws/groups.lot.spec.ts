import {
  groupStandings,
  lotStraddlesBoundary,
  seededRng,
  type GroupMatchResult,
  type Standing,
} from './groups.engine';

const win = (a: string, b: string): GroupMatchResult => ({
  a,
  b,
  kind: 'PLAYED',
  winner: a,
  sets: [{ a: 11, b: 5 }, { a: 11, b: 5 }, { a: 11, b: 5 }],
  bestOf: 5,
});

// A, B, C bir-birini aylana bo'ylab bir xil hisobda yutadi — to'liq tenglik (faqat jereb)
const cycle = [win('A', 'B'), win('B', 'C'), win('C', 'A')];

describe('seededRng', () => {
  it('bir xil urug‘ — bir xil ketma-ketlik; boshqa urug‘ — boshqa', () => {
    const a = seededRng('group-1');
    const b = seededRng('group-1');
    const c = seededRng('group-2');
    const sa = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(sa);
    expect([c(), c(), c()]).not.toEqual(sa);
    for (const v of sa) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('jadval jerebi so‘rovdan so‘rovga o‘zgarmaydi', () => {
    const order = () =>
      groupStandings(['A', 'B', 'C'], cycle, seededRng('g'))
        .map((s) => s.playerId)
        .join('');
    expect(order()).toBe(order());
  });
});

describe('lotGroup / lotStraddlesBoundary', () => {
  it('to‘liq tenglik — hammasi bitta jereb sinfida', () => {
    const r = groupStandings(['A', 'B', 'C'], cycle, seededRng('x'));
    expect(new Set(r.map((s) => s.lotGroup))).toEqual(new Set([1]));
  });

  it('jerebsiz jadvalda lotGroup null va chegara kesilmaydi', () => {
    const r = groupStandings(['A', 'B', 'C'], [win('A', 'B'), win('A', 'C'), win('B', 'C')]);
    expect(r.every((s) => s.lotGroup === null)).toBe(true);
    expect(lotStraddlesBoundary(r, 2)).toBe(false);
  });

  it('3 kishilik jereb sinfi va 2 tasi chiqadi — chegara kesiladi', () => {
    const r = groupStandings(['A', 'B', 'C'], cycle, seededRng('x'));
    expect(lotStraddlesBoundary(r, 2)).toBe(true);
  });

  const st = (place: number, lotGroup: number | null, annulled = false): Standing => ({
    playerId: `p${place}`,
    place,
    points: 0,
    played: 0,
    won: 0,
    lost: 0,
    setsWon: 0,
    setsLost: 0,
    pointsWon: 0,
    pointsLost: 0,
    lot: lotGroup !== null,
    lotGroup,
    annulled,
  });

  it('jereb sinfi to‘liq ichkarida yoki tashqarida bo‘lsa — kesilmaydi', () => {
    // 1–2 o'rin bitta sinf (ikkalasi chiqadi), 3–4 boshqa sinf (ikkalasi chiqmaydi)
    expect(lotStraddlesBoundary([st(1, 1), st(2, 1), st(3, 2), st(4, 2)], 2)).toBe(false);
  });

  it('qo‘shni ikki sinf chegarada bo‘lsa ham farqlanadi; bitta sinf chegarada — kesiladi', () => {
    expect(lotStraddlesBoundary([st(1, null), st(2, 1), st(3, 1), st(4, null)], 2)).toBe(true);
  });
});
