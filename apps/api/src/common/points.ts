import type { PointsLogReason, Prisma } from '@prisma/client';

/**
 * Reglament: ball faqat BUTUN son va hech qachon 0 dan kichik emas.
 * 59.2 → 59, 59.5 → 60, manfiy → 0.
 */
export function toPoints(value: number | null | undefined): number {
  const v = Number(value ?? 0);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.round(v));
}

/** Butun songa yaxlitlangan delta (NaN/Infinity → 0) */
function wholeOf(delta: number): number {
  return Math.round(Number.isFinite(delta) ? delta : 0);
}

/**
 * O'yinchi reyting ballini o'zgartiradi (delta butun songa yaxlitlanadi) va
 * natija hech qachon 0 dan pastga tushmaydi (undo/qo'lda tuzatishda ham).
 * Atomik: bitta UPDATE, o'qib-yozish poygasi yo'q.
 *
 * DIQQAT: jurnal yozadigan joylar `applyPoints` dan foydalansin — u haqiqatda
 * qo'llangan deltani (0 chegarasidan keyin) jurnalga yozadi.
 */
export async function addPlayerPoints(
  tx: Prisma.TransactionClient,
  playerId: string,
  delta: number,
): Promise<void> {
  const d = wholeOf(delta);
  await tx.$executeRaw`
    UPDATE players
       SET ranking_points = GREATEST(0, ranking_points + ${d}),
           updated_at = NOW()
     WHERE id = ${playerId}`;
}

// ==================== BALL JURNALI (ledger) ====================

/** 0 chegarasi bilan qo'llash: haqiqiy yangi qiymat va haqiqatda qo'llangan delta */
export function floorApply(
  before: number,
  delta: number,
): { after: number; applied: number } {
  const after = Math.max(0, before + wholeOf(delta));
  return { after, applied: after - before };
}

/**
 * Jurnaldagi `exact` ni 0 chegarasi kesgan qism bilan tuzatadi: `Σexact − Σdelta` (kasr qoldig'i)
 * o'zgarmay qoladi, shuning uchun keyingi `wholeDelta` kesilgan ballni "qaytarib olishga" urinmaydi.
 */
export function loggedExact(
  exact: number | null | undefined,
  requested: number,
  applied: number,
): number | null {
  if (exact === null || exact === undefined) return null;
  return exact + (applied - wholeOf(requested));
}

export interface LedgerEntry {
  playerId: string;
  delta: number;
  reason: PointsLogReason;
  matchId?: string | null;
  tournamentId?: string | null;
  note?: string | null;
  exact?: number | null;
  createdById?: string | null;
}

/**
 * Ballni qo'llaydi VA jurnalga yozadi — bitta joyda. Jurnalga so'ralgan emas, HAQIQATDA
 * qo'llangan delta yoziladi (0 chegarasi kesgan bo'lsa ham `rankingPoints == Σ delta` saqlanadi),
 * shuning uchun undo hech qachon "yo'qdan" ball yaratmaydi.
 * Qaytadi: haqiqatda qo'llangan delta.
 */
export async function applyPoints(
  tx: Prisma.TransactionClient,
  e: LedgerEntry,
): Promise<number> {
  const d = wholeOf(e.delta);
  // Qatorni qulflab eski qiymatni o'qiymiz (tranzaksiya oxirigacha hech kim o'zgartira olmaydi),
  // so'ng yangilab yangi qiymatni RETURNING bilan olamiz
  const locked = await tx.$queryRaw<Array<{ before: number }>>`
    SELECT ranking_points AS "before" FROM players WHERE id = ${e.playerId} FOR UPDATE`;
  if (locked.length === 0) throw new Error(`O'yinchi topilmadi: ${e.playerId}`);
  const updated = await tx.$queryRaw<Array<{ after: number }>>`
    UPDATE players
       SET ranking_points = GREATEST(0, ranking_points + ${d}),
           updated_at = NOW()
     WHERE id = ${e.playerId}
 RETURNING ranking_points AS "after"`;
  const applied = Number(updated[0].after) - Number(locked[0].before);
  await tx.playerPointsLog.create({
    data: {
      playerId: e.playerId,
      delta: applied,
      exact: loggedExact(e.exact, d, applied),
      reason: e.reason,
      matchId: e.matchId ?? null,
      tournamentId: e.tournamentId ?? null,
      note: e.note ?? null,
      createdById: e.createdById ?? null,
    },
  });
  return applied;
}

export interface LogRow {
  playerId: string;
  note: string | null;
  delta: number;
  exact: number | null;
}

/**
 * Undo uchun: o'yin bo'yicha jurnal yozuvlarining (MATCH_WIN + oldingi UNDO) SOF yig'indisini
 * har (o'yinchi, izoh) jufti bo'yicha teskari qiladi. Bir necha marta "tugadi → undo" sikli
 * bo'lsa ham har biri faqat bir marta qaytariladi. Nol natijalar tashlab yuboriladi.
 */
export function netReversal(rows: LogRow[]): LogRow[] {
  const acc = new Map<string, LogRow & { hasExact: boolean }>();
  for (const r of rows) {
    const key = `${r.playerId}\u0000${r.note ?? ''}`;
    const cur = acc.get(key) ?? {
      playerId: r.playerId,
      note: r.note,
      delta: 0,
      exact: 0,
      hasExact: false,
    };
    cur.delta += r.delta;
    if (r.exact !== null && r.exact !== undefined) {
      cur.exact = (cur.exact ?? 0) + r.exact;
      cur.hasExact = true;
    }
    acc.set(key, cur);
  }
  const out: LogRow[] = [];
  for (const v of acc.values()) {
    const exact = v.hasExact ? v.exact ?? 0 : null;
    const zeroExact = exact === null || Math.abs(exact) < 1e-9;
    if (v.delta === 0 && zeroExact) continue;
    out.push({
      playerId: v.playerId,
      note: v.note,
      delta: 0 - v.delta, // `0 - x`: -0 chiqmasin
      exact: exact === null ? null : 0 - exact,
    });
  }
  return out;
}
