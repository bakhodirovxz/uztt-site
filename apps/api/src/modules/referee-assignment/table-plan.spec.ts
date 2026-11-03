import { planTables, PlanMatch } from './table-plan';

const match = (id: string, rating = 0, stage = 'GROUP', table: number | null = null): PlanMatch => ({ id, stage, rating, table });

describe('planTables', () => {
  it('yarim final va final faqat asosiy stolga tushadi', () => {
    const plan = planTables(
      [match('a', 0, 'FINAL'), match('b', 0, 'SEMIFINAL'), match('c', 0, 'SEMIFINAL')],
      { tableCount: 4, mainTables: [1, 2] },
    );
    expect([...plan.values()].every((t) => t === 1 || t === 2)).toBe(true);
  });

  it('reytingi baland o\'yinlar asosiy stolga, qolgani oddiy stollarga', () => {
    const plan = planTables(
      [match('past1', 10), match('past2', 20), match('past3', 30), match('zor', 900)],
      { tableCount: 4, mainTables: [1] },
    );
    expect(plan.get('zor')).toBe(1);
    expect(plan.get('past1')).not.toBe(1);
    expect(plan.get('past2')).not.toBe(1);
    expect(plan.get('past3')).not.toBe(1);
  });

  it('asosiy stol belgilanmagan bo\'lsa o\'yinlar teng bo\'linadi', () => {
    const plan = planTables([match('a'), match('b'), match('c'), match('d')], { tableCount: 2, mainTables: [] });
    const count = (t: number) => [...plan.values()].filter((x) => x === t).length;
    expect(count(1)).toBe(2);
    expect(count(2)).toBe(2);
  });

  it('stoli bor o\'yinga tegmaydi va uni yukda hisobga oladi', () => {
    const plan = planTables(
      [match('bor1', 0, 'GROUP', 1), match('bor2', 0, 'GROUP', 1), match('yangi')],
      { tableCount: 2, mainTables: [] },
    );
    expect(plan.has('bor1')).toBe(false);
    expect(plan.get('yangi')).toBe(2);
  });

  it('hamma stol asosiy bo\'lsa ham ishlaydi', () => {
    const plan = planTables([match('a', 5), match('b', 0, 'FINAL')], { tableCount: 2, mainTables: [1, 2] });
    expect(plan.size).toBe(2);
  });

  it('diapazondan tashqari asosiy stol e\'tiborga olinmaydi', () => {
    const plan = planTables([match('a', 0, 'FINAL')], { tableCount: 2, mainTables: [9] });
    expect([1, 2]).toContain(plan.get('a'));
  });
});
