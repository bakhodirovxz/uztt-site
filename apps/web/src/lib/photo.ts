/**
 * O'yinchi rasmining kichik (96 px) nusxasi — jadval, setka, TV va overlay uchun.
 * Katta rasm (600×800) faqat profil sahifasida. Yuklangan: `<nom>-thumb.webp`; uttf import: `players/thumb/<id>.webp`.
 * (API dagi common/photo.ts bilan bir xil qoida.)
 */
export function photoThumbUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const up = url.match(/^(\/uploads\/players\/.+)\.webp$/);
  if (up) return `${up[1]}-thumb.webp`;
  const imp = url.match(/^(\/uttf-import\/players\/)([^/]+)\.[a-z0-9]+$/i);
  if (imp) return `${imp[1]}thumb/${imp[2]}.webp`;
  return url;
}
