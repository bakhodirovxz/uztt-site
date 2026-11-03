/** Yarim final va final doim asosiy stolda (yuqori bosqichlarning o'yinchilari hali noma'lum bo'lishi mumkin) */
const KEY_STAGES = new Set(['SEMIFINAL', 'THIRD_PLACE', 'FINAL']);

export interface PlanMatch {
  id: string;
  stage: string;
  /** Ikki o'yinchining reyting ballari yig'indisi; juftlik noma'lum bo'lsa 0 */
  rating: number;
  table: number | null;
}

/**
 * Stolsiz o'yinlarga stol tanlaydi. Natija: faqat yangi belgilangan o'yinlar (id -> stol).
 *  - yarim final, 3-o'rin va final: asosiy stollarga;
 *  - qolganidan reytingi eng baland o'yinlar: asosiy stollarning ulushiga teng qismi asosiy stollarga
 *    (10 stoldan 2 tasi asosiy bo'lsa, o'yinlarning 20 foizi);
 *  - qolgani oddiy stollarga. Har guruhda eng kam o'yini bor stol tanlanadi.
 * Asosiy stol belgilanmagan yoki hamma stol asosiy bo'lsa, o'yinlar hamma stolga teng bo'linadi.
 */
export function planTables(
  matches: PlanMatch[],
  opts: { tableCount: number; mainTables: number[] },
): Map<string, number> {
  const tables = Array.from({ length: opts.tableCount }, (_, i) => i + 1);
  const main = tables.filter((n) => opts.mainTables.includes(n));
  const rest = tables.filter((n) => !main.includes(n));
  const mainPool = main.length ? main : tables;
  const restPool = rest.length ? rest : tables;

  const load = new Map<number, number>(tables.map((n) => [n, 0]));
  for (const m of matches) {
    if (m.table !== null && load.has(m.table)) load.set(m.table, load.get(m.table)! + 1);
  }
  const result = new Map<string, number>();
  const put = (m: PlanMatch, pool: number[]) => {
    const table = pool.reduce((best, n) => (load.get(n)! < load.get(best)! ? n : best));
    load.set(table, load.get(table)! + 1);
    result.set(m.id, table);
  };

  const pending = matches.filter((m) => m.table === null);
  const regular = pending.filter((m) => !KEY_STAGES.has(m.stage));
  pending.filter((m) => KEY_STAGES.has(m.stage)).forEach((m) => put(m, mainPool));

  const quota = main.length && rest.length ? Math.floor((regular.length * main.length) / tables.length) : 0;
  const top = new Set(
    regular
      .filter((m) => m.rating > 0)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, quota)
      .map((m) => m.id),
  );
  regular.forEach((m) => put(m, top.has(m.id) ? mainPool : restPool));
  return result;
}
