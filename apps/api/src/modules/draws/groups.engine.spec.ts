import {
  groupStandings,
  placeQualifiers,
  roundRobinMatchCount,
  roundRobinRounds,
  snakeDraw,
  type GroupMatchResult,
} from './groups.engine';

/** Matn ko'rinishidagi 3-1 kabi setlardan to'liq o'ynalgan uchrashuv (11:5 kabi ochkolar bilan) */
const played = (a: string, b: string, sa: number, sb: number, pts?: Array<[number, number]>): GroupMatchResult => {
  const sets: Array<{ a: number; b: number }> = [];
  if (pts) pts.forEach(([x, y]) => sets.push({ a: x, b: y }));
  else {
    let ra = sa;
    let rb = sb;
    // sa marta a yutadi, sb marta b yutadi (11:5 / 5:11), ketma-ketlik muhim emas
    while (ra > 0 || rb > 0) {
      if (ra > 0) { sets.push({ a: 11, b: 5 }); ra--; }
      if (rb > 0) { sets.push({ a: 5, b: 11 }); rb--; }
    }
  }
  return { a, b, kind: 'PLAYED', winner: sa > sb ? a : b, sets, bestOf: 5 };
};
const order = (r: ReturnType<typeof groupStandings>) => r.map((x) => x.playerId).join('');

