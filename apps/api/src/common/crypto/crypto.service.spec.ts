import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { CryptoService } from './crypto.service';

function makeService(overrides: Record<string, string | undefined> = {}) {
  const env: Record<string, string | undefined> = {
    DATA_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
    DATA_ENCRYPTION_KEY_ID: 'k1',
    ...overrides,
  };
  const config = {
    getOrThrow: (key: string) => {
      const v = env[key];
      if (v === undefined) throw new Error(`${key} yo'q`);
      return v;
    },
    get: (key: string) => env[key],
  } as unknown as ConfigService;
  return new CryptoService(config);
}

describe('CryptoService (AES-256-GCM)', () => {
  it('matnni shifrlab qaytarib ochadi (round-trip)', () => {
    const svc = makeService();
    const plain = 'AB1234567 — pasport raqami, o‘zbekcha ҳарф ва emoji 🏓';
    const enc = svc.encryptString(plain);
    expect(enc).not.toContain(plain);
    expect(svc.decryptString(enc)).toBe(plain);
  });

  it('ciphertext formati keyId:iv:tag:data', () => {
    const svc = makeService();
    const enc = svc.encryptString('test');
    const parts = enc.split(':');
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe('k1');
    expect(Buffer.from(parts[1], 'base64url')).toHaveLength(12); // IV
    expect(Buffer.from(parts[2], 'base64url')).toHaveLength(16); // GCM tag
  });

  it('har safar boshqa IV — bir xil matn ikki xil ciphertext beradi', () => {
    const svc = makeService();
    expect(svc.encryptString('bir xil')).not.toBe(svc.encryptString('bir xil'));
  });

  it('buzilgan ciphertext (tag mos kelmasa) xato beradi', () => {
    const svc = makeService();
    const enc = svc.encryptString('maxfiy');
    const parts = enc.split(':');
    // oxirgi baytni buzamiz
    const data = Buffer.from(parts[3], 'base64url');
    data[data.length - 1] ^= 0xff;
    const tampered = [
      parts[0],
      parts[1],
      parts[2],
      data.toString('base64url'),
    ].join(':');
    expect(() => svc.decryptString(tampered)).toThrow();
  });

  it('key rotation: eski kalit bilan yozilganni yangi konfiguratsiya ochadi', () => {
    const oldKeyHex = randomBytes(32).toString('hex');
    const oldSvc = makeService({
      DATA_ENCRYPTION_KEY: oldKeyHex,
      DATA_ENCRYPTION_KEY_ID: 'k1',
    });
    const enc = oldSvc.encryptString('eski yozuv');

    // Rotatsiya: yangi faol kalit k2, eski k1 "old keys" ro'yxatida
    const newSvc = makeService({
      DATA_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
      DATA_ENCRYPTION_KEY_ID: 'k2',
      DATA_ENCRYPTION_KEYS_OLD: JSON.stringify({ k1: oldKeyHex }),
    });
    expect(newSvc.decryptString(enc)).toBe('eski yozuv');
    // yangi yozuvlar yangi kalit bilan
    expect(newSvc.encryptString('yangi').startsWith('k2:')).toBe(true);
  });

  it("noma'lum keyId xato beradi", () => {
    const svc = makeService();
    const enc = svc.encryptString('x').replace(/^k1:/, 'k9:');
    expect(() => svc.decryptString(enc)).toThrow(/Noma'lum/);
  });

  it('fayl baytlari round-trip (rasm simulyatsiyasi)', () => {
    const svc = makeService();
    const fileBytes = randomBytes(256 * 1024); // 256 KB tasodifiy "rasm"
    const enc = svc.encryptBuffer(fileBytes);
    expect(svc.decryptToBuffer(enc).equals(fileBytes)).toBe(true);
  });
});
