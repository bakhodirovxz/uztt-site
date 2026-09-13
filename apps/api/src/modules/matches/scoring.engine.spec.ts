import {
  applyDisqualification,
  applyPoint,
  initialState,
  isSetWon,
  pointAlert,
  serverSlot,
  setsToWin,
  type ScoreState,
} from './scoring.engine';

/** p1 uchun n ochko, p2 uchun m ochko ketma-ket kiritish yordamchisi */
function score(state: ScoreState, p1Points: number, p2Points: number) {
  const s = state;
  // aralashtirib kiritamiz — real o'yinga yaqinroq
  const seq: Array<1 | 2> = [];
  for (let i = 0; i < Math.max(p1Points, p2Points); i++) {
    if (i < p1Points) seq.push(1);
    if (i < p2Points) seq.push(2);
  }
  let last = { state: s, setFinished: false, matchFinished: false };
  for (const p of seq) {
    last = applyPoint(last.state, p);
  }
  return last;
}

describe('scoring.engine (legacy spec porti)', () => {
  it('birinchi ochko SCHEDULED → LIVE qiladi', () => {
    const r = applyPoint(initialState(), 1);
    expect(r.state.status).toBe('LIVE');
    expect(r.state.currentSet).toEqual({ p1: 1, p2: 0 });
  });

  it('11-0 — set tugaydi, hisob 0-0 ga qaytadi', () => {
    const r = score(initialState(), 11, 0);
    expect(r.setFinished).toBe(true);
    expect(r.state.player1SetsWon).toBe(1);
    expect(r.state.sets).toEqual([{ p1: 11, p2: 0 }]);
    expect(r.state.currentSet).toEqual({ p1: 0, p2: 0 });
  });

  it('11-10 set TUGAMAYDI (2 ochko farq shart) — deuce', () => {
    let s = initialState();
    // 10-10 gacha
    for (let i = 0; i < 10; i++) {
      s = applyPoint(s, 1).state;
      s = applyPoint(s, 2).state;
    }
    expect(s.currentSet).toEqual({ p1: 10, p2: 10 });
    const r = applyPoint(s, 1); // 11-10
    expect(r.setFinished).toBe(false);
    expect(r.state.currentSet).toEqual({ p1: 11, p2: 10 });
  });

  it('deuce holatida 12-10 set tugaydi', () => {
    let s = initialState();
    for (let i = 0; i < 10; i++) {
      s = applyPoint(s, 1).state;
      s = applyPoint(s, 2).state;
    }
    s = applyPoint(s, 1).state; // 11-10
    const r = applyPoint(s, 1); // 12-10
    expect(r.setFinished).toBe(true);
    expect(r.state.sets).toEqual([{ p1: 12, p2: 10 }]);
  });

  it('uzoq deuce: 15-13 ham ishlaydi', () => {
    let s = initialState();
    for (let i = 0; i < 13; i++) {
      s = applyPoint(s, 1).state;
      s = applyPoint(s, 2).state;
    } // 13-13
    s = applyPoint(s, 1).state; // 14-13 — set tugamagan
    expect(s.sets).toHaveLength(0);
    const r = applyPoint(s, 1); // 15-13
    expect(r.setFinished).toBe(true);
  });

  it('bestOf=5: 3 set olgan tomon yutadi, match FINISHED', () => {
    let last = score(initialState(5), 11, 0);
    last = score(last.state, 11, 3);
    expect(last.matchFinished).toBe(false);
    last = score(last.state, 11, 5);
    expect(last.matchFinished).toBe(true);
    expect(last.state.status).toBe('FINISHED');
    expect(last.state.winnerSlot).toBe(1);
    expect(last.state.player1SetsWon).toBe(3);
  });

  it('bestOf=7: 4 set kerak', () => {
    expect(setsToWin(7)).toBe(4);
    expect(setsToWin(5)).toBe(3);
    expect(setsToWin(3)).toBe(2);
  });

  it("aralash setlar: 2-o'yinchi 3-1 yutadi", () => {
    let last = score(initialState(5), 11, 7); // p1 seti
    last = score(last.state, 4, 11);
    last = score(last.state, 9, 11);
    last = score(last.state, 5, 11);
    expect(last.matchFinished).toBe(true);
    expect(last.state.winnerSlot).toBe(2);
    expect(last.state.player2SetsWon).toBe(3);
    expect(last.state.player1SetsWon).toBe(1);
  });

  it('FINISHED holatda ochko kiritish xato beradi', () => {
    const done = score(
      score(score(initialState(5), 11, 0).state, 11, 0).state,
      11,
      0,
    );
    expect(done.matchFinished).toBe(true);
    expect(() => applyPoint(done.state, 1)).toThrow();
  });

  it('diskvalifikatsiya: raqib yutadi, darhol FINISHED', () => {
    const s = score(initialState(), 5, 3).state; // o'yin o'rtasida
    const dq = applyDisqualification(s, 1);
    expect(dq.status).toBe('FINISHED');
    expect(dq.winnerSlot).toBe(2);
  });

  it('podacha: har 2 ochkoda almashadi', () => {
    const s = initialState();
    // 0-0 va 1-0 da 1-o'yinchi, 2-0 va 2-1 da 2-o'yinchi...
    const at = (p1: number, p2: number): 1 | 2 =>
      serverSlot({ ...s, currentSet: { p1, p2 } });
    expect(at(0, 0)).toBe(1);
    expect(at(1, 0)).toBe(1);
    expect(at(1, 1)).toBe(2);
    expect(at(2, 1)).toBe(2);
    expect(at(2, 2)).toBe(1);
    // jami 8-9 ochko → 5-blok 1-o'yinchida; 10-11 → 2-o'yinchida
    expect(at(5, 3)).toBe(1); // jami 8
    expect(at(5, 4)).toBe(1); // jami 9 — hali o'sha blok
    expect(at(6, 4)).toBe(2); // jami 10 — yangi blok
    expect(at(6, 5)).toBe(2); // jami 11
  });

  it('podacha: deuce (10-10) dan keyin har ochkoda almashadi', () => {
    const s = initialState();
    const at = (p1: number, p2: number): 1 | 2 =>
      serverSlot({ ...s, currentSet: { p1, p2 } });
    expect(at(10, 10)).toBe(1);
    expect(at(11, 10)).toBe(2);
    expect(at(11, 11)).toBe(1);
    expect(at(12, 11)).toBe(2);
  });

  it('podacha: har setda boshlovchi almashadi', () => {
    const base = initialState();
    const set1 = serverSlot({
      ...base,
      currentSet: { p1: 0, p2: 0 },
      sets: [],
    });
    const set2 = serverSlot({
      ...base,
      currentSet: { p1: 0, p2: 0 },
      sets: [{ p1: 11, p2: 5 }],
    });
    expect(set1).toBe(1);
    expect(set2).toBe(2);
  });

  it('podacha: firstServer=2 bo`lsa teskari', () => {
    const s = initialState();
    expect(serverSlot({ ...s, currentSet: { p1: 0, p2: 0 } }, 2)).toBe(2);
    expect(serverSlot({ ...s, currentSet: { p1: 1, p2: 1 } }, 2)).toBe(1);
  });

  it('setpoint: 10-9 da 1-o`yinchida, 10-10 da hech kimda', () => {
    const s = initialState();
    expect(pointAlert({ ...s, currentSet: { p1: 10, p2: 9 } })).toEqual({
      player: 1,
      isMatchPoint: false,
    });
    expect(pointAlert({ ...s, currentSet: { p1: 10, p2: 10 } })).toBeNull();
    expect(pointAlert({ ...s, currentSet: { p1: 9, p2: 10 } })).toEqual({
      player: 2,
      isMatchPoint: false,
    });
    // deuce'dan keyin ham ishlaydi
    expect(pointAlert({ ...s, currentSet: { p1: 12, p2: 11 } })?.player).toBe(
      1,
    );
  });

  it('matchpoint: oxirgi setni yutish arafasida', () => {
    const s = initialState(5);
    // bestOf 5 → 3 set kerak; 2 set olgan o'yinchida setpoint = matchpoint
    expect(
      pointAlert({
        ...s,
        currentSet: { p1: 10, p2: 4 },
        player1SetsWon: 2,
      }),
    ).toEqual({ player: 1, isMatchPoint: true });
    // 1 set olgan bo'lsa — oddiy setpoint
    expect(
      pointAlert({
        ...s,
        currentSet: { p1: 10, p2: 4 },
        player1SetsWon: 1,
      })?.isMatchPoint,
    ).toBe(false);
  });

  it('tugagan o`yinda alert yo`q', () => {
    const s = initialState();
    expect(
      pointAlert({ ...s, status: 'FINISHED', currentSet: { p1: 10, p2: 4 } }),
    ).toBeNull();
  });

  it('isSetWon chegara holatlari', () => {
    expect(isSetWon({ p1: 11, p2: 9 })).toBe(true);
    expect(isSetWon({ p1: 11, p2: 10 })).toBe(false);
    expect(isSetWon({ p1: 10, p2: 12 })).toBe(true);
    expect(isSetWon({ p1: 10, p2: 10 })).toBe(false);
  });
});
