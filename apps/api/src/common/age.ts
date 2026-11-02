/**
 * Yosh segmentlari — KUMULYATIV: U-13 tanlansa, 13 yosh va undan kichik BARCHA o'yinchilar kiradi
 * (shu jumladan U-9, U-11 toifalaridagilar); U-15 — 15 va undan kichik hammasi va h.k.
 * Kattalar (maxAge yo'q) — cheklovsiz, hamma.
 *
 * Yosh = joriy yil − tug'ilgan yil (uttf.uz ham shunday hisoblaydi; bazada sana 1-yanvar sifatida saqlangan).
 * Chegara kiritiladimi? uttf.uz da U-13 ga 13 yoshlilar ham kiradi (maxAge = 13) — shunga mos "inclusive".
 * Qat'iy "13 dan kichik" kerak bo'lsa, AGE_LIMIT_INCLUSIVE = false qiling.
 */
export const AGE_LIMIT_INCLUSIVE = true;

/** `birthDate >= qaytarilgan sana` — yoshi chegaradan oshmaganlar. maxAge null — filtr yo'q. */
export function birthDateFloor(maxAge: number | null | undefined, now = new Date()): Date | undefined {
  if (maxAge === null || maxAge === undefined) return undefined;
  const limit = AGE_LIMIT_INCLUSIVE ? maxAge : maxAge - 1;
  return new Date(Date.UTC(now.getUTCFullYear() - limit, 0, 1));
}

/** Yosh (yil bo'yicha). Tug'ilgan sana yo'q bo'lsa null. To'liq sana ommaga chiqarilmaydi — faqat yosh. */
export function ageOf(birthDate: Date | null | undefined, now = new Date()): number | null {
  if (!birthDate) return null;
  return now.getUTCFullYear() - birthDate.getUTCFullYear();
}
