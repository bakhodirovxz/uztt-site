import type { Prisma } from '@prisma/client';

/**
 * Reglament: ball faqat BUTUN son va hech qachon 0 dan kichik emas.
 * 59.2 → 59, 59.5 → 60, manfiy → 0.
 */
export function toPoints(value: number | null | undefined): number {
  const v = Number(value ?? 0);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.round(v));
}

/**
 * O'yinchi reyting ballini o'zgartiradi (delta butun songa yaxlitlanadi) va
 * natija hech qachon 0 dan pastga tushmaydi (undo/qo'lda tuzatishda ham).
 * Atomik: bitta UPDATE, o'qib-yozish poygasi yo'q.
 */
export async function addPlayerPoints(
  tx: Prisma.TransactionClient,
  playerId: string,
  delta: number,
): Promise<void> {
  const d = Math.round(Number.isFinite(delta) ? delta : 0);
  await tx.$executeRaw`
    UPDATE players
       SET ranking_points = GREATEST(0, ranking_points + ${d}),
           updated_at = NOW()
     WHERE id = ${playerId}`;
}
