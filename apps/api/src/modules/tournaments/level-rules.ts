import { MatchStage, PointRuleKey } from '@prisma/client';

/**
 * Daraja reglamenti — to'rtta qiymat:
 *   1. ishtirok uchun ball,
 *   2. guruhdan chiqish uchun ball,
 *   3. har bir g'alaba uchun ball,
 *   4. finalda g'olib bo'lgani uchun ball.
 *
 * Sof funksiyalar — bazasiz test qilinadi.
 */

/** Reglamentdagi barcha kalitlar — forma va validatsiya uchun yagona manba */
export const POINT_RULE_KEYS: PointRuleKey[] = [
  PointRuleKey.PARTICIPATION,
  PointRuleKey.GROUP_ADVANCE,
  PointRuleKey.WIN,
  PointRuleKey.CHAMPION,
];

export const RULE_LABEL_UZ: Record<PointRuleKey, string> = {
  PARTICIPATION: 'Ishtirok uchun',
  GROUP_ADVANCE: 'Guruhdan chiqish',
  WIN: "Har bir g'alaba uchun",
  CHAMPION: "Finalda g'olib bo'lgani uchun",
};

export interface AwardShare {
  playerId: string;
  key: PointRuleKey;
  points: number;
}

/**
 * Yakunlangan o'yin uchun kimga qancha ball tegishini hisoblaydi.
 *
 *  - g'olib har bir g'alabasi uchun ball oladi (guruhda ham, setkada ham);
 *  - final g'olibi ustiga chempionlik ballini oladi;
 *  - `newParticipants` — shu musobaqada birinchi marta o'ynayotgan
 *    o'yinchilar; ular ishtirok ballini oladi (har musobaqada bir marta).
 *
 * Reglament bo'sh bo'lsa (eski darajalar) — `fallbackPoints` ishlatiladi:
 * bosqich balli × koeffitsiyent, faqat g'olibga.
 */
export function awardsForMatch(args: {
  stage: MatchStage;
  winnerId: string;
  loserId: string | null;
  newParticipants?: string[];
  rules: Map<PointRuleKey, number>;
  fallbackPoints: number;
}): AwardShare[] {
  const { stage, winnerId, rules, fallbackPoints } = args;

  if (rules.size === 0) {
    return fallbackPoints > 0
      ? [{ playerId: winnerId, key: PointRuleKey.WIN, points: fallbackPoints }]
      : [];
  }

  const awards: AwardShare[] = [];
  const add = (playerId: string | null | undefined, key: PointRuleKey) => {
    if (!playerId) return;
    const points = rules.get(key) ?? 0;
    if (points > 0) awards.push({ playerId, key, points });
  };

  // Ishtirok balli — musobaqadagi birinchi o'yinda, ikkala tomonga ham
  for (const playerId of args.newParticipants ?? []) {
    add(playerId, PointRuleKey.PARTICIPATION);
  }

  add(winnerId, PointRuleKey.WIN);
  if (stage === MatchStage.FINAL) add(winnerId, PointRuleKey.CHAMPION);

  return awards;
}
