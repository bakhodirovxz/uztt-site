/**
 * O'yinchi rasmining kichik (128 px, yuzga qaratilgan) nusxasi — jadval, setka, TV va overlay uchun.
 * Katta rasm (600×800) faqat profil sahifasida. Yuklangan: `<nom>-thumb.webp`; uttf import: `players/thumb/<id>.webp`.
 * (API dagi common/photo.ts bilan bir xil qoida.)
 */
/**
 * Import qilingan kichik nusxalar fayl nomi o'zgarmay qayta yaratiladi (make-thumbs.cjs --force),
 * nginx esa ularni 30 kun immutable keshlaydi. Kesish algoritmi o'zgarsa — shu raqamni oshiring,
 * aks holda brauzer/OBS eski nusxani ko'rsatib turadi. 2: yuzga qaratilgan kesish (2026-11).
 */
export const THUMB_VERSION = 2;

export function photoThumbUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const up = url.match(/^(\/uploads\/players\/.+)\.webp$/);
  if (up) return `${up[1]}-thumb.webp`;
  const imp = url.match(/^(\/uttf-import\/players\/)([^/]+)\.[a-z0-9]+$/i);
  if (imp) return `${imp[1]}thumb/${imp[2]}.webp?v=${THUMB_VERSION}`;
  return url;
}
