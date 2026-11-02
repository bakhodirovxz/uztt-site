import {
  olympicMaxTwoMatches,
  olympicOrder,
  pairOrg,
  pairRating,
  teamMatchOrder,
  teamMatchStatus,
  teamRating,
  validateTeamSize,
} from './team.engine';

const fmt = (o: ReturnType<typeof teamMatchOrder>) =>
  o.map((x) => (x.kind === 'single' ? `${x.home[0]}-${x.away[0]}` : `${x.home.join('&')}~${x.away.join('&')}`)).join(' ');

describe('jamoaviy tizimlar (4.3)', () => {
  it('4.3.1 o‘zgartirilgan Sveytling: A–X B–Y C–Z A–Y B–X', () => {
    expect(fmt(teamMatchOrder('SWAYTHLING_MODIFIED'))).toBe('A-X B-Y C-Z A-Y B-X');
  });
  it('4.3.2 Korbilon: A–X B–Y juft A–Y B–X', () => {
    expect(fmt(teamMatchOrder('CORBILLON', { doubles: { home: ['A', 'B'], away: ['X', 'Y'] } }))).toBe('A-X B-Y A&B~X&Y A-Y B-X');
  });
  it('4.3.3 olimpiya: juftlikda C&A vs Z&X → 4) B–Z, 5) C–Y; har kim ≤ 2 uchrashuv', () => {
    const o = olympicOrder('A', 'X');
    expect(fmt(o)).toBe('A-X B-Y C&A~Z&X B-Z C-Y');
    expect(olympicMaxTwoMatches(o)).toBe(true);
    expect(fmt(olympicOrder('B', 'Y'))).toBe('A-X B-Y C&B~Z&Y A-Z C-X');
    for (const h of ['A', 'B'] as const) for (const a of ['X', 'Y'] as const) expect(olympicMaxTwoMatches(olympicOrder(h, a))).toBe(true);
    expect(() => teamMatchOrder('OLYMPIC')).toThrow();
  });
  it('4.3.4 Evans: 7 uchrashuv, 4-juft', () => {
    const o = teamMatchOrder('EVANS', { doubles: { home: ['A', 'B'], away: ['X', 'Y'] } });
    expect(o).toHaveLength(7);
    expect(o[3].kind).toBe('double');
    expect(fmt(o)).toBe('A-Y B-X C-Z A&B~X&Y A-X C-Y B-Z');
  });
  it('4.3.5 avvalgi Sveytling: 9 yakka', () => {
    expect(fmt(teamMatchOrder('SWAYTHLING_OLD'))).toBe('A-X B-Y C-Z B-X A-Z C-Y B-Z C-X A-Y');
  });
  it('4.3.6 zamonaviy Sveytling: A–Y B–X C–Z A–X B–Y', () => {
    expect(fmt(teamMatchOrder('SWAYTHLING_MODERN'))).toBe('A-Y B-X C-Z A-X B-Y');
  });
  it('g‘olib — uchrashuvlarning ko‘pchiligini yutgan (3/5, 4/7, 5/9)', () => {
    expect(teamMatchStatus('SWAYTHLING_MODIFIED', 2, 2)).toMatchObject({ finished: false, needed: 3 });
    expect(teamMatchStatus('SWAYTHLING_MODIFIED', 3, 1)).toMatchObject({ finished: true, winner: 'home' });
    expect(teamMatchStatus('EVANS', 3, 3)).toMatchObject({ finished: false, needed: 4 });
    expect(teamMatchStatus('EVANS', 3, 4)).toMatchObject({ finished: true, winner: 'away' });
    expect(teamMatchStatus('SWAYTHLING_OLD', 5, 2)).toMatchObject({ finished: true, winner: 'home' });
  });
  it('jamoa hajmi: 3–5 / Korbilon 2–4', () => {
    expect(validateTeamSize('SWAYTHLING_MODIFIED', 2)).toBe(false);
    expect(validateTeamSize('SWAYTHLING_MODIFIED', 5)).toBe(true);
    expect(validateTeamSize('CORBILLON', 2)).toBe(true);
    expect(validateTeamSize('CORBILLON', 5)).toBe(false);
  });
  it('jamoa reytingi — minimal kerakli sondagi eng kuchlilar yig‘indisi; juft — yig‘indi', () => {
    expect(teamRating('SWAYTHLING_MODIFIED', [100, 300, 200, 50])).toBe(600);
    expect(teamRating('CORBILLON', [100, 300, 200, 50])).toBe(500);
    expect(pairRating(120, 80)).toBe(200);
  });
  it('juft tashkiloti: kuchliroq o‘yinchi; aralashda — erkak', () => {
    expect(pairOrg({ org: 'A', rating: 50 }, { org: 'B', rating: 90 })).toBe('B');
    expect(pairOrg({ org: 'A', rating: 90, male: false }, { org: 'B', rating: 50, male: true }, true)).toBe('B');
  });
});
