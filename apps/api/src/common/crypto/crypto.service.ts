import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from 'crypto';

/**
 * AES-256-GCM shifrlash xizmati — pasport ma'lumotlari kabi maxfiy
 * (lekin qaytarilishi kerak bo'lgan) ma'lumotlar uchun.
 *
 * Ciphertext formati: `keyId:iv:tag:data` (hammasi base64url, keyId — matn).
 * keyId key rotation uchun: yangi kalitga o'tilganda eski yozuvlar eski kalit
 * bilan ochilaveradi (DATA_ENCRYPTION_KEYS_OLD orqali), yangi yozuvlar yangi
 * kalit bilan yoziladi.
 *
 * Parollar uchun EMAS — parollar argon2id bilan hash'lanadi (AuthService).
 */
@Injectable()
export class CryptoService {
  private readonly keys = new Map<string, Buffer>();
  private readonly activeKeyId: string;

  constructor(config: ConfigService) {
    const activeHex = config.getOrThrow<string>('DATA_ENCRYPTION_KEY');
    this.activeKeyId = config.get<string>('DATA_ENCRYPTION_KEY_ID') ?? 'k1';
    this.keys.set(this.activeKeyId, Buffer.from(activeHex, 'hex'));

    // Rotatsiyadan qolgan eski kalitlar: '{"k0":"<64 hex>"}' JSON ko'rinishida
    const oldKeysJson = config.get<string>('DATA_ENCRYPTION_KEYS_OLD');
    if (oldKeysJson) {
      const parsed = JSON.parse(oldKeysJson) as Record<string, string>;
      for (const [id, hex] of Object.entries(parsed)) {
        this.keys.set(id, Buffer.from(hex, 'hex'));
      }
    }
  }

  /** Matnni shifrlaydi → `keyId:iv:tag:data` */
  encryptString(plaintext: string): string {
    const encrypted = this.encryptBuffer(Buffer.from(plaintext, 'utf8'));
    return encrypted;
  }

  /** `keyId:iv:tag:data` formatidagi qiymatni ochadi */
  decryptString(ciphertext: string): string {
    return this.decryptToBuffer(ciphertext).toString('utf8');
  }

  /** Baytlarni shifrlaydi (fayllar uchun) → `keyId:iv:tag:data` (base64url) */
  encryptBuffer(data: Buffer): string {
    const iv = randomBytes(12);
    const key = this.keys.get(this.activeKeyId)!;
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(data), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      this.activeKeyId,
      iv.toString('base64url'),
      tag.toString('base64url'),
      enc.toString('base64url'),
    ].join(':');
  }

  /** Shifrlangan qiymatni baytlarga ochadi */
  decryptToBuffer(ciphertext: string): Buffer {
    const parts = ciphertext.split(':');
    if (parts.length !== 4) {
      throw new Error('Ciphertext formati noto‘g‘ri');
    }
    const [keyId, ivB64, tagB64, dataB64] = parts;
    const key = this.keys.get(keyId);
    if (!key) {
      throw new Error(`Noma'lum shifrlash kaliti: ${keyId}`);
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivB64, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64url')),
      decipher.final(),
    ]);
  }

  /** Qidiruv/solishtirish uchun deterministik hash (masalan, refresh token) */
  sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
