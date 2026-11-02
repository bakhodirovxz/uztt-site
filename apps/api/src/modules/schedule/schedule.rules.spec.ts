import { ageGroupOf, knockoutMatchCount, matchLimits, matchMinutes, requiredTables } from './schedule.rules';

describe('rejalashtirish me‘yorlari (4.5.3–4.5.4)', () => {
  it('uchrashuv davomiyligi', () => {
    expect(matchMinutes(5)).toBe(30);
    expect(matchMinutes(3)).toBe(30);
    expect(matchMinutes(7)).toBe(45);
  });
  it('kunlik / smenadagi cheklov', () => {
    expect(matchLimits('YOUTH', 5)).toEqual({ perDay: 7, perShift: 4 });
    expect(matchLimits('YOUTH', 7)).toEqual({ perDay: 5, perShift: 3 });
    expect(matchLimits('JUNIOR', 5)).toEqual({ perDay: 8, perShift: 5 });
    expect(matchLimits('JUNIOR', 7)).toEqual({ perDay: 6, perShift: 4 });
    expect(matchLimits('OTHER', 5)).toEqual({ perDay: 9, perShift: 5 });
    expect(matchLimits('OTHER', 7)).toEqual({ perDay: 6, perShift: 4 });
    expect(matchLimits('MINI', 5)).toEqual({ perDay: 6, perShift: 4 });
  });
  it('yosh toifasi → guruh', () => {
    expect(ageGroupOf('U13')).toBe('MINI');
    expect(ageGroupOf('U15')).toBe('YOUTH');
    expect(ageGroupOf('U19')).toBe('JUNIOR');
    expect(ageGroupOf('SENIOR')).toBe('OTHER');
    expect(ageGroupOf(null)).toBe('OTHER');
  });
  it('stollar soni: 127 uchrashuv (128 kishilik setka), 5 set, 2 kun × 8 soat', () => {
    expect(knockoutMatchCount(128)).toBe(127);
    expect(requiredTables({ totalMatches: 127, bestOf: 5, days: 2, hoursPerDay: 8 })).toBe(4); // 127*30 / 960 = 3.97
  });
});
