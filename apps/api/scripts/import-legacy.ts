/**
 * Legacy MVP (JSON baza) → Postgres ko'chirish.
 *
 * Manba: legacy/backend/data/db.json (users, players, tournaments, matches,
 * rankingPointsTable, news). Skript IDEMPOTENT: qayta ishga tushirilsa
 * dublikat yaratmaydi (litsenziya raqami / slug / nom bo'yicha solishtiradi).
 *
 * Ishga tushirish:
 *   pnpm import:legacy                      # quruq yugurish (hech narsa yozilmaydi)
 *   pnpm import:legacy -- --apply           # haqiqiy import
 *   pnpm import:legacy -- --apply --file=/yo'l/db.json
 *
 * DIQQAT: legacy'da parollar bcrypt bilan hashlangan, bizda argon2id.
 * Foydalanuvchilar KO'CHIRILMAYDI — ular panelda qayta ochiladi va parol
 * tiklanadi (hash formatini "ko'chirish" xavfsizlikni pasaytirardi).
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomInt } from 'node:crypto';
import { Gender, MatchStage, MatchStatus, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const fileArg = args.find((a) => a.startsWith('--file='))?.slice('--file='.length);

/** Skript apps/api ichidan ishga tushadi — legacy monorepo ildizida turadi */
const DEFAULT_LOCATIONS = [
  join(process.cwd(), '..', '..', 'legacy', 'backend', 'data', 'db.json'),
  join(process.cwd(), 'legacy', 'backend', 'data', 'db.json'),
];
const DB_FILE =
  fileArg ?? DEFAULT_LOCATIONS.find((p) => existsSync(p)) ?? DEFAULT_LOCATIONS[0];

interface LegacyPlayer {
  id: string;
  fullName: string;
  gender: 'MALE' | 'FEMALE';
  ageCategory?: string;
  region?: string;
  club?: string | null;
  licenseNumber?: string | null;
  rankingPoints?: number;
  photoUrl?: string | null;
}

interface LegacyTournament {
  id: string;
  name: string;
  levelName?: string;
  levelCoefficient?: number;
  location?: string;
  startDate?: number;
  endDate?: number;
  status?: string;
}

interface LegacyMatch {
  id: string;
  tournamentId: string;
  stage?: string;
  tableNumber?: number | null;
  scheduledTime?: number | null;
  bestOf?: number;
  player1Id?: string | null;
  player2Id?: string | null;
  player1SetsWon?: number;
  player2SetsWon?: number;
  currentSet?: { p1: number; p2: number };
  sets?: Array<{ p1: number; p2: number }>;
  status?: string;
  winnerId?: string | null;
}

interface LegacyNews {
  id: string;
  title: string;
  slug?: string;
  body: string;
  category?: string;
  status?: string;
  publishedAt?: number;
}

interface LegacyDb {
  players?: LegacyPlayer[];
  tournaments?: LegacyTournament[];
  matches?: LegacyMatch[];
  news?: LegacyNews[];
}

const STAGE_MAP: Record<string, MatchStage> = {
  final: MatchStage.FINAL,
  semifinal: MatchStage.SEMIFINAL,
  quarterfinal: MatchStage.QUARTERFINAL,
  round_of_16: MatchStage.ROUND_OF_16,
  round_of_32: MatchStage.ROUND_OF_32,
  round1: MatchStage.ROUND_1,
  group: MatchStage.GROUP,
};

