/**
 * Hududlar nomi — yagona o'zbekcha ko'rinish. uttf.uz inglizcha beradi ("Tashkent City"),
 * eski ma'lumotlarda esa turli yozuvlar ("Toshkent", "Samarkand"…) bor.
 */
export const REGIONS_UZ = [
  'Toshkent shahri',
  'Toshkent viloyati',
  'Andijon viloyati',
  'Buxoro viloyati',
  "Farg'ona viloyati",
  'Jizzax viloyati',
  'Xorazm viloyati',
  'Namangan viloyati',
  'Navoiy viloyati',
  'Qashqadaryo viloyati',
  "Qoraqalpog'iston Respublikasi",
  'Samarqand viloyati',
  'Sirdaryo viloyati',
  'Surxondaryo viloyati',
] as const;

export const REGION_ALIASES: Array<[string, string[]]> = [
  ['Toshkent shahri', ['tashkent city', 'toshkent', 'toshkent sh.', 'toshkent shahar', 'tashkent', 'ташкент', 'г. ташкент', 'город ташкент']],
  ['Toshkent viloyati', ['tashkent region', 'toshkent vil.', 'toshkent viloyat', 'ташкентская область']],
  ['Andijon viloyati', ['andijan region', 'andijan', 'andijon', 'андижанская область']],
  ['Buxoro viloyati', ['bukhara region', 'bukhara', 'buxoro', 'бухарская область']],
  ["Farg'ona viloyati", ['fergana region', 'fergana', "farg'ona", 'fargona', 'farg‘ona', 'ферганская область']],
  ['Jizzax viloyati', ['jizzakh region', 'jizzakh', 'jizzax', 'джизакская область']],
  ['Xorazm viloyati', ['khorezm region', 'khorezm', 'xorazm', 'хорезмская область']],
  ['Namangan viloyati', ['namangan region', 'namangan', 'наманганская область']],
  ['Navoiy viloyati', ['navoi region', 'navoi', 'navoiy', 'навоийская область']],
  ['Qashqadaryo viloyati', ['kashkadarya region', 'kashkadarya', 'qashqadaryo', 'кашкадарьинская область']],
  ["Qoraqalpog'iston Respublikasi", ['republic of karakalpakstan', 'karakalpakstan', "qoraqalpog'iston", 'qoraqalpogiston', 'qoraqalpog‘iston', 'qoraqalpog‘iston respublikasi', 'республика каракалпакстан']],
  ['Samarqand viloyati', ['samarkand region', 'samarkand', 'samarqand', 'самаркандская область']],
  ['Sirdaryo viloyati', ['syrdarya region', 'syrdarya', 'sirdaryo', 'сырдарьинская область']],
  ['Surxondaryo viloyati', ['surkhandarya region', 'surkhandarya', 'surxondaryo', 'сурхандарьинская область']],
];

const LOOKUP = new Map<string, string>();
for (const [uz, list] of REGION_ALIASES) {
  LOOKUP.set(uz.toLowerCase(), uz);
  for (const a of list) LOOKUP.set(a.toLowerCase(), uz);
}

/** Hudud nomini o'zbekcha to'liq shaklga keltiradi; noma'lum bo'lsa o'zini qaytaradi */
export function normalizeRegion(v: string | null | undefined): string {
  const s = (v ?? '').trim();
  if (!s) return '';
  return LOOKUP.get(s.toLowerCase()) ?? s;
}

/** Kartochka/sahnalar uchun qisqa shakl: "Farg'ona", "Toshkent sh.", "Toshkent vil.", "Qoraqalpog'iston" */
export function regionShort(v: string | null | undefined): string {
  const full = normalizeRegion(v);
  if (full === 'Toshkent shahri') return 'Toshkent sh.';
  if (full === 'Toshkent viloyati') return 'Toshkent vil.';
  if (full === "Qoraqalpog'iston Respublikasi") return "Qoraqalpog'iston";
  return full.replace(/ viloyati$/, '');
}