describe('27-ilova: guruh natijalari', () => {
  it('1-jadval: ochko bo‘yicha A, D, B, C (g‘alaba 2, mag‘lubiyat 1)', () => {
    const r = groupStandings(['A', 'B', 'C', 'D'], [
      played('A', 'B', 3, 1), played('A', 'C', 3, 0), played('A', 'D', 3, 1),
      played('B', 'C', 3, 0), played('B', 'D', 1, 3), played('C', 'D', 0, 3),
    ]);
    expect(order(r)).toBe('ADBC');
    expect(r.map((x) => x.points)).toEqual([6, 5, 4, 3]);
  });

  it('2-jadval: tenglikda faqat o‘zaro o‘yin — D, B, A, C (umumiy set nisbati hal qilmaydi)', () => {
    const r = groupStandings(['A', 'B', 'C', 'D'], [
      played('A', 'B', 1, 3), played('A', 'C', 3, 0), played('A', 'D', 2, 3),
      played('B', 'C', 3, 0), played('B', 'D', 2, 3), played('C', 'D', 3, 0),
    ].map((m) => m));
    // D (B ni yutgan) B dan oldin; A (C ni yutgan) C dan oldin
    expect(order(r)).toBe('DBAC');
  });

  it('3-jadval (A, B, D — 5 ochko; C — 3): C 4-o‘rin, qolgan uchtasi o‘zaro set nisbati bilan A, D, B', () => {
    const r = groupStandings(['A', 'B', 'C', 'D'], [
      played('A', 'B', 3, 0), played('A', 'C', 3, 2), played('D', 'A', 3, 1),
      played('B', 'C', 3, 0), played('B', 'D', 3, 2), played('D', 'C', 3, 0),
    ]);
    expect(order(r)).toBe('ADBC');
    expect(r.every((x) => !x.lot)).toBe(true);
  });

  it('4-jadval: set nisbati ham teng (4/4) — o‘yin ochkolari nisbati: B (78/66), D (73/71), A (65/79), C oxirida', () => {
    const g = (a: string, b: string, games: Array<[number, number]>): GroupMatchResult => {
      const sa = games.filter(([x, y]) => x > y).length;
      return { a, b, kind: 'PLAYED', winner: sa * 2 > games.length ? a : b, sets: games.map(([x, y]) => ({ a: x, b: y })), bestOf: 5 };
    };
    const r = groupStandings(['A', 'B', 'C', 'D'], [
      g('A', 'B', [[11, 9], [11, 5], [3, 11], [12, 10]]),
      g('D', 'A', [[11, 9], [11, 6], [11, 13], [11, 0]].map(([x, y]) => [x, y] as [number, number])),
      g('B', 'D', [[10, 12], [11, 7], [11, 2], [11, 8]]),
      g('A', 'C', [[11, 5], [11, 5], [5, 11], [11, 5]]),
      g('B', 'C', [[11, 5], [11, 5], [5, 11], [11, 5]]),
      g('D', 'C', [[11, 5], [11, 5], [5, 11], [11, 5]]),
    ]);
    expect(order(r)).toBe('BDAC');
    const b = r.find((x) => x.playerId === 'B')!;
    expect(r.find((x) => x.playerId === 'A')!.points).toBe(5);
    expect(b.points).toBe(5);
  });

  it('5-jadval: kelmagan (W/O) — g‘olibga 2 ochko, kelmaganga 0; A 4-o‘rin', () => {
    const wo: GroupMatchResult = { a: 'A', b: 'D', kind: 'FORFEIT', winner: 'D', sets: [], bestOf: 5 };
    const r = groupStandings(['A', 'B', 'C', 'D'], [
      played('A', 'B', 1, 3), played('A', 'C', 3, 0), wo,
      played('B', 'C', 3, 0), played('B', 'D', 2, 3), played('C', 'D', 3, 0),
    ].map((m) => m));
    // A: 1 (B ni yutqazdi) + 2 (C ni yutdi) + 0 = 3; B: 2+1+2 = 5? — jadvalga mos: D 5, B 5, C 4 (3 mag'lubiyat?) -> A oxirida
    const a = r.find((x) => x.playerId === 'A')!;
    expect(a.points).toBe(3);
    expect(a.place).toBe(4);
  });

  it('o‘ynalmagan uchrashuvda g‘olibga 3-0 va 11-0 hisoblanadi (4.2.7)', () => {
    const wo: GroupMatchResult = { a: 'A', b: 'B', kind: 'FORFEIT', winner: 'A', sets: [], bestOf: 5 };
    const r = groupStandings(['A', 'B'], [wo]);
    const a = r.find((x) => x.playerId === 'A')!;
    const b = r.find((x) => x.playerId === 'B')!;
    expect(a.setsWon).toBe(3);
    expect(a.pointsWon).toBe(33);
    expect(b.setsWon).toBe(0);
    expect(a.points).toBe(2);
    expect(b.points).toBe(0);
  });

  it('yarim o‘ynalgan uchrashuv: 1-1 setda 5:3 yetakchi tomon qoldi (27-ilova misoli: 7, −8, 3, 0)', () => {
    const m: GroupMatchResult = {
      a: 'A', b: 'B', kind: 'FORFEIT', winner: 'A', bestOf: 5,
      sets: [{ a: 11, b: 7 }, { a: 8, b: 11 }],
      partial: { a: 5, b: 3 }, // A yetakchi, lekin B (3 ochko) tugatmadi → A yutadi: 11:3
    };
    const r = groupStandings(['A', 'B'], [m]);
    const a = r.find((x) => x.playerId === 'A')!;
    expect(a.setsWon).toBe(3); // 1 + (qisman set) + (11:0 set)
    expect(a.pointsWon).toBe(11 + 8 + 11 + 11); // 41
    expect(a.pointsLost).toBe(7 + 11 + 3 + 0); // 21
  });

  it('50% qoidasi (4.2.6): kam o‘ynagan o‘yinchi natijalari bekor qilinadi (yakuniy hisobda)', () => {
    // 4 kishi: A uchta o'yindan faqat 1 tasini o'ynadi (<50% => 1 < 1.5) — natijalari bekor
    const r = groupStandings(
      ['A', 'B', 'C', 'D'],
      [
        played('A', 'B', 0, 3),
        { a: 'A', b: 'C', kind: 'NONE' },
        { a: 'A', b: 'D', kind: 'NONE' },
        played('B', 'C', 3, 0),
        played('B', 'D', 3, 0),
        played('C', 'D', 3, 0),
      ],
      Math.random,
      { final: true },
    );
    const a = r.find((x) => x.playerId === 'A')!;
    expect(a.annulled).toBe(true);
    expect(a.place).toBe(4);
    const b = r.find((x) => x.playerId === 'B')!;
    expect(b.points).toBe(4); // A bilan o'yin hisobdan chiqdi: 2 + 2
  });

  it('to‘liq teng bo‘lsa jereb (lot=true)', () => {
    const r = groupStandings(['A', 'B', 'C'], [
      played('A', 'B', 3, 0, [[11, 5], [11, 5], [11, 5]]),
      played('B', 'C', 3, 0, [[11, 5], [11, 5], [11, 5]]),
      played('C', 'A', 3, 0, [[11, 5], [11, 5], [11, 5]]),
    ]);
    expect(r.every((x) => x.lot)).toBe(true);
    expect(new Set(r.map((x) => x.place))).toEqual(new Set([1, 2, 3]));
  });
});

