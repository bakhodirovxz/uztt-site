import { MatchStage, PointRuleKey } from '@prisma/client';
import { awardsForMatch, POINT_RULE_KEYS, RULE_LABEL_UZ } from './level-rules';

const rules = (entries: Partial<Record<PointRuleKey, number>>) =>
  new Map(Object.entries(entries) as Array<[PointRuleKey, number]>);

/** Respublika chempionati reglamenti (seed qiymatlari) */
const NATIONAL = rules({
  PARTICIPATION: 100,
  GROUP_ADVANCE: 300,
  WIN: 500,
  CHAMPION: 2100,
});

describe('daraja reglamenti bo‘yicha ball berish', () => {
  it('har bir g‘alaba uchun ball beradi (guruhda ham, setkada ham)', () => {
    for (const stage of [
      MatchStage.GROUP,
      MatchStage.ROUND_1,
      MatchStage.QUARTERFINAL,
      MatchStage.SEMIFINAL,
    ]) {
      const awards = awardsForMatch({
        stage,
        winnerId: 'a',
        loserId: 'b',
        rules: NATIONAL,
        fallbackPoints: 0,
      });
      expect(awards).toEqual([
        { playerId: 'a', key: PointRuleKey.WIN, points: 500 },
      ]);
    }
  });

  it('final g‘olibi g‘alaba ustiga chempionlik ballini oladi', () => {
    const awards = awardsForMatch({
      stage: MatchStage.FINAL,
      winnerId: 'a',
      loserId: 'b',
      rules: NATIONAL,
      fallbackPoints: 0,
    });
    const total = awards.reduce((s, x) => s + x.points, 0);
    expect(total).toBe(500 + 2100);
    // Mag'lub finalda ball olmaydi — faqat g'alaba va chempionlik hisoblanadi
    expect(awards.every((x) => x.playerId === 'a')).toBe(true);
  });

  it('ishtirok balli birinchi o‘yinda ikkala tomonga beriladi', () => {
    const awards = awardsForMatch({
      stage: MatchStage.ROUND_1,
      winnerId: 'a',
      loserId: 'b',
      newParticipants: ['a', 'b'],
      rules: NATIONAL,
      fallbackPoints: 0,
    });
    const byPlayer = (id: string) =>
      awards.filter((x) => x.playerId === id).reduce((s, x) => s + x.points, 0);

    expect(byPlayer('a')).toBe(100 + 500); // ishtirok + g'alaba
    expect(byPlayer('b')).toBe(100); // faqat ishtirok
  });

  it('keyingi o‘yinlarda ishtirok balli takrorlanmaydi', () => {
    const awards = awardsForMatch({
      stage: MatchStage.QUARTERFINAL,
      winnerId: 'a',
      loserId: 'b',
      newParticipants: [], // ikkalasi ham allaqachon olgan
      rules: NATIONAL,
      fallbackPoints: 0,
    });
    expect(awards).toEqual([
      { playerId: 'a', key: PointRuleKey.WIN, points: 500 },
    ]);
  });

  it('reglamentda ball 0 bo‘lsa yozuv yaratilmaydi', () => {
    const awards = awardsForMatch({
      stage: MatchStage.FINAL,
      winnerId: 'a',
      loserId: 'b',
      newParticipants: ['a', 'b'],
      rules: rules({ PARTICIPATION: 0, WIN: 0, CHAMPION: 1000 }),
      fallbackPoints: 0,
    });
    expect(awards).toEqual([
      { playerId: 'a', key: PointRuleKey.CHAMPION, points: 1000 },
    ]);
  });

  it('reglamentsiz daraja eski hisobga qaytadi (bosqich × koeffitsiyent)', () => {
    const awards = awardsForMatch({
      stage: MatchStage.SEMIFINAL,
      winnerId: 'a',
      loserId: 'b',
      rules: new Map(),
      fallbackPoints: 1350,
    });
    expect(awards).toEqual([
      { playerId: 'a', key: PointRuleKey.WIN, points: 1350 },
    ]);
  });

  it('reglament to‘rtta qiymatdan iborat va hammasi nomlangan', () => {
    expect(POINT_RULE_KEYS).toEqual([
      'PARTICIPATION',
      'GROUP_ADVANCE',
      'WIN',
      'CHAMPION',
    ]);
    for (const key of POINT_RULE_KEYS) {
      expect(RULE_LABEL_UZ[key]).toBeTruthy();
    }
  });
});
