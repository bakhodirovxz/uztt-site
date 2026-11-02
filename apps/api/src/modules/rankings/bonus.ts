import type { Prisma } from '@prisma/client';

/** Nizom 1–8-o'rin bonusi jurnal izohining boshi: `Nizom: bonus (N-o'rin)` */
export const BONUS_NOTE = 'Nizom: bonus';

export function bonusNote(place: number): string {
  return `${BONUS_NOTE} (${place}-o'rin)`;
}

/**
 * Musobaqa bo'yicha bonus berishni ketma-ketlashtiradi (tranzaksiya oxirigacha). O'yin tugashidagi
 * avtomatik bonus va qo'lda `?apply=1` bir vaqtda kelsa ham bonus ikki marta yozilmaydi.
 */
export async function lockTournamentRating(
  tx: Prisma.TransactionClient,
  tournamentId: string,
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`rating:${tournamentId}`}))`;
}

/**
 * Shu musobaqada bonusi HOZIR amalda bo'lgan o'yinchilar: bonus yozuvlari (va ularning undo
 * qaytarishlari) sof yig'indisi > 0. Undo qilingan bonus qayta berilishi mumkin.
 */
export async function playersWithBonus(
  tx: Prisma.TransactionClient,
  tournamentId: string,
): Promise<Set<string>> {
  const rows = await tx.playerPointsLog.groupBy({
    by: ['playerId'],
    where: { tournamentId, note: { startsWith: BONUS_NOTE } },
    _sum: { delta: true },
  });
  return new Set(
    rows.filter((r) => (r._sum.delta ?? 0) > 0).map((r) => r.playerId),
  );
}
