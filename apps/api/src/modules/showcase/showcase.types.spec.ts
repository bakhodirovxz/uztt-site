import { ageFromBirthDate, parseTables } from './showcase.types';

describe('ageFromBirthDate', () => {
  const now = new Date('2026-10-30T00:00:00Z');
  it("tug'ilgan kunidan oldin yosh bittaga kam", () => {
    expect(ageFromBirthDate(new Date('2010-11-15'), now)).toBe(15);
    expect(ageFromBirthDate(new Date('2010-10-30'), now)).toBe(16);
  });
  it("sana yo'q yoki noto'g'ri bo'lsa null", () => {
    expect(ageFromBirthDate(null, now)).toBeNull();
    expect(ageFromBirthDate(new Date('2030-01-01'), now)).toBeNull();
  });
});

describe('parseTables', () => {
  it("bo'sh qator — hamma stol", () => {
    expect(parseTables('')).toBeNull();
    expect(parseTables(null)).toBeNull();
  });
  it('stollarni o‘qiydi va noto‘g‘rilarini tashlaydi', () => {
    expect(parseTables('1, 2,x,99,5')).toEqual([1, 2, 5]);
  });
});
