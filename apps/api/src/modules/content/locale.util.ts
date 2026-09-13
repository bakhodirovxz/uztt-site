/** Tarjimalar ichidan so'ralgan tilni (bo'lmasa uz) tanlash yordamchisi */
export function pickTranslation<T extends { locale: string }>(
  translations: T[],
  locale?: string,
): T | null {
  const loc = ['uz', 'ru', 'en'].includes(locale ?? '') ? locale : 'uz';
  return (
    translations.find((t) => t.locale === loc) ??
    translations.find((t) => t.locale === 'uz') ??
    translations[0] ??
    null
  );
}
