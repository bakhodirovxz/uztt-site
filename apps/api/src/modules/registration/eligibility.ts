/**
 * Yosh kategoriyasi muvofiqligi — pure funksiyalar.
 *
 * Qoida: o'yinchi turnir yilidagi yoshi bo'yicha O'Z guruhida va undan
 * YUQORI (kattaroq) kategoriyalarda qatnasha oladi:
 *   muvofiq ⟺ maxAge == null (kattalar) YOKI yosh <= maxAge
 *
 * Misollar (talab):
 *   9 yosh  → U-9 ✓, U-12 ✓, kattalar ✓
 *   12 yosh → U-9 ✗, U-12 ✓, U-14 ✓
 */

export interface AgeCategoryLike {
  id: string;
  code: string;
  maxAge: number | null;
  sortOrder: number;
}

/** Stol tennisi amaliyoti: yosh turnir yili bo'yicha hisoblanadi (yil - tug'ilgan yil) */
export function ageInYear(birthDate: Date, year: number): number {
  return year - birthDate.getFullYear();
}

export function isEligible(age: number, category: AgeCategoryLike): boolean {
  return category.maxAge === null || age <= category.maxAge;
}

/** O'yinchi qatnasha oladigan kategoriyalar (sortOrder bo'yicha) */
export function eligibleCategories<T extends AgeCategoryLike>(
  birthDate: Date,
  tournamentYear: number,
  categories: T[],
): T[] {
  const age = ageInYear(birthDate, tournamentYear);
  return categories
    .filter((c) => isEligible(age, c))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * O'yinchi ro'yxatdan o'tishda tanlagan (va admin tasdiqlagan) toifalar bilan
 * kesishma. Ro'yxat bo'sh bo'lsa — cheklov yo'q, faqat yosh qoidasi ishlaydi.
 */
export function declaredFilter<T extends AgeCategoryLike>(
  categories: T[],
  declaredCodes: string[],
): T[] {
  if (declaredCodes.length === 0) return categories;
  return categories.filter((c) => declaredCodes.includes(c.code));
}

/**
 * Guruh (yakka/juftlik/aralash/jamoaviy) va jins muvofiqligi.
 * `categoryGender = null` — aralash yoki ochiq guruh, ikkala jins ham kiradi.
 */
export function matchesGroup(
  playerGender: 'MALE' | 'FEMALE',
  categoryGender: 'MALE' | 'FEMALE' | null,
): boolean {
  return categoryGender === null || categoryGender === playerGender;
}

/**
 * Default (avtomatik) kategoriya — o'yinchining o'z yosh guruhi:
 * muvofiqlar ichida eng kichigi (eng tor maxAge).
 */
export function defaultCategory<T extends AgeCategoryLike>(
  birthDate: Date,
  tournamentYear: number,
  categories: T[],
): T | null {
  const list = eligibleCategories(birthDate, tournamentYear, categories);
  return list[0] ?? null;
}
