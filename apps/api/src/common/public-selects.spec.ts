import { PUBLIC_MATCH_SELECT, PUBLIC_PLAYER_SELECT, withAge } from '../modules/players/players.service';
import { PUBLIC_CLUB_SELECT } from '../modules/clubs/clubs.service';

/**
 * Ommaviy (autentifikatsiyasiz) javoblarga hech qachon tushmasligi kerak bo'lgan maydonlar.
 * licenseNumber: import qilingan o'yinchilarning bir qismida bu ustunda haqiqiy PINFL (milliy ID) bor.
 * phone…, address, districtName: klublarda murabbiy/rahbarning shaxsiy mobil raqami va manzili.
 */
const FORBIDDEN = /^(licenseNumber|birthDate|phone.*|address|email|districtName|pinfl|passwordHash)$/i;

/** Prisma select obyektini (ichki select/include bilan) yoyib, barcha `true` kalit yo'llarini qaytaradi */
function selectedPaths(sel: unknown, prefix = ''): string[] {
  if (!sel || typeof sel !== 'object') return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(sel as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v === true) out.push(path);
    else if (v && typeof v === 'object') {
      const inner = v as Record<string, unknown>;
      out.push(path, ...selectedPaths(inner.select ?? inner.include ?? inner, path));
    }
  }
  return out;
}

const leaks = (sel: unknown) => selectedPaths(sel).filter((p) => FORBIDDEN.test(p.split('.').pop()!));

describe('ommaviy select\'larda maxfiy maydon yo\'q', () => {
  it.each([
    ['PUBLIC_PLAYER_SELECT', PUBLIC_PLAYER_SELECT],
    ['PUBLIC_MATCH_SELECT', PUBLIC_MATCH_SELECT],
    ['PUBLIC_CLUB_SELECT', PUBLIC_CLUB_SELECT],
  ])('%s', (_name, sel) => {
    expect(leaks(sel)).toEqual([]);
  });

  it('tekshiruvning o\'zi ishlaydi (ichki select ichidagi maxfiy maydon ham topiladi)', () => {
    expect(leaks({ id: true, clubRecord: { select: { phoneNumber: true } }, licenseNumber: true })).toEqual([
      'clubRecord.phoneNumber',
      'licenseNumber',
    ]);
  });

  it('withAge: to\'liq tug\'ilgan sana javobdan olib tashlanadi, faqat yosh qoladi', () => {
    const now = new Date();
    const row = withAge({ id: 'x', firstName: 'A', birthDate: new Date(Date.UTC(now.getUTCFullYear() - 12, 0, 1)) });
    expect(row).not.toHaveProperty('birthDate');
    expect(row.age).toBe(12);
    expect(Object.keys(row).filter((k) => FORBIDDEN.test(k))).toEqual([]);
  });
});
