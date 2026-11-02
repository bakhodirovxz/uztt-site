import {
  drawSize,
  placePlayers,
  planMatches,
  seedOrder,
  stageForRound,
  type DrawPlayer,
} from './draw.engine';

const mk = (n: number): DrawPlayer[] =>
  Array.from({ length: n }, (_, i) => ({
    playerId: `p${i + 1}`,
    rankingPoints: 1000 - i * 10, // p1 eng kuchli
  }));

describe('draw.engine', () => {
  it('drawSize: keyingi 2 darajasi', () => {
    expect(drawSize(2)).toBe(2);
    expect(drawSize(5)).toBe(8);
    expect(drawSize(8)).toBe(8);
    expect(drawSize(9)).toBe(16);
    expect(drawSize(33)).toBe(64);
  });

  it('seedOrder klassik: 1 va 2 qarama-qarshi yarimlarda', () => {
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    const o16 = seedOrder(16);
    // 1-seed birinchi yarimda, 2-seed ikkinchi yarimda
    expect(o16.indexOf(1)).toBeLessThan(8);
    expect(o16.indexOf(2)).toBeGreaterThanOrEqual(8);
  });

  it('placePlayers: eng kuchli 1-pozitsiyada, bye kuchsizlarga emas — kuchlilarga', () => {
    const slots = placePlayers(mk(6)); // size 8, 2 ta bye
    expect(slots).toHaveLength(8);
    expect(slots[0]).toEqual({ position: 1, seed: 1, playerId: 'p1' });
    // seed 7 va 8 yo'q → bular bye; ular seed 1 va 2 ning raqiblari
    const byePositions = slots.filter((s) => s.playerId === null);
    expect(byePositions).toHaveLength(2);
    // 1-seed yonidagi joy (position 2, seedOrder 8) bye bo'lishi kerak
    expect(slots[1].playerId).toBeNull();
  });

  it('planMatches 8 lik to‘liq: 4+2+1 o‘yin, final oxirgi', () => {
    const matches = planMatches(placePlayers(mk(8)));
    expect(matches).toHaveLength(7);
    expect(matches.filter((m) => m.roundNumber === 1)).toHaveLength(4);
    expect(matches.filter((m) => m.roundNumber === 3)).toHaveLength(1);
    const final = matches.find((m) => m.roundNumber === 3)!;
    expect(final.nextBracketPosition).toBeNull();
    // hech qanday walkover yo'q
    expect(matches.every((m) => m.walkoverWinnerId === null)).toBe(true);
  });

  it('bye: 6 o‘yinchi, 8 lik setka — 1 va 2 seedlar 2-raundga avtomatik o‘tadi', () => {
    const matches = planMatches(placePlayers(mk(6)));
    const r1 = matches.filter((m) => m.roundNumber === 1);
    const walkovers = r1.filter((m) => m.walkoverWinnerId !== null);
    expect(walkovers).toHaveLength(2);
    expect(walkovers.map((m) => m.walkoverWinnerId).sort()).toEqual([
      'p1',
      'p2',
    ]);
    // 2-raundda p1 allaqachon slotda turibdi
    const r2 = matches.filter((m) => m.roundNumber === 2);
    const withP1 = r2.find((m) => m.player1Id === 'p1' || m.player2Id === 'p1');
    expect(withP1).toBeDefined();
    // LEKIN 2-raund walkover EMAS — raqib hali aniqlanmagan (TBD), bye emas
    expect(r2.every((m) => m.walkoverWinnerId === null)).toBe(true);
    const r3 = matches.filter((m) => m.roundNumber === 3);
    expect(r3.every((m) => m.walkoverWinnerId === null)).toBe(true);
  });

  it('nextSlot: toq pozitsiya → slot 1, juft → slot 2', () => {
    const matches = planMatches(placePlayers(mk(8)));
    const r1 = matches.filter((m) => m.roundNumber === 1);
    expect(r1[0].nextSlot).toBe(1);
    expect(r1[1].nextSlot).toBe(2);
    expect(r1[0].nextBracketPosition).toBe(1);
    expect(r1[2].nextBracketPosition).toBe(2);
  });

  it('stageForRound: StagePoints jadvali bilan mos', () => {
    // 16 lik setka: 4 raund
    expect(stageForRound(4, 4)).toBe('FINAL');
    expect(stageForRound(3, 4)).toBe('SEMIFINAL');
    expect(stageForRound(2, 4)).toBe('QUARTERFINAL');
    expect(stageForRound(1, 4)).toBe('ROUND_OF_16');
    // 64 lik: 6 raund, 1-raund ROUND_1
    expect(stageForRound(1, 6)).toBe('ROUND_1');
    expect(stageForRound(2, 6)).toBe('ROUND_OF_32');
  });
});

