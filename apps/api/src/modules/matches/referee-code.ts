import { createHash, randomInt } from 'crypto';

/** 6 xonali hakam kodi — kriptografik tasodifiy (Math.random emas) */
export function newRefereeCode(): string {
  return String(randomInt(100000, 1000000));
}

/** Bazada faqat hash saqlanadi (CryptoService.sha256 bilan bir xil: sha256 hex) */
export function hashRefereeCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/**
 * Setka/guruh avtomatik yaratgan o'yinlar uchun: kod hech kimga ko'rsatilmaydi, faqat hash
 * yoziladi — administrator kerak bo'lganda "yangi kod" bilan oladi.
 */
export function sealedRefereeCodeHash(): string {
  return hashRefereeCode(newRefereeCode());
}
