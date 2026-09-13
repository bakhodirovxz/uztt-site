import { pickTranslation } from './locale.util';

const TRS = [
  { locale: 'uz', title: 'Sarlavha' },
  { locale: 'ru', title: 'Заголовок' },
  { locale: 'en', title: 'Title' },
];

describe('pickTranslation', () => {
  it("so'ralgan tilni qaytaradi", () => {
    expect(pickTranslation(TRS, 'ru')?.title).toBe('Заголовок');
    expect(pickTranslation(TRS, 'en')?.title).toBe('Title');
  });

  it("til berilmasa yoki noto'g'ri bo'lsa uz fallback", () => {
    expect(pickTranslation(TRS)?.title).toBe('Sarlavha');
    expect(pickTranslation(TRS, 'fr')?.title).toBe('Sarlavha');
  });

  it("so'ralgan til yo'q bo'lsa uz'ga tushadi", () => {
    const onlyUzRu = TRS.filter((t) => t.locale !== 'en');
    expect(pickTranslation(onlyUzRu, 'en')?.title).toBe('Sarlavha');
  });

  it("uz ham yo'q bo'lsa birinchisini oladi", () => {
    const onlyEn = [{ locale: 'en', title: 'Only EN' }];
    expect(pickTranslation(onlyEn, 'ru')?.title).toBe('Only EN');
  });

  it("bo'sh ro'yxatda null", () => {
    expect(pickTranslation([], 'uz')).toBeNull();
  });
});