const STATUS_MAP: Record<string, MatchStatus> = {
  scheduled: MatchStatus.SCHEDULED,
  live: MatchStatus.LIVE,
  finished: MatchStatus.FINISHED,
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/['ʻʼ`’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'obyekt';

/** "Jasur Rahimov" → { firstName: 'Jasur', lastName: 'Rahimov' } */
function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

const log = (msg: string) => console.log(msg);
const plan: string[] = [];

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  for (let i = 2; ; i++) {
    const taken = await prisma.player.findUnique({ where: { slug } });
    if (!taken) return slug;
    slug = `${base}-${i}`;
  }
}

async function main() {
  if (!existsSync(DB_FILE)) {
    console.error(`Manba topilmadi: ${DB_FILE}`);
    console.error('--file= bilan yo‘lni ko‘rsating.');
    process.exit(1);
  }

  const db = JSON.parse(readFileSync(DB_FILE, 'utf8')) as LegacyDb;
  log(`Manba: ${DB_FILE}`);
  log(
    `Topildi: ${db.players?.length ?? 0} o'yinchi, ${db.tournaments?.length ?? 0} musobaqa, ` +
      `${db.matches?.length ?? 0} o'yin, ${db.news?.length ?? 0} yangilik`,
  );
  if (!APPLY) log('\n— QURUQ YUGURISH (--apply berilmagan, baza o‘zgarmaydi) —\n');

  // ==================== O'YINCHILAR ====================
  const playerIdMap = new Map<string, string>(); // legacy id → yangi id

  for (const lp of db.players ?? []) {
    const { firstName, lastName } = splitName(lp.fullName);
    const existing = lp.licenseNumber
      ? await prisma.player.findUnique({
          where: { licenseNumber: lp.licenseNumber },
        })
      : await prisma.player.findFirst({ where: { firstName, lastName } });

    if (existing) {
      playerIdMap.set(lp.id, existing.id);
      plan.push(`= o'yinchi mavjud: ${lp.fullName}`);
      continue;
    }

    plan.push(`+ o'yinchi: ${lp.fullName} (${lp.region ?? '—'})`);
    if (!APPLY) continue;

    const created = await prisma.player.create({
      data: {
        slug: await uniqueSlug(slugify(lp.fullName)),
        firstName,
        lastName,
        gender: lp.gender === 'FEMALE' ? Gender.FEMALE : Gender.MALE,
        region: lp.region ?? 'Toshkent',
        club: lp.club ?? undefined,
        licenseNumber: lp.licenseNumber ?? undefined,
        rankingPoints: lp.rankingPoints ?? 0,
        photoUrl: lp.photoUrl ?? undefined,
        status: 'ACTIVE',
      },
    });
    playerIdMap.set(lp.id, created.id);
  }

  // ==================== MUSOBAQALAR ====================
  const tournamentIdMap = new Map<string, string>();

  for (const lt of db.tournaments ?? []) {
    const existing = await prisma.tournament.findFirst({
      where: { name: lt.name },
    });
    if (existing) {
      tournamentIdMap.set(lt.id, existing.id);
      plan.push(`= musobaqa mavjud: ${lt.name}`);
      continue;
    }

    // Daraja koeffitsiyent bo'yicha topiladi; bo'lmasa NATIONAL zaxira
    const level =
      (lt.levelCoefficient
        ? await prisma.tournamentLevel.findFirst({
            where: { coefficient: lt.levelCoefficient },
          })
        : null) ??
      (await prisma.tournamentLevel.findFirst({ orderBy: { coefficient: 'desc' } }));

    if (!level) {
      console.error('Turnir darajalari bazada yo‘q — avval seed bajaring.');
      process.exit(1);
    }

    plan.push(`+ musobaqa: ${lt.name}`);
    if (!APPLY) continue;

    const created = await prisma.tournament.create({
      data: {
        slug: slugify(lt.name),
        name: lt.name,
        levelId: level.id,
        city: lt.location?.split(',')[0]?.trim(),
        venue: lt.location?.split(',').slice(1).join(',').trim() || undefined,
        startDate: new Date(lt.startDate ?? Date.now()),
        endDate: new Date(lt.endDate ?? Date.now()),
        status:
          lt.status === 'live'
            ? 'LIVE'
            : lt.status === 'finished'
              ? 'FINISHED'
              : 'UPCOMING',
      },
    });
    tournamentIdMap.set(lt.id, created.id);
  }

  // ==================== O'YINLAR ====================
  for (const lm of db.matches ?? []) {
    const tournamentId = tournamentIdMap.get(lm.tournamentId);
    if (!tournamentId) {
      plan.push(`! o'yin tashlab ketildi (musobaqa topilmadi): ${lm.id}`);
      continue;
    }

    const player1Id = lm.player1Id ? playerIdMap.get(lm.player1Id) : undefined;
    const player2Id = lm.player2Id ? playerIdMap.get(lm.player2Id) : undefined;

    const duplicate = await prisma.match.findFirst({
      where: {
        tournamentId,
        player1Id: player1Id ?? null,
        player2Id: player2Id ?? null,
        stage: STAGE_MAP[lm.stage ?? 'round1'] ?? MatchStage.ROUND_1,
      },
    });
    if (duplicate) {
      plan.push(`= o'yin mavjud: ${lm.stage ?? '—'} (${lm.id})`);
      continue;
    }

    plan.push(
      `+ o'yin: ${lm.stage ?? 'round1'} · stol ${lm.tableNumber ?? '—'} · ${lm.status ?? 'scheduled'}`,
    );
    if (!APPLY) continue;

    // Hakam kodi yangidan beriladi — legacy kodlar xom holda saqlangan edi
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');

    await prisma.match.create({
      data: {
        tournamentId,
        stage: STAGE_MAP[lm.stage ?? 'round1'] ?? MatchStage.ROUND_1,
        tableNumber: lm.tableNumber ?? undefined,
        scheduledAt: lm.scheduledTime ? new Date(lm.scheduledTime) : undefined,
        bestOf: lm.bestOf ?? 5,
        status: STATUS_MAP[lm.status ?? 'scheduled'] ?? MatchStatus.SCHEDULED,
        player1Id,
        player2Id,
        player1SetsWon: lm.player1SetsWon ?? 0,
        player2SetsWon: lm.player2SetsWon ?? 0,
        currentSetP1: lm.currentSet?.p1 ?? 0,
        currentSetP2: lm.currentSet?.p2 ?? 0,
        winnerId: lm.winnerId ? playerIdMap.get(lm.winnerId) : undefined,
        refereeCodeHash: createHash('sha256').update(code).digest('hex'),
        sets: {
          create: (lm.sets ?? []).map((s, i) => ({
            setNumber: i + 1,
            p1Points: s.p1,
            p2Points: s.p2,
          })),
        },
      },
    });
  }

  // ==================== YANGILIKLAR ====================
  for (const ln of db.news ?? []) {
    const slug = ln.slug ?? slugify(ln.title);
    const existing = await prisma.newsTranslation.findUnique({
      where: { locale_slug: { locale: 'uz', slug } },
    });
    if (existing) {
      plan.push(`= yangilik mavjud: ${ln.title}`);
      continue;
    }

    plan.push(`+ yangilik: ${ln.title}`);
    if (!APPLY) continue;

    await prisma.newsArticle.create({
      data: {
        status: ln.status === 'published' ? 'PUBLISHED' : 'DRAFT',
        category: ln.category,
        publishedAt: ln.publishedAt ? new Date(ln.publishedAt) : new Date(),
        translations: {
          create: [
            {
              locale: 'uz',
              title: ln.title,
              slug,
              body: ln.body,
              excerpt: ln.body.slice(0, 160),
            },
          ],
        },
      },
    });
  }

  log('\n' + plan.join('\n'));
  const added = plan.filter((p) => p.startsWith('+')).length;
  const skipped = plan.filter((p) => p.startsWith('=')).length;
  const warnings = plan.filter((p) => p.startsWith('!')).length;
  log(
    `\n${APPLY ? 'Import yakunlandi' : 'Reja'}: +${added} yangi, ${skipped} mavjud, ${warnings} ogohlantirish`,
  );
  if (!APPLY) log('Haqiqiy import uchun: pnpm import:legacy -- --apply');
  log(
    '\nEslatma: foydalanuvchilar ko‘chirilmadi (bcrypt→argon2id) — panelda ' +
      'qayta oching. Hakam kodlari yangidan generatsiya qilindi.',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
