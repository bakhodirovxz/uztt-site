// Muhit o'zgaruvchilari validatsiyasi — majburiy qiymatlar bo'lmasa API boot QILMAYDI.
// Legacy'dagi "insecure default" muammosining yechimi: hech qanday default sir yo'q.

const HEX_64 = /^[0-9a-f]{64}$/i;

export interface Env {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_TTL: string;
  JWT_REFRESH_TTL: string;
  DATA_ENCRYPTION_KEY: string;
  DATA_ENCRYPTION_KEY_ID: string;
  WEB_ORIGIN: string;
  /** ISR: kontent o'zgarganda web'ning revalidate endpointi chaqiriladi (ixtiyoriy) */
  WEB_REVALIDATE_URL?: string;
  REVALIDATE_SECRET?: string;
}

export function validateEnv(config: Record<string, unknown>): Env {
  const errors: string[] = [];

  const str = (key: string, fallback?: string): string => {
    const v = (config[key] as string) ?? fallback;
    if (v === undefined || v === '') {
      errors.push(`${key} berilishi shart (.env faylini tekshiring)`);
      return '';
    }
    return v;
  };

  const env: Env = {
    NODE_ENV: str('NODE_ENV', 'development'),
    PORT: Number(config['PORT'] ?? config['API_PORT'] ?? 4000),
    DATABASE_URL: str('DATABASE_URL'),
    JWT_SECRET: str('JWT_SECRET'),
    JWT_REFRESH_SECRET: str('JWT_REFRESH_SECRET'),
    JWT_ACCESS_TTL: str('JWT_ACCESS_TTL', '15m'),
    JWT_REFRESH_TTL: str('JWT_REFRESH_TTL', '30d'),
    DATA_ENCRYPTION_KEY: str('DATA_ENCRYPTION_KEY'),
    DATA_ENCRYPTION_KEY_ID: str('DATA_ENCRYPTION_KEY_ID', 'k1'),
    WEB_ORIGIN: str('WEB_ORIGIN', 'http://localhost:3000'),
    WEB_REVALIDATE_URL: (config['WEB_REVALIDATE_URL'] as string) || undefined,
    REVALIDATE_SECRET: (config['REVALIDATE_SECRET'] as string) || undefined,
  };

  // Ikkalasi birga bo'lishi kerak — sirsiz webhook ochiq eshik bo'lib qoladi
  if (env.WEB_REVALIDATE_URL && !env.REVALIDATE_SECRET) {
    errors.push('WEB_REVALIDATE_URL berilsa REVALIDATE_SECRET ham shart');
  }
  if (env.REVALIDATE_SECRET && env.REVALIDATE_SECRET.length < 16) {
    errors.push('REVALIDATE_SECRET kamida 16 belgi bo‘lishi kerak');
  }

  if (env.JWT_SECRET && env.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET kamida 32 belgi bo‘lishi kerak');
  }
  if (env.JWT_REFRESH_SECRET && env.JWT_REFRESH_SECRET.length < 32) {
    errors.push('JWT_REFRESH_SECRET kamida 32 belgi bo‘lishi kerak');
  }
  if (env.JWT_SECRET && env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
    errors.push('JWT_SECRET va JWT_REFRESH_SECRET bir xil bo‘lmasligi kerak');
  }
  if (env.DATA_ENCRYPTION_KEY && !HEX_64.test(env.DATA_ENCRYPTION_KEY)) {
    errors.push(
      "DATA_ENCRYPTION_KEY aynan 64 ta hex belgi (32 bayt) bo‘lishi kerak. Generatsiya: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }

  if (errors.length > 0) {
    throw new Error(`Muhit sozlamalarida xatolik:\n - ${errors.join('\n - ')}`);
  }
  return env;
}
