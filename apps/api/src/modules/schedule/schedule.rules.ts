/**
 * Musobaqa rejalashtirish me'yorlari (qoidalar 4.5.3–4.5.4) — sof funksiyalar.
 */

export type AgeGroup = 'MINI' | 'YOUTH' | 'JUNIOR' | 'OTHER';

/** Bir uchrashuvning o'rtacha davomiyligi, daqiqa: 5 setli — 30, 7 setli — 45 (4.5.3) */
export function matchMinutes(bestOf: number): number {
  return bestOf >= 7 ? 45 : 30;
}

/**
 * Kuniga va smenada tavsiya etilgan maksimal uchrashuv soni (4.5.4.1–4.5.4.4).
 * `bestOf` 5 yoki 7; 3 setli uchrashuv 5 setli me'yorda hisoblanadi.
 */
export function matchLimits(group: AgeGroup, bestOf: number): { perDay: number; perShift: number } {
  const seven = bestOf >= 7;
  switch (group) {
    case 'MINI': // kichik yoshdagi o'smirlar
      return seven ? { perDay: 4, perShift: 3 } : { perDay: 6, perShift: 4 }; // 7 setli uchun qoidada yo'q — ehtiyotkor
    case 'YOUTH': // o'smirlar
      return seven ? { perDay: 5, perShift: 3 } : { perDay: 7, perShift: 4 };
    case 'JUNIOR': // yoshlar (junior)
      return seven ? { perDay: 6, perShift: 4 } : { perDay: 8, perShift: 5 };
    default: // boshqa yosh toifalari (kattalar)
      return seven ? { perDay: 6, perShift: 4 } : { perDay: 9, perShift: 5 };
  }
}

/** Yosh toifasi kodidan (U9…U19, SENIOR) qoidalardagi guruhga */
export function ageGroupOf(code: string | null | undefined): AgeGroup {
  switch ((code ?? 'SENIOR').toUpperCase()) {
    case 'U9':
    case 'U11':
    case 'U13':
      return 'MINI';
    case 'U15':
      return 'YOUTH';
    case 'U17':
    case 'U19':
      return 'JUNIOR';
    default:
      return 'OTHER';
  }
}

/** Kerakli stollar soni (4.5.3): jami uchrashuv × davomiylik / (kunlar × kunlik o'yin soatlari) */
export function requiredTables(args: {
  totalMatches: number;
  bestOf: number;
  days: number;
  hoursPerDay: number;
}): number {
  const minutes = args.totalMatches * matchMinutes(args.bestOf);
  const capacityPerTable = Math.max(1, args.days) * Math.max(1, args.hoursPerDay) * 60;
  return Math.max(1, Math.ceil(minutes / capacityPerTable));
}

/** Setka (yakkalar, bir yutqazishda chiqish): n o'yinchi → n−1 uchrashuv; doira: N(N−1)/2 (4.5.4.6) */
export function knockoutMatchCount(players: number): number {
  return Math.max(0, players - 1);
}
