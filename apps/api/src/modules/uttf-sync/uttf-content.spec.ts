import { clean, slugOf } from './uttf-content.service';

describe('uttf content yordamchilari', () => {
  it('manba axlat qiymatlarini bo‘sh deb hisoblaydi', () => {
    expect(clean('нулл нулл нулл')).toBeNull();
    expect(clean(' null ')).toBeNull();
    expect(clean('')).toBeNull();
    expect(clean(null)).toBeNull();
    expect(clean(' Ali Valiyev ')).toBe('Ali Valiyev');
  });
  it('slug barqaror va id bilan tugaydi', () => {
    expect(slugOf('"ADU" Sport klubi', 1062)).toBe('adu-sport-klubi-1062');
    expect(slugOf("Farg'ona kubogi", 7)).toBe('fargona-kubogi-7');
    expect(slugOf('!!!', 5)).toBe('item-5');
  });
});
