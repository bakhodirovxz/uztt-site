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
