/**
 * Rasmiy reyting formulalari — "Sportchilarga reyting ballari berish tartibi
 * to'g'risida"gi Nizom (O'zSTF Ijroiya qo'mitasi, 3-ilova) bo'yicha.
 *
 *   1-formula:  Р = ЖР + К · МРБ − Ж + Б
 *   2-formula:  ҒРБ = (100 − (ҒР − ЮР)) / 10      (g'olib; farq 100 dan katta bo'lsa — 0)
 *   3-formula:  ЮРБ = −(100 − (ҒР − ЮР)) / 20     (mag'lub)
 *   20-band:    reytinglari teng bo'lsa g'olibga +10, mag'lubga −10
 *   21-band:    texnik g'alabalar uchun ball qo'shilmaydi
 *
 * Reglament: ball faqat BUTUN va 0 dan kichik emas (yaxlitlash — oddiy, .5 → yuqoriga).
 * Sof funksiyalar — bazasiz test qilinadi.
 */

/** Spetsifikatsiyada aytilmagan: g'olib reytingi 100 dan ko'p yuqori bo'lsa (ball 0), mag'lub ham ball OLMAYDI. */
export function winnerMatchPoints(gr: number, yr: number): number {
  if (gr === yr) return 10;
  const d = gr - yr;
  if (d > 100) return 0;
  return (100 - d) / 10;
}

/** Mag'lubdan ayiriladigan ball (≤ 0). Mag'lub hech qachon ball ORTTIRMAYDI. */
export function loserMatchPoints(gr: number, yr: number): number {
  if (gr === yr) return -10;
  const d = gr - yr;
  if (d > 100) return 0;
  return -((100 - d) / 20);
}

/** Yosh bo'yicha ustun: 0 katta, 1 — 19 gacha, 2 — 17 gacha, 3 — 15 gacha, 4 — 11–13 gacha */
export function ageColumn(ageCategoryCode: string | null | undefined): number {
  switch ((ageCategoryCode ?? 'SENIOR').toUpperCase()) {
    case 'U19':
      return 1;
    case 'U17':
      return 2;
    case 'U15':
      return 3;
    case 'U13':
    case 'U11':
    case 'U9':
      return 4;
    default:
      return 0;
  }
}

/** 1-ilova: [katta, 19, 17, 15, 11-13] — asosiy K bo'yicha qator */
const K_TABLE: Array<{ base: number; row: number[] }> = [
  { base: 1.0, row: [1.0, 0.8, 0.6, 0.4, 0.2] }, // O'zbekiston chempionati
  { base: 0.9, row: [0.9, 0.7, 0.5, 0.3, 0.1] }, // O'zbekiston kubogi
  { base: 0.5, row: [0.5, 0.4, 0.3, 0.2, 0.1] }, // Qoraqalpog'iston, Toshkent sh., viloyat
];

/**
 * Musobaqa koeffitsiyenti K.
 * `baseK` — darajaning (katta yoshlar uchun) koeffitsiyenti. 1.0 / 0.9 / 0.5 bo'lsa
 * 1-ilova qatori yosh bo'yicha qo'llanadi; boshqa qiymat (pro-tur — Komissiya
 * 0.1–1 oralig'ida belgilaydi) barcha yoshlar uchun o'zgarmaydi.
 */
export function tournamentK(
  baseK: number,
  ageCategoryCode?: string | null,
): number {
  const hit = K_TABLE.find((r) => Math.abs(r.base - baseK) < 1e-9);
  if (!hit) return Math.min(1, Math.max(0.1, baseK));
  return hit.row[ageColumn(ageCategoryCode)];
}