describe('doira jadvali va zmeyka', () => {
  it('N(N−1)/2 va har kim har kim bilan bir martadan', () => {
    for (const n of [3, 4, 5, 6, 7, 8]) {
      const rounds = roundRobinRounds(n);
      const pairs = rounds.flat().map(([a, b]) => `${a}-${b}`);
      expect(pairs.length).toBe(roundRobinMatchCount(n));
      expect(new Set(pairs).size).toBe(pairs.length);
      // bir turda o'yinchi ikki marta emas
      for (const r of rounds) {
        const seen = new Set<number>();
        for (const [a, b] of r) { expect(seen.has(a) || seen.has(b)).toBe(false); seen.add(a); seen.add(b); }
      }
    }
  });

  it('4 kishida oxirgi tur 1-2 bilan (4.2.5: 1 kishi chiqsa, oxirgi o‘yin 1-o‘rin va 2-o‘rin o‘rtasida)', () => {
    const r = roundRobinRounds(4);
    expect(r[r.length - 1]).toContainEqual([1, 2]);
  });

  const mk = (n: number, org?: (i: number) => string | null) =>
    Array.from({ length: n }, (_, i) => ({ playerId: `p${i + 1}`, rating: 1000 - i, org: org ? org(i) : null }));

  it('zmeyka: 16 o‘yinchi 4 guruhga — 1-qator 1,2,3,4; 2-qator 8,7,6,5 (qator tartibi)', () => {
    const g = snakeDraw(mk(16), 4);
    expect(g.map((x) => x[0].playerId)).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(g.map((x) => x[1].playerId)).toEqual(['p8', 'p7', 'p6', 'p5']);
    expect(g.map((x) => x[2].playerId)).toEqual(['p9', 'p10', 'p11', 'p12']);
    expect(g.map((x) => x[3].playerId)).toEqual(['p16', 'p15', 'p14', 'p13']);
  });

  it('o‘zgartirilgan zmeyka: 8 guruh, 2-qator 9–12 → 5–8-guruhlar, 13–16 → 1–4-guruhlar (jereb ichida)', () => {
    for (let s = 0; s < 10; s++) {
      let seed = s + 1;
      const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const g = snakeDraw(mk(24), 8, { modified: true, rng });
      const where = (id: string) => g.findIndex((grp) => grp.some((p) => p.playerId === id));
      for (const id of ['p9', 'p10', 'p11', 'p12']) expect(where(id)).toBeGreaterThanOrEqual(4);
      for (const id of ['p13', 'p14', 'p15', 'p16']) expect(where(id)).toBeLessThanOrEqual(3);
      expect(g.every((x) => x.length === 3)).toBe(true);
    }
  });

  it('bir viloyatning o‘yinchilari (guruhlardan kam) turli guruhlarda (4.7.2.5)', () => {
    const players = mk(16, (i) => (i === 4 || i === 5 || i === 6 ? 'A' : `o${i}`)); // p5,p6,p7 — A, 4 guruh
    const g = snakeDraw(players, 4);
    const groupsWithA = g.map((grp) => grp.filter((p) => p.org === 'A').length);
    expect(Math.max(...groupsWithA)).toBe(1);
  });
});

describe('guruhdan setkaga (4.7.3)', () => {
  const qual = (G: number, adv: number) => {
    const q = [];
    for (let g = 1; g <= G; g++) for (let p = 1; p <= adv; p++) q.push({ playerId: `g${g}p${p}`, group: g, place: p, org: null });
    return q;
  };

  it('4 guruh × 2: 1-guruh g‘olibi tepada, 2-guruh g‘olibi pastda; 2-o‘rindagilar g‘olib qarshi yarimida', () => {
    for (let s = 1; s <= 30; s++) {
      let seed = s;
      const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const out = placeQualifiers(qual(4, 2), 4, rng);
      expect(out).toHaveLength(8);
      expect(out[0]).toBe('g1p1');
      expect(out[7]).toBe('g2p1');
      const pos = (id: string) => out.indexOf(id);
      const half = (p: number) => (p < 4 ? 0 : 1);
      for (let g = 1; g <= 4; g++) expect(half(pos(`g${g}p1`))).not.toBe(half(pos(`g${g}p2`)));
      expect(new Set(out.filter(Boolean)).size).toBe(8);
    }
  });

  it('8 guruh × 2 = 16 o‘rin; 3 guruh × 2 = 6 → setka 8, 2 BYE (28-ilova o‘rinlari)', () => {
    const out16 = placeQualifiers(qual(8, 2), 8);
    expect(out16.filter(Boolean)).toHaveLength(16);
    const out6 = placeQualifiers(qual(3, 2), 3);
    expect(out6).toHaveLength(8);
    expect(out6.filter((x) => x === null)).toHaveLength(2);
    // BYE o'rinlari 2 va 7 (1-indeks) — 1- va 2-g'oliblar qarshisida
    expect(out6[1]).toBeNull();
    expect(out6[6]).toBeNull();
  });
});
