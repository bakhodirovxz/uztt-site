/**
 * Parol siyosati (OWASP/NIST ruhida): uzunlik asosiy omil, ustiga murakkablik va "ochiq ro'yxat" tekshiruvi.
 *  - oddiy foydalanuvchi: ≥ 10 belgi, katta+kichik harf va raqam
 *  - boshqaruvchi (admin, operator, hakam va h.k.): ≥ 14 belgi, + maxsus belgi
 *  - email/ism qismi parol ichida bo'lmasin; eng ko'p ishlatiladigan parollar rad etiladi
 */
const COMMON = [
  'password', 'parol', 'qwerty', 'qwertyuiop', '123456', '12345678', '123456789', '1234567890', 'admin', 'administrator',
  'letmein', 'welcome', 'iloveyou', 'uzbekistan', 'ozbekiston', 'tennis', 'stoltennis', 'uztt', 'uttf', 'football',
];

export interface PolicyContext {
  /** Boshqaruvchi hisobmi (PLAYER dan boshqa har qanday rol) */
  privileged?: boolean;
  email?: string;
  names?: string[];
}

export const MIN_LEN = 10;
export const MIN_LEN_PRIVILEGED = 14;

/** Xato xabarini (o'zbekcha) qaytaradi yoki null (parol yaroqli) */
export function checkPassword(password: string, ctx: PolicyContext = {}): string | null {
  const min = ctx.privileged ? MIN_LEN_PRIVILEGED : MIN_LEN;
  if (password.length < min) return `Parol kamida ${min} belgidan iborat bo‘lsin`;
  if (password.length > 128) return 'Parol juda uzun (128 belgigacha)';
  if (!/[a-zа-я]/.test(password) || !/[A-ZА-Я]/.test(password)) return 'Parolda katta va kichik harflar bo‘lsin';
  if (!/\d/.test(password)) return 'Parolda kamida bitta raqam bo‘lsin';
  if (ctx.privileged && !/[^A-Za-zА-Яа-я0-9]/.test(password)) return 'Boshqaruvchi parolida kamida bitta maxsus belgi (!@#$%- va h.k.) bo‘lsin';
  const low = password.toLowerCase();
  if (COMMON.some((c) => low === c || (low.length <= c.length + 4 && low.includes(c)))) return 'Bu parol juda oddiy — boshqasini tanlang';
  if (/^(.)\1+$/.test(password)) return 'Parol bir xil belgilardan iborat bo‘lmasin';
  const local = ctx.email?.split('@')[0]?.toLowerCase();
  if (local && local.length >= 4 && low.includes(local)) return 'Parolda email nomi bo‘lmasin';
  for (const n of ctx.names ?? []) if (n.length >= 4 && low.includes(n.toLowerCase())) return 'Parolda ism yoki familiya bo‘lmasin';
  return null;
}

/** PLAYER dan boshqa har qanday rol — boshqaruvchi hisob */
export function isPrivileged(roles: string[]): boolean {
  return roles.some((r) => r !== 'PLAYER');
}