/** 2-ilova: o'rin (1–8) × daraja koeffitsiyenti (1.0 … 0.1) bo'yicha bonus */
const BONUS: Record<number, number[]> = {
  //          1.0 0.9 0.8 0.7 0.6 0.5 0.4 0.3 0.2 0.1
  1: [50, 45, 40, 35, 30, 25, 20, 15, 10, 5],
  2: [45, 40, 35, 30, 25, 20, 15, 10, 5, 3],
  3: [40, 35, 30, 25, 20, 15, 10, 8, 4, 2],
  4: [35, 30, 25, 20, 15, 10, 8, 4, 2, 1],
  5: [30, 25, 20, 15, 10, 5, 4, 2, 1, 1],
  6: [25, 20, 15, 10, 5, 4, 2, 1, 1, 1],
  7: [20, 15, 10, 8, 4, 2, 1, 1, 1, 1],
  8: [15, 10, 8, 4, 2, 1, 1, 1, 1, 1],
};
/** Jarimalar qatori (2-ilova) — daraja koeffitsiyenti bo'yicha */
const PENALTY = [50, 45, 40, 35, 30, 25, 20, 15, 10, 5];

/** K (0.1…1.0) → jadval ustuni (0 = 1.0, 9 = 0.1) */
function levelColumn(k: number): number {
  const tenths = Math.min(10, Math.max(1, Math.round(k * 10)));
  return 10 - tenths;
}

/** 1–8-o'rin uchun bonus; 9+ o'rin yoki noto'g'ri qiymat — 0 */
export function placeBonus(place: number, k: number): number {
  const row = BONUS[place];
  return row ? row[levelColumn(k)] : 0;
}

/** Jarima (Ж) — to'liq jarima miqdori; hakam taqdimnomasi bo'yicha qo'llanadi */
export function penaltyPoints(k: number): number {
  return PENALTY[levelColumn(k)];
}

/** Ball: butun, ≥ 0 */
export function toWholePoints(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.round(v));
}

/** 1-formula: Р = ЖР + К·МРБ − Ж + Б */
export function finalRating(args: {
  current: number; // ЖР
  k: number; // К
  mrb: number; // МРБ
  penalty?: number; // Ж
  bonus?: number; // Б
}): number {
  const { current, k, mrb, penalty = 0, bonus = 0 } = args;
  return toWholePoints(current + k * mrb - penalty + bonus);
}

/**
 * Bitta o'yin uchun ikkala tomonning K bilan ko'paytirilgan (aniq, kasrli) ballari.
 * Texnik g'alaba (diskvalifikatsiya) uchun ball YO'Q (21-band).
 */
export function matchExactPoints(args: {
  winnerRating: number; // ҒР
  loserRating: number; // ЮР
  k: number;
  technical?: boolean;
}): { winner: number; loser: number } {
  if (args.technical) return { winner: 0, loser: 0 };
  const { winnerRating: gr, loserRating: yr, k } = args;
  return {
    winner: k * winnerMatchPoints(gr, yr),
    loser: k * loserMatchPoints(gr, yr),
  };
}

/**
 * Jami aniq ball o'sganda BUTUN ball o'zgarishini beradi: yaxlitlash faqat
 * yig'indiga qo'llanadi (Σ butun o'zgarishlar = round(K·МРБ)), shuning uchun
 * har o'yin alohida yaxlitlanganda yig'iladigan xato bo'lmaydi.
 */
export function wholeDelta(args: {
  exactTotalAfter: number; // shu o'yingacha va shu o'yin bilan jami aniq ball
  wholeSoFar: number; // shu musobaqada allaqachon berilgan butun ballar yig'indisi
}): number {
  return Math.round(args.exactTotalAfter) - args.wholeSoFar;
}

/**
 * Musobaqada egallagan o'rin — bosqichga qarab (3-o'rin uchun alohida o'yin yo'q):
 * final g'olibi 1, finalda yutqazgan 2, yarim final yutqazganlari 3,
 * chorak final yutqazganlari 5. (1/8 va undan oldingilar bonus olmaydi.)
 */
export function placeFromExit(
  stage: 'FINAL' | 'THIRD_PLACE' | 'SEMIFINAL' | 'QUARTERFINAL' | string,
  won: boolean,
): number | null {
  if (stage === 'FINAL') return won ? 1 : 2;
  if (stage === 'THIRD_PLACE') return won ? 3 : 4;
  if (stage === 'SEMIFINAL') return won ? null : 3;
  if (stage === 'QUARTERFINAL') return won ? null : 5;
  return null;
}
