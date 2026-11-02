import { planReplay } from './replay-plan';

describe('planReplay (scoreboard natijasini oldindan o\'ynash)', () => {
  it('to\'liq 3-0 natija qabul qilinadi', () => {
    const p = planReplay([[11, 7], [11, 9], [11, 5]], 5);
    expect(p.ok).toBe(true);
    if (p.ok) {
      expect(p.winnerSlot).toBe(1);
      expect(p.order.length).toBe(11 + 7 + 11 + 9 + 11 + 5);
    }
  });

  it('deuce geymlari (12-10, 13-15) to\'g\'ri o\'ynaladi', () => {
    const p = planReplay([[12, 10], [13, 15], [11, 3], [9, 11], [11, 8]], 5);
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.winnerSlot).toBe(1);
  });

  it('yakunlanmagan hal qiluvchi geym (5-3) rad etiladi', () => {
    expect(planReplay([[11, 5], [5, 11], [11, 7], [7, 11], [5, 3]], 5).ok).toBe(false);
  });

  it('o\'yin tugamagan bo\'lsa (2-0, bestOf 5) rad etiladi', () => {
    const p = planReplay([[11, 5], [11, 7]], 5);
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.reason).toMatch(/yakunlanmagan/);
  });

  it('qoidaga zid geym hisoblari rad etiladi (11-10, 15-3, 0-0, 7-7)', () => {
    for (const bad of [[11, 10], [15, 3], [0, 0], [7, 7]]) {
      expect(planReplay([bad, [11, 0], [11, 0]], 5).ok).toBe(false);
    }
  });

  it('o\'yin tugagach ortiqcha geym rad etiladi', () => {
    expect(planReplay([[11, 1], [11, 1], [11, 1], [11, 1]], 5).ok).toBe(false);
  });

  it('noto\'g\'ri shakl rad etiladi', () => {
    expect(planReplay([], 5).ok).toBe(false);
    expect(planReplay('x', 5).ok).toBe(false);
    expect(planReplay([[11, -1]], 5).ok).toBe(false);
    expect(planReplay([[11.5, 3]], 5).ok).toBe(false);
  });

  it('bestOf 3: 2-1 natija qabul qilinadi', () => {
    const p = planReplay([[11, 9], [8, 11], [11, 6]], 3);
    expect(p.ok).toBe(true);
  });
});
