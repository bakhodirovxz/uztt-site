/**
 * Hakamlarni avtomatik tayinlash — sof funksiya (DB yo'q), shuning uchun to'liq test qilinadi.
 *
 * QAT'IY shartlar (buzilsa nomzod umuman olinmaydi):
 *  - hakam shu o'yin ishtirokchisi emas (4.6.1.1);
 *  - hakam "available" (kasal/dam olishda emas) va ARIZASI TASDIQLANGAN;
 *  - bir vaqtda ikki o'yinda emas (o'yin davomiyligi `slotMinutes`);
 *  - yordamchi hakam yetakchi hakamdan boshqa odam.
 * YUMSHOQ shartlar (ball; kichigi yaxshi):
 *  - xolislik: hakam ishtirokchilardan biri bilan bir hududdan bo'lmasin;
 *  - bosqich muhimligi: final/yarim finalga yuqori toifa;
 *  - yuklama: hammaga teng taqsimlash (hozirgi o'yinlar soni).
 */
export interface AsgMatch {
  id: string;
  stage: string;
  scheduledAt: Date | null;
  tableNumber: number | null;
  /** O'yinchilar (null — hali aniq emas) */
  playerIds: (string | null)[];
  playerRegions: (string | null)[];
  /** Allaqachon tayinlangan (qo'lda yoki oldingi chaqiruvdan) */
  refereeUserId: string | null;
  assistantUserId: string | null;
  /** Tugagan/boshlangan o'yinga tegmaymiz */
  locked: boolean;
}

export interface AsgReferee {
  userId: string;
  region: string | null;
  category: string | null; // INTERNATIONAL | NATIONAL | FIRST | SECOND | THIRD
  /** Shu hakam o'zi ham o'yinchi bo'lsa — uning Player.id si */
  ownPlayerId: string | null;
}

export interface AsgOptions {
  slotMinutes?: number;
  /** true — faqat hakami yo'q o'yinlarni to'ldiradi, mavjudlarini o'zgartirmaydi */
  onlyUnassigned?: boolean;
  needAssistant?: boolean;
}

export interface AsgResult {
  matchId: string;
  refereeUserId: string | null;
  assistantUserId: string | null;
  reason?: string;
}

const CAT_RANK: Record<string, number> = { INTERNATIONAL: 0, NATIONAL: 1, FIRST: 2, SECOND: 3, THIRD: 4 };
const catRank = (c: string | null) => (c && c in CAT_RANK ? CAT_RANK[c] : 5);

/** Bosqich uchun kerakli eng past toifa darajasi (kichik raqam = yuqori toifa) */
export function requiredRank(stage: string): number {
  switch (stage) {
    case 'FINAL':
    case 'THIRD_PLACE':
      return 1; // milliy yoki xalqaro
    case 'SEMIFINAL':
      return 2;
    case 'QUARTERFINAL':
      return 3;
    default:
      return 5;
  }
}

const norm = (r: string | null | undefined) => (r ?? '').trim().toLowerCase();

export function assignReferees(matches: AsgMatch[], referees: AsgReferee[], opts: AsgOptions = {}): AsgResult[] {
  const slotMs = (opts.slotMinutes ?? 45) * 60_000;
  const needAssistant = opts.needAssistant ?? true;
  const onlyUnassigned = opts.onlyUnassigned ?? true;

  // Yuklama: hozirgi tayinlar soni
  const load = new Map<string, number>(referees.map((r) => [r.userId, 0]));
  // Band intervallar: userId -> [start,end)
  const busy = new Map<string, Array<[number, number, string]>>();
  const addBusy = (uid: string, m: AsgMatch) => {
    if (!m.scheduledAt) return;
    const s = m.scheduledAt.getTime();
    const arr = busy.get(uid) ?? [];
    arr.push([s, s + slotMs, m.id]);
    busy.set(uid, arr);
  };
  const isBusy = (uid: string, m: AsgMatch) => {
    if (!m.scheduledAt) return false;
    const s = m.scheduledAt.getTime();
    return (busy.get(uid) ?? []).some(([a, b, id]) => id !== m.id && s < b && s + slotMs > a);
  };

  const keep = (m: AsgMatch) => m.locked || (onlyUnassigned && m.refereeUserId !== null);
  for (const m of matches) {
    // Saqlanadigan o'yinlarning tayinlari yuklama va bandlikka kiradi
    if (keep(m)) {
      for (const uid of [m.refereeUserId, m.assistantUserId]) {
        if (!uid) continue;
        load.set(uid, (load.get(uid) ?? 0) + 1);
        addBusy(uid, m);
      }
    }
  }

  // O'yinchilari hali aniq bo'lmagan o'yinlarga tayinlanmaydi: 4.6.1.1 va xolislikni tekshirib
  // bo'lmaydi (hakam-o'yinchi keyin o'z o'yiniga tushib qolishi mumkin). Juftlik aniq bo'lgach
  // (o'yin tugaganda autoAssign) tayinlanadi.
  const todo = matches
    .filter((m) => !keep(m) && m.playerIds.length === 2 && m.playerIds.every((p) => !!p))
    .sort((a, b) => {
      // Muhim bosqichlar birinchi (eng yaxshi hakamlar ularga tegsin), keyin vaqt bo'yicha
      const ra = requiredRank(a.stage), rb = requiredRank(b.stage);
      if (ra !== rb) return ra - rb;
      const ta = a.scheduledAt?.getTime() ?? Infinity, tb = b.scheduledAt?.getTime() ?? Infinity;
      if (ta !== tb) return ta - tb;
      return a.id < b.id ? -1 : 1;
    });

  const results: AsgResult[] = [];

  const score = (r: AsgReferee, m: AsgMatch): number => {
    let s = (load.get(r.userId) ?? 0) * 10;
    const rr = norm(r.region);
    if (rr && m.playerRegions.some((x) => norm(x) === rr)) s += 40; // xolislik
    const need = requiredRank(m.stage);
    const have = catRank(r.category);
    if (have > need) s += 30 * (have - need); // toifa yetmaydi
    else s += (need - have) * 2; // kerak bo'lmagan yuqori toifani arzon o'yinlarga sarflamaslik
    return s;
  };

  const pick = (m: AsgMatch, exclude: string | null): AsgReferee | null => {
    const cands = referees.filter(
      (r) =>
        r.userId !== exclude &&
        !(r.ownPlayerId && m.playerIds.includes(r.ownPlayerId)) &&
        !isBusy(r.userId, m),
    );
    if (!cands.length) return null;
    cands.sort((a, b) => score(a, m) - score(b, m) || (a.userId < b.userId ? -1 : 1));
    return cands[0];
  };

  for (const m of todo) {
    const main = pick(m, null);
    if (!main) {
      results.push({ matchId: m.id, refereeUserId: null, assistantUserId: null, reason: 'Bo‘sh hakam topilmadi' });
      continue;
    }
    load.set(main.userId, (load.get(main.userId) ?? 0) + 1);
    addBusy(main.userId, m);
    let assistant: AsgReferee | null = null;
    if (needAssistant) {
      assistant = pick(m, main.userId);
      if (assistant) {
        load.set(assistant.userId, (load.get(assistant.userId) ?? 0) + 1);
        addBusy(assistant.userId, m);
      }
    }
    results.push({
      matchId: m.id,
      refereeUserId: main.userId,
      assistantUserId: assistant?.userId ?? null,
      reason: needAssistant && !assistant ? 'Yordamchi hakam topilmadi' : undefined,
    });
  }
  return results;
}