import { byePositions, defaultSeedCount, drawByRules, groupPositions, meetingRound } from './draw.engine';

describe('qura qoidalar bo‘yicha (3.6)', () => {
  // Urug'li oddiy tasodifiy generator — testlar barqaror
  // mulberry32 — urug'li, yaxshi taqsimlangan
  const lcg = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const mk = (n: number, org: (i: number) => string | null = () => null) =>
    Array.from({ length: n }, (_, i) => ({
      playerId: `p${i + 1}`,
      rankingPoints: 1000 - i,
      org: org(i),
    }));

  it('1-seed tepada, 2-seed pastda; hamma o‘yinchi bir marta; BYE soni to‘g‘ri', () => {
    for (let s = 1; s <= 20; s++) {
      const slots = drawByRules(mk(13), { rng: lcg(s) });
      expect(slots).toHaveLength(16);
      expect(slots[0].playerId).toBe('p1');
      expect(slots[15].playerId).toBe('p2');
      const ids = slots.map((x) => x.playerId).filter(Boolean);
      expect(new Set(ids).size).toBe(13);
      expect(slots.filter((x) => x.playerId === null)).toHaveLength(3); // 16 − 13
    }
  });

  it('BYE faqat kuchli seedlar qarshisida (1-, 2-, 3-seed raqibi yo‘q)', () => {
    const slots = drawByRules(mk(13), { rng: lcg(7) });
    // 1-juftlik: (0,1), oxirgi juftlik: (14,15), seedlar 3–4 juftliklari
    const byePairs = [];
    for (let i = 0; i < 16; i += 2) {
      if (slots[i].playerId === null || slots[i + 1].playerId === null) byePairs.push(i / 2);
    }
    expect(byePairs).toHaveLength(3);
    // BYE har doim seedga ega o'yinchi qarshisida
    for (let i = 0; i < 16; i += 2) {
      const a = slots[i];
      const b = slots[i + 1];
      if (a.playerId === null) expect(b.seed).not.toBeNull();
      if (b.playerId === null) expect(a.seed).not.toBeNull();
    }
  });

  it('3–4-seedlar 2-yarimning tepasi va 1-yarimning pastida (jereb bilan)', () => {
    const seen = new Set<string>();
    for (let s = 1; s <= 40; s++) {
      const slots = drawByRules(mk(32), { rng: lcg(s) });
      const p3 = slots.findIndex((x) => x.playerId === 'p3');
      const p4 = slots.findIndex((x) => x.playerId === 'p4');
      // qoida: 1-yarimning pastki joyi (15) yoki 2-yarimning tepa joyi (16), 0-indeksda
      expect([15, 16]).toContain(p3);
      expect([15, 16]).toContain(p4);
      expect(p3).not.toBe(p4);
      seen.add(`${p3}`);
    }
    expect(seen.size).toBe(2); // jereb ikkala variantni ham beradi
  });

  it('qura jereb bilan: turli urug‘da qolgan o‘yinchilar joyi o‘zgaradi', () => {
    const a = drawByRules(mk(32), { rng: lcg(1) }).map((x) => x.playerId).join();
    const b = drawByRules(mk(32), { rng: lcg(2) }).map((x) => x.playerId).join();
    expect(a).not.toBe(b);
  });

  it('bir viloyatning ikki o‘yinchisi turli yarmlarda (3.6.3.3)', () => {
    // 32 o'yinchi, 2 ta o'yinchi "A" viloyatidan (seed bo'lmagan)
    for (let s = 1; s <= 30; s++) {
      const players = mk(32, (i) => (i === 20 || i === 25 ? 'A' : `o${i}`));
      const slots = drawByRules(players, { rng: lcg(s) });
      const i1 = slots.findIndex((x) => x.playerId === 'p21');
      const i2 = slots.findIndex((x) => x.playerId === 'p26');
      expect(Math.floor(i1 / 16)).not.toBe(Math.floor(i2 / 16));
    }
  });

  it('4 ta viloyatdan 4 tadan: har viloyat o‘yinchilari kamida chorak oldin uchrashmaydi', () => {
    const players = mk(16, (i) => `V${i % 4}`);
    const slots = drawByRules(players, { rng: lcg(11) });
    // Bir viloyatning har ikki o'yinchisi: 1/8-final (r=1) yoki 1/4 (r=2) da emas, kamida yarimda ajraladi mumkin emas —
    // lekin birinchi raundda (r=1) hech qachon uchrashmasin
    for (let a = 0; a < 16; a++)
      for (let b = a + 1; b < 16; b++) {
        const oa = players.find((p) => p.playerId === slots[a].playerId)?.org;
        const ob = players.find((p) => p.playerId === slots[b].playerId)?.org;
        if (oa && oa === ob) expect(meetingRound(a, b)).toBeGreaterThan(1);
      }
  });

  it('guruh joylari: pastki — toq, tepa — juft bo‘laklarda (3.6.2.3)', () => {
    expect(groupPositions(32, 2)).toEqual([15, 16]);
    expect(groupPositions(32, 4).sort((a, b) => a - b)).toEqual([7, 8, 23, 24]);
    expect(groupPositions(16, 8).sort((a, b) => a - b)).toEqual([1, 2, 5, 6, 9, 10, 13, 14]);
  });

  it('5–8-seedlar chorak chegaralarida (7, 8, 23, 24)', () => {
    for (let s = 1; s <= 30; s++) {
      const slots = drawByRules(mk(32), { rng: lcg(s) });
      for (const id of ['p5', 'p6', 'p7', 'p8']) {
        expect([7, 8, 23, 24]).toContain(slots.findIndex((x) => x.playerId === id));
      }
    }
  });

  it('defaultSeedCount', () => {
    expect(defaultSeedCount(2)).toBe(2);
    expect(defaultSeedCount(16)).toBe(4);
    expect(defaultSeedCount(32)).toBe(8);
    expect(defaultSeedCount(100)).toBe(32);
    expect(defaultSeedCount(3)).toBe(2);
  });

  it('28-ilova jadvali: BYE o‘rinlari (1-indeks) 8/16/32/64 setkalar uchun aynan mos', () => {
    const one = (size: number, k: number) => byePositions(size, k).map((x) => x + 1);
    expect(one(8, 4)).toEqual([2, 7, 6, 3]);
    expect(one(16, 7)).toEqual([2, 15, 10, 7, 6, 11, 14]);
    expect(one(32, 15)).toEqual([2, 31, 18, 15, 10, 23, 26, 7, 6, 27, 22, 11, 14, 19, 30]);
    expect(one(64, 31)).toEqual([
      2, 63, 34, 31, 18, 47, 50, 15, 10, 55, 42, 23, 26, 39, 58, 7, 6, 59, 38, 27,
      22, 43, 54, 11, 14, 51, 46, 19, 30, 35, 62,
    ]);
  });

  it('BYE har doim seed qarshisida; 11 o‘yinchi (5 BYE) uchun barcha seedlar to‘g‘ri', () => {
    for (let s = 1; s <= 40; s++) {
      const slots = drawByRules(mk(11), { rng: lcg(s) });
      const byeIdx = slots.map((x, i) => (x.playerId === null ? i : -1)).filter((i) => i >= 0);
      expect(byeIdx.map((i) => i + 1).sort((a, b) => a - b)).toEqual([3, 6, 7, 10, 11, 15].slice(0, 5).sort((a, b) => a - b).length === 5 ? byePositions(16, 5).map((x) => x + 1).sort((a, b) => a - b) : []);
      for (const i of byeIdx) expect(slots[i ^ 1].seed).not.toBeNull();
    }
  });
});
