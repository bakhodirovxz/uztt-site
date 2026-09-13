/**
 * Reyting kesimlari uchun sof funksiyalar (bazasiz test qilinadi).
 */

/**
 * ISO-8601 hafta yorlig'i: "2026-W33".
 * ISO qoidasi: hafta dushanbadan boshlanadi, yilning 1-haftasi — 4-yanvar tushgan hafta.
 */
export function isoWeekLabel(date: Date): string {
  // UTC nusxada ishlaymiz — mahalliy vaqt mintaqasi haftani surib yubormasin
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  // Dushanba = 1 ... Yakshanba = 7
  const dayNum = d.getUTCDay() || 7;
  // Haftaning payshanbasiga siljitamiz — yil shu kun bo'yicha aniqlanadi
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export interface RankableEntry {
  playerId: string;
  points: number;
  /** Kesim yozilgandagi umumiy o'rin — teng ballda barqaror tartib beradi */
  rank: number;
}

/**
 * Filtrlangan ro'yxat ichida o'rinlarni qayta hisoblaydi:
 * ball bo'yicha kamayish tartibi, teng ballda kesimdagi eski o'rin.
 * Teng ballli o'yinchilar bir xil o'rinni oladi (sport reytinglaridagi odat).
 */
export function rankWithin(entries: RankableEntry[]): Map<string, number> {
  const sorted = [...entries].sort(
    (a, b) => b.points - a.points || a.rank - b.rank,
  );
  const ranks = new Map<string, number>();
  let lastPoints: number | null = null;
  let lastRank = 0;
  sorted.forEach((e, i) => {
    const rank = e.points === lastPoints ? lastRank : i + 1;
    ranks.set(e.playerId, rank);
    lastPoints = e.points;
    lastRank = rank;
  });
  return ranks;
}

/**
 * ▲▼ ko'rsatkichi: musbat — yuqoriga ko'tarilgan, manfiy — tushgan,
 * null — oldingi kesimda bo'lmagan (yangi o'yinchi).
 */
export function movementOf(
  currentRank: number,
  previousRank: number | undefined,
): number | null {
  if (previousRank === undefined) return null;
  return previousRank - currentRank;
}
