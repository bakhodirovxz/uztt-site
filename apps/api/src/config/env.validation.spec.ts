import { randomBytes } from 'crypto';
import { validateEnv } from './env.validation';

function validConfig(): Record<string, string> {
  return {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    JWT_SECRET: 'a'.repeat(48),
    JWT_REFRESH_SECRET: 'b'.repeat(48),
    DATA_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
  };
}

describe('validateEnv (xavfsizlik-kritik: defaultsiz sirlar)', () => {
  it("to'g'ri konfiguratsiya o'tadi", () => {
    const env = validateEnv(validConfig());
    expect(env.PORT).toBe(4000);
    expect(env.JWT_ACCESS_TTL).toBe('15m');
    expect(env.DATA_ENCRYPTION_KEY_ID).toBe('k1');
  });

  it('JWT_SECRET yo‘q bo‘lsa boot QILMAYDI', () => {
    const cfg = validConfig();
    delete cfg.JWT_SECRET;
    expect(() => validateEnv(cfg)).toThrow(/JWT_SECRET/);
  });

  it('DATA_ENCRYPTION_KEY yo‘q bo‘lsa boot QILMAYDI', () => {
    const cfg = validConfig();
    delete cfg.DATA_ENCRYPTION_KEY;
    expect(() => validateEnv(cfg)).toThrow(/DATA_ENCRYPTION_KEY/);
  });

  it('qisqa JWT_SECRET rad etiladi (< 32 belgi)', () => {
    expect(() =>
      validateEnv({ ...validConfig(), JWT_SECRET: 'qisqa' }),
    ).toThrow(/32/);
  });

  it('access va refresh sirlari bir xil bo‘lsa rad etiladi', () => {
    const same = 'c'.repeat(48);
    expect(() =>
      validateEnv({
        ...validConfig(),
        JWT_SECRET: same,
        JWT_REFRESH_SECRET: same,
      }),
    ).toThrow(/bir xil/);
  });

  it('AES kalit 64 hex bo‘lmasa rad etiladi', () => {
    expect(() =>
      validateEnv({ ...validConfig(), DATA_ENCRYPTION_KEY: 'zzzz' }),
    ).toThrow(/64/);
    expect(() =>
      validateEnv({
        ...validConfig(),
        DATA_ENCRYPTION_KEY: randomBytes(16).toString('hex'), // 32 hex — kam
      }),
    ).toThrow(/64/);
  });

  it('PORT API_PORT fallback bilan o‘qiladi', () => {
    const env = validateEnv({ ...validConfig(), API_PORT: '5000' });
    expect(env.PORT).toBe(5000);
  });
});
