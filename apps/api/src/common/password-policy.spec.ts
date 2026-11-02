import { checkPassword, isPrivileged } from './password-policy';

describe('parol siyosati', () => {
  it('oddiy foydalanuvchi: 10+ belgi, harf katta-kichik, raqam', () => {
    expect(checkPassword('Kuchli12345')).toBeNull();
    expect(checkPassword('qisqa1A')).toMatch(/kamida 10/);
    expect(checkPassword('faqatkichikharf1')).toMatch(/katta va kichik/);
    expect(checkPassword('FaqatHarflarBor')).toMatch(/raqam/);
  });
  it('boshqaruvchi: 14+ va maxsus belgi', () => {
    expect(checkPassword('Kuchli12345', { privileged: true })).toMatch(/kamida 14/);
    expect(checkPassword('KuchliParol12345', { privileged: true })).toMatch(/maxsus/);
    expect(checkPassword('Kuchli-Parol-12345', { privileged: true })).toBeNull();
  });
  it('oddiy va email/ism qismi bor parollar rad etiladi', () => {
    expect(checkPassword('Password123')).toMatch(/oddiy/);
    expect(checkPassword('Alisher2026Kuch', { email: 'alisher@x.uz' })).toMatch(/email/);
    expect(checkPassword('Aaaaaaaaaaaa1A')).toBeNull();
    expect(checkPassword('Valiyev2026Kuch', { names: ['Valiyev'] })).toMatch(/ism/);
  });
  it('rol: PLAYER dan boshqasi boshqaruvchi', () => {
    expect(isPrivileged(['PLAYER'])).toBe(false);
    expect(isPrivileged(['PLAYER', 'REFEREE'])).toBe(true);
    expect(isPrivileged([])).toBe(false);
  });
});
