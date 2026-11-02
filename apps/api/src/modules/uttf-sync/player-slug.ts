import { createHash } from 'crypto';

/**
 * Ommaviy o'yinchi manzili (slug): "<ism>-<suffiks>".
 * Suffiks PINFL'dan EMAS, o'yinchi id'sidan olinadi va qaytarib bo'lmaydi — PINFL raqamlari
 * (tug'ilgan kun/oy) ommaviy URL'ga chiqmasin. Formula migratsiya bilan bir xil
 * (20261103100000_player_slug_unlink_pinfl): left(md5(id || 'uztt-slug'), len).
 */
export const PLAYER_SLUG_LENGTHS = [5, 8, 12, 32] as const;

export function playerSlugBase(fio: string): string {
  const base = fio
    .toLowerCase()
    .replace(/[‘’'`ʻʼ]/g, '')
    .replace(/[^a-z0-9Ѐ-ӿ]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
  return base || 'oyinchi';
}

export function playerSlugSuffix(id: string, len: number): string {
  return createHash('md5').update(id + 'uztt-slug').digest('hex').slice(0, len);
}

/** Band bo'lsa navbatdagi (uzunroq) nomzod olinadi */
export function playerSlugCandidates(fio: string, id: string): string[] {
  const base = playerSlugBase(fio);
  return PLAYER_SLUG_LENGTHS.map((len) => `${base}-${playerSlugSuffix(id, len)}`);
}
