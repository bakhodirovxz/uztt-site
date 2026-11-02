/** O'yinchi rasmining kichik (96 px) nusxasi manzili. Yuklangan: `-thumb.webp`; uttf import: `players/thumb/<id>.webp`. */
export function photoThumbUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const up = url.match(/^(\/uploads\/players\/.+)\.webp$/);
  if (up) return `${up[1]}-thumb.webp`;
  const imp = url.match(/^(\/uttf-import\/players\/)([^/]+)\.[a-z0-9]+$/i);
  if (imp) return `${imp[1]}thumb/${imp[2]}.webp`;
  return url;
}
