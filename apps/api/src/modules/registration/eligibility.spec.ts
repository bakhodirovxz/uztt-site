import {
  ageInYear,
  declaredFilter,
  defaultCategory,
  eligibleCategories,
  isEligible,
  matchesGroup,
  type AgeCategoryLike,
} from './eligibility';

// Seed'dagi kategoriyalar bilan bir xil to'plam
const CATS: AgeCategoryLike[] = [
  { id: '1', code: 'U9', maxAge: 9, sortOrder: 0 },
  { id: '2', code: 'U11', maxAge: 11, sortOrder: 1 },
  { id: '3', code: 'U13', maxAge: 13, sortOrder: 2 },
  { id: '4', code: 'U15', maxAge: 15, sortOrder: 3 },
  { id: '5', code: 'U17', maxAge: 17, sortOrder: 4 },
  { id: '6', code: 'U19', maxAge: 19, sortOrder: 5 },
  { id: '7', code: 'SENIOR', maxAge: null, sortOrder: 6 },
];
// Talabdagi misollar U-12/U-14 bilan berilgan — qoida bir xil ishlashini
// alohida to'plamda ham tekshiramiz:
const CATS_ALT: AgeCategoryLike[] = [
  { id: 'a', code: 'U9', maxAge: 9, sortOrder: 0 },
  { id: 'b', code: 'U12', maxAge: 12, sortOrder: 1 },
  { id: 'c', code: 'U14', maxAge: 14, sortOrder: 2 },
  { id: 'd', code: 'SENIOR', maxAge: null, sortOrder: 3 },
];

const codes = (cs: AgeCategoryLike[]) => cs.map((c) => c.code);

describe('eligibility (yosh chegarasi — foydalanuvchi misollari)', () => {
  it('9 yoshli: U-9, U-12 va yuqorida qatnasha oladi', () => {
    const birth = new Date(2017, 4, 10); // 2026 yilda 9 yosh
    expect(codes(eligibleCategories(birth, 2026, CATS_ALT))).toEqual([
      'U9',
      'U12',
      'U14',
      'SENIOR',
    ]);
  });

  it('12 yoshli: U-9 EMAS, U-12, U-14 va yuqorida qatnasha oladi', () => {
    const birth = new Date(2014, 8, 1); // 2026 yilda 12 yosh
    expect(codes(eligibleCategories(birth, 2026, CATS_ALT))).toEqual([
      'U12',
      'U14',
      'SENIOR',
    ]);
  });

  it("default kategoriya — o'z yosh guruhi (eng kichigi)", () => {
    expect(defaultCategory(new Date(2017, 0, 1), 2026, CATS_ALT)?.code).toBe(
      'U9',
    );
    expect(defaultCategory(new Date(2014, 0, 1), 2026, CATS_ALT)?.code).toBe(
      'U12',
    );
    expect(defaultCategory(new Date(1990, 0, 1), 2026, CATS_ALT)?.code).toBe(
      'SENIOR',
    );
  });

  it('chegaraviy yosh: aynan maxAge yoshida hali muvofiq', () => {
    // 2026 - 2017 = 9 → U9 ✓ (9 <= 9)
    expect(isEligible(9, CATS[0])).toBe(true);
    // 10 yosh → U9 ✗
    expect(isEligible(10, CATS[0])).toBe(false);
  });

  it('yosh turnir yili bo`yicha hisoblanadi (tug`ilgan kun muhim emas)', () => {
    // 2014-12-31 da tug'ilgan bola 2026 yilda "12 yosh" hisoblanadi,
    // hatto turnir yanvarda bo'lsa ham
    expect(ageInYear(new Date(2014, 11, 31), 2026)).toBe(12);
    expect(ageInYear(new Date(2014, 0, 1), 2026)).toBe(12);
  });

  it('keyingi yil turniri uchun kategoriya o`zgarishi mumkin', () => {
    const birth = new Date(2017, 5, 15);
    // 2026: 9 yosh → U9 default
    expect(defaultCategory(birth, 2026, CATS)?.code).toBe('U9');
    // 2027: 10 yosh → endi U11 default, U9 ga yo'l yo'q
    expect(defaultCategory(birth, 2027, CATS)?.code).toBe('U11');
    expect(codes(eligibleCategories(birth, 2027, CATS))).not.toContain('U9');
  });

  it('kattalar (SENIOR) hamma yoshga ochiq', () => {
    for (const age of [7, 12, 19, 25, 60]) {
      expect(isEligible(age, CATS[6])).toBe(true);
    }
  });
});

describe("o'yinchi tanlagan yosh toifalari (ro'yxatdan o'tishda)", () => {
  const birth = new Date(2014, 8, 1); // 2026 da 12 yosh → U12/U14/SENIOR

  it('faqat tanlangan toifalar qoladi', () => {
    const byAge = eligibleCategories(birth, 2026, CATS_ALT);
    expect(codes(declaredFilter(byAge, ['U12', 'SENIOR']))).toEqual([
      'U12',
      'SENIOR',
    ]);
  });

  it("tanlov bo'sh bo'lsa — yosh qoidasi bo'yicha hammasi", () => {
    const byAge = eligibleCategories(birth, 2026, CATS_ALT);
    expect(codes(declaredFilter(byAge, []))).toEqual(['U12', 'U14', 'SENIOR']);
  });

  it("yoshga mos bo'lmagan toifani tanlash natijaga ta'sir qilmaydi", () => {
    const byAge = eligibleCategories(birth, 2026, CATS_ALT);
    // U9 — 12 yoshli o'yinchiga mos emas, tanlansa ham chiqmaydi
    expect(codes(declaredFilter(byAge, ['U9', 'U12']))).toEqual(['U12']);
  });
});

describe('guruh (jins) muvofiqligi', () => {
  it('erkaklar guruhiga faqat erkak, ayollar guruhiga faqat ayol', () => {
    expect(matchesGroup('MALE', 'MALE')).toBe(true);
    expect(matchesGroup('MALE', 'FEMALE')).toBe(false);
    expect(matchesGroup('FEMALE', 'FEMALE')).toBe(true);
    expect(matchesGroup('FEMALE', 'MALE')).toBe(false);
  });

  it('aralash juftlik va jamoaviy (gender = null) ikkala jinsga ochiq', () => {
    expect(matchesGroup('MALE', null)).toBe(true);
    expect(matchesGroup('FEMALE', null)).toBe(true);
  });
});
