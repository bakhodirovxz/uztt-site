import {
  finalRating,
  loserMatchPoints,
  matchExactPoints,
  penaltyPoints,
  placeBonus,
  placeFromExit,
  toWholePoints,
  tournamentK,
  winnerMatchPoints,
  wholeDelta,
} from './rating.engine';

describe('rasmiy reyting (Nizom)', () => {
  it('2-formula: ҒРБ = (100 − (ҒР − ЮР)) / 10', () => {
    expect(winnerMatchPoints(650, 600)).toBe(5); // farq 50
    expect(winnerMatchPoints(600, 640)).toBe(14); // kuchsiz g'olib: farq −40
    expect(winnerMatchPoints(700, 600)).toBe(0); // farq aynan 100 → 0 ball
    expect(winnerMatchPoints(701, 600)).toBe(0); // farq > 100 → ball yo'q
  });

  it('3-formula: ЮРБ = −(100 − (ҒР − ЮР)) / 20', () => {
    expect(loserMatchPoints(650, 600)).toBe(-2.5);
    expect(loserMatchPoints(600, 640)).toBe(-7);
  });

  it('mag‘lub hech qachon ball ortirmaydi (farq > 100)', () => {
    expect(loserMatchPoints(750, 600)).toBe(0);
  });

  it('20-band: reytinglar teng bo‘lsa +10 / −10', () => {
    expect(winnerMatchPoints(500, 500)).toBe(10);
    expect(loserMatchPoints(500, 500)).toBe(-10);
  });

  it('21-band: texnik g‘alabada ball yo‘q', () => {
    expect(
      matchExactPoints({ winnerRating: 500, loserRating: 500, k: 1, technical: true }),
    ).toEqual({ winner: 0, loser: 0 });
  });

  it('1-ilova: K yosh bo‘yicha', () => {
    expect(tournamentK(1.0, 'SENIOR')).toBe(1.0);
    expect(tournamentK(1.0, 'U19')).toBe(0.8);
    expect(tournamentK(1.0, 'U13')).toBe(0.2);
    expect(tournamentK(0.9, 'U15')).toBe(0.3);
    expect(tournamentK(0.9, 'U11')).toBe(0.1);
    expect(tournamentK(0.5, 'U17')).toBe(0.3);
    expect(tournamentK(0.5, 'U13')).toBe(0.1);
    expect(tournamentK(0.7, 'U13')).toBe(0.7); // pro-tur: Komissiya belgilagan K
    expect(tournamentK(2.5, null)).toBe(1); // 0.1…1 oralig'iga keltiriladi
  });

  it('2-ilova: o‘rin bonuslari', () => {
    expect(placeBonus(1, 1.0)).toBe(50);
    expect(placeBonus(1, 0.9)).toBe(45);
    expect(placeBonus(2, 0.1)).toBe(3);
    expect(placeBonus(3, 0.3)).toBe(8);
    expect(placeBonus(5, 0.5)).toBe(5);
    expect(placeBonus(8, 1.0)).toBe(15);
    expect(placeBonus(9, 1.0)).toBe(0);
    expect(placeBonus(1, 0.8)).toBe(40);
    expect(penaltyPoints(1.0)).toBe(50);
    expect(penaltyPoints(0.1)).toBe(5);
  });

  it('1-formula: Р = ЖР + К·МРБ − Ж + Б, butun va ≥ 0', () => {
    expect(finalRating({ current: 100, k: 1, mrb: 12.4, bonus: 50 })).toBe(162);
    expect(finalRating({ current: 100, k: 0.5, mrb: 15, penalty: 0 })).toBe(108); // 107.5 → 108
    expect(finalRating({ current: 10, k: 1, mrb: -40 })).toBe(0); // minus bo'lmaydi
    expect(finalRating({ current: 59.2, k: 1, mrb: 0 })).toBe(59);
    expect(toWholePoints(59.5)).toBe(60);
  });

  it('yaxlitlash yig‘indiga qo‘llanadi (xato yig‘ilmaydi)', () => {
    // 3 o'yin × 2.5 ball: alohida yaxlitlansa 3+3+3=9 (ortiqcha), yig'indi bo'yicha 8 (7.5 → 8)
    let whole = 0;
    let exact = 0;
    for (let i = 0; i < 3; i++) {
      exact += 2.5;
      whole += wholeDelta({ exactTotalAfter: exact, wholeSoFar: whole });
    }
    expect(whole).toBe(8);
  });

  it('o‘rin bosqichdan: final/yarim/chorak', () => {
    expect(placeFromExit('FINAL', true)).toBe(1);
    expect(placeFromExit('FINAL', false)).toBe(2);
    expect(placeFromExit('SEMIFINAL', false)).toBe(3);
    expect(placeFromExit('QUARTERFINAL', false)).toBe(5);
    expect(placeFromExit('SEMIFINAL', true)).toBeNull();
    expect(placeFromExit('ROUND_OF_16', false)).toBeNull();
  });
});
