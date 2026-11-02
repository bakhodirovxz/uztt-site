import { normalizeRegion, regionShort, REGIONS_UZ } from './regions';

describe('hududlar (o‘zbekcha)', () => {
  it.each([
    ['Tashkent City', 'Toshkent shahri'],
    ['Tashkent Region', 'Toshkent viloyati'],
    ['Fergana Region', "Farg'ona viloyati"],
    ['Republic of Karakalpakstan', "Qoraqalpog'iston Respublikasi"],
    ['Syrdarya Region', 'Sirdaryo viloyati'],
    ['Kashkadarya Region', 'Qashqadaryo viloyati'],
    ['Toshkent', 'Toshkent shahri'],
    ['Samarqand', 'Samarqand viloyati'],
    ['Surkhandarya Region', 'Surxondaryo viloyati'],
  ])('%s → %s', (input, expected) => expect(normalizeRegion(input)).toBe(expected));

  it('barcha 14 hudud o‘zbekcha yozuvi o‘zgarmaydi; noma‘lum matn saqlanadi', () => {
    for (const r of REGIONS_UZ) expect(normalizeRegion(r)).toBe(r);
    expect(REGIONS_UZ).toHaveLength(14);
    expect(normalizeRegion('Noma‘lum joy')).toBe('Noma‘lum joy');
    expect(normalizeRegion(null)).toBe('');
  });

  it.each([
    ['Farg‘ona viloyati'],
    ['Farg’ona viloyati'],
    ['Fargʻona viloyati'],
    ['  fargʼona   VILOYATI '],
  ])('apostrof turidan qat’i nazar bitta hudud: %j', (input) => {
    expect(normalizeRegion(input)).toBe("Farg'ona viloyati");
  });

  it("Qoraqalpog'iston: o'zbek lotin apostrofi (ʻ) bilan", () => {
    expect(normalizeRegion('Qoraqalpogʻiston Respublikasi')).toBe("Qoraqalpog'iston Respublikasi");
  });

  it('qisqa shakl: kartochkaga sig‘adi', () => {
    expect(regionShort('Fergana Region')).toBe("Farg'ona");
    expect(regionShort('Republic of Karakalpakstan')).toBe("Qoraqalpog'iston");
    expect(regionShort('Tashkent City')).toBe('Toshkent sh.');
    for (const r of REGIONS_UZ) expect(regionShort(r).length).toBeLessThanOrEqual(17);
  });
});
