import type { Prisma } from '@prisma/client';

/**
 * Kategoriya qatorini tranzaksiya oxirigacha qulflaydi (SELECT … FOR UPDATE). Setka yaratish,
 * guruh yaratish va guruhdan setkaga o'tkazish shu orqali ketma-ket bajariladi — bir kategoriyada
 * ikkita setka yoki setka + guruh paydo bo'lmaydi (bazada unique cheklov yo'q).
 */
export async function lockCategory(
  tx: Prisma.TransactionClient,
  tournamentCategoryId: string,
): Promise<void> {
  await tx.$queryRaw`SELECT id FROM tournament_categories WHERE id = ${tournamentCategoryId} FOR UPDATE`;
}
