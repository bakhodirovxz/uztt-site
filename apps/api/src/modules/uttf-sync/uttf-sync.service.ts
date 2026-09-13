import { Injectable, Logger } from '@nestjs/common';
import { Gender, TournamentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UttfClient, parseUttfDate, type Locale } from './uttf-client';

/**
 * uttf.uz'dan ma'lumot sinxronizatsiyasi.
 *
 * Muzokara qilinmaydigan xossalar (buzilmasin):
 *  1. `dryRun` — to'liq farqni hisoblaydi va HECH NARSA yozmaydi.
 *     "Bu ishga tushish 142 qator qo'shadi" ni oldin o'qish kerak.
 *  2. Avtomat o'chirgich — manba bo'sh yoki xato javob qaytarsa, sodda
 *     upsert buni "hammasini o'chir" deb o'qimasin.
 *  3. HECH QACHON hard-delete qilmaydi.
 *  4. Har javob tekshiriladi va baland ovozda yiqiladi.
 */

interface UttfTournament {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  regionName: string | null;
  districtName: string | null;
  minAge: number | null;
  maxAge: number | null;
  genderCode: number | null;
  photoId: string | null;
  ageCategories?: Array<{ id?: number; name?: string }> | null;
  arenaCoordinate?: Array<{ arenaAddress?: string }> | null;
}

interface UttfTournamentDetail {
  id: number;
  nameUz: string | null;
  nameRu: string | null;
  nameEng: string | null;
  name: string | null;
}

export interface SyncResult {
  scope: string;
  dryRun: boolean;
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  translations: number;
  warnings: string[];
  sample: Array<{ action: string; id: string; name: string }>;
}

/**
 * uttf.uz yosh toifasi nomini bizdagi kodga moslaydi.
 * DIQQAT: uttf'da U15 ning maxAge = 17, U17 niki = 18 — ularning
 * raqamlari ishonchsiz, shuning uchun NOM bo'yicha moslaymiz.
 */
const AGE_BY_NAME: Record<string, string> = {
  U11: 'U11',
  U13: 'U13',
  U15: 'U15',
  U17: 'U17',
  U19: 'U19',
  Kattalar: 'SENIOR',
};

/** uttf genderCode: 1 = erkak, 2 = ayol, 3 = ikkalasi */
function mapGender(code: number | null | undefined): Gender | null {
  if (code === 1) return 'MALE';
  if (code === 2) return 'FEMALE';
  return null;
}

/**
 * Daraja: uttf'da bizdagiga to'g'ridan-to'g'ri mos maydon yo'q, shuning
 * uchun oldingi import kabi NOM bo'yicha ajratamiz — chempionat/kubok
 * respublika darajasi, qolgani ochiq turnir.
 */
function levelCodeFor(name: string): 'NATIONAL' | 'OPEN' {
  const n = name.toLowerCase();
  const national =
    /chempionat|чемпионат|championship|kubo[gk]|кубок|cup|birinchilik/.test(n);
  return national ? 'NATIONAL' : 'OPEN';
}

function slugify(name: string, id: number): string {
  const base = name
    .toLowerCase()
    .replace(/[‘’'`]/g, '')
    .replace(/[^a-z0-9Ѐ-ӿ]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
  return `${base || 'musobaqa'}-${id}`;
}

function statusFor(start: Date, end: Date): TournamentStatus {
  const now = Date.now();
  if (end.getTime() < now) return 'FINISHED';
  if (start.getTime() <= now) return 'LIVE';
  return 'UPCOMING';
}

@Injectable()
export class UttfSyncService {
  private readonly log = new Logger(UttfSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Musobaqalarni sinxronlaydi.
   *
   * Identifikatsiya kaliti — `Tournament.id = "uttf-trn-<uttfId>"`.
   * Bu konvensiya oldingi import bilan bir xil, shuning uchun mavjud
   * 50 ta yozuv dublikat bo'lmaydi, yangilanadi.
   */
  async syncTournaments({ dryRun = true, limit }: { dryRun?: boolean; limit?: number } = {}) {
    const result: SyncResult = {
      scope: 'tournaments',
      dryRun,
      fetched: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      translations: 0,
      warnings: [],
      sample: [],
    };

    const client = new UttfClient('uz');
    const rows = await client.getAll<UttfTournament>('/tournaments/index', {}, { size: 100 });
    result.fetched = rows.length;

    // ---- Avtomat o'chirgich ----
    // Manba bo'sh yoki g'alati qaytarsa, hech narsa qilmaymiz.
    if (rows.length === 0) {
      result.warnings.push('Manba 0 ta musobaqa qaytardi — to\'xtatildi');
      return result;
    }
    const existing = await this.prisma.tournament.count({
      where: { id: { startsWith: 'uttf-trn-' } },
    });
    if (existing > 0 && rows.length < existing * 0.5) {
      result.warnings.push(
        `Manbada ${rows.length} ta, bizda ${existing} ta — yarmidan kam keldi, to'xtatildi`,
      );
      return result;
    }

    const [levels, ageCats] = await Promise.all([
      this.prisma.tournamentLevel.findMany({ select: { id: true, code: true } }),
      this.prisma.ageCategory.findMany({ select: { id: true, code: true } }),
    ]);
    const levelId = (code: string) => levels.find((l) => l.code === code)?.id;
    const ageId = (code: string | null) =>
      code ? (ageCats.find((a) => a.code === code)?.id ?? null) : null;

    const work = typeof limit === 'number' ? rows.slice(0, limit) : rows;

    for (const t of work) {
      const id = `uttf-trn-${t.id}`;
      const start = parseUttfDate(t.startDate);
      const end = parseUttfDate(t.endDate) ?? start;
      if (!start || !end) {
        result.skipped++;
        result.warnings.push(`#${t.id} "${t.name}" — sana o'qilmadi`);
        continue;
      }

      // Yosh toifasi faqat BITTA bo'lsa biriktiramiz; aralash bo'lsa
      // bo'sh qoldiramiz (oldingi import ham shunday qilgan).
      const cats = (t.ageCategories ?? []).map((c) => c?.name).filter(Boolean) as string[];
      const ageCode = cats.length === 1 ? (AGE_BY_NAME[cats[0]] ?? null) : null;

      const lvl = levelId(levelCodeFor(t.name));
      if (!lvl) {
        result.skipped++;
        result.warnings.push(`#${t.id} — daraja topilmadi`);
        continue;
      }

      const data = {
        slug: slugify(t.name, t.id),
        name: t.name,
        levelId: lvl,
        city: t.regionName ?? null,
        venue: t.arenaCoordinate?.[0]?.arenaAddress ?? t.districtName ?? null,
        gender: mapGender(t.genderCode),
        ageCategoryId: ageId(ageCode),
        startDate: start,
        endDate: end,
        status: statusFor(start, end),
        bannerImageUrl: t.photoId ? `/uttf-import/tournaments/${t.photoId}.jpg` : null,
      };

      const prev = await this.prisma.tournament.findUnique({
        where: { id },
        select: { id: true, name: true },
      });

      if (!dryRun) {
        await this.prisma.tournament.upsert({
          where: { id },
          create: { id, ...data },
          // Slug o'zgarmasin: tashqi havolalar buzilmasligi uchun
          update: { ...data, slug: prev ? undefined : data.slug },
        });
      }

      if (prev) result.updated++;
      else result.created++;
      if (result.sample.length < 8) {
        result.sample.push({ action: prev ? 'update' : 'create', id, name: t.name });
      }
    }

    this.log.log(
      `musobaqalar: ${result.fetched} olindi, +${result.created} / ~${result.updated}` +
        (dryRun ? ' (DRY RUN — yozilmadi)' : ''),
    );
    return result;
  }

  /**
   * Musobaqa nomlarini uch tilda to'ldiradi.
   * `tournaments/detail?id=` nameUz / nameRu / nameEng beradi — ilgari
   * faqat bitta til saqlanardi va sayt uch tilli bo'lsa ham musobaqa
   * nomi hamma joyda bir xil chiqardi.
   */
  async syncTournamentNames({ dryRun = true, limit }: { dryRun?: boolean; limit?: number } = {}) {
    const result: SyncResult = {
      scope: 'tournament-names',
      dryRun,
      fetched: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      translations: 0,
      warnings: [],
      sample: [],
    };

    const client = new UttfClient('uz');
    const ours = await this.prisma.tournament.findMany({
      where: { id: { startsWith: 'uttf-trn-' } },
      select: { id: true, name: true },
      orderBy: { startDate: 'desc' },
      ...(typeof limit === 'number' ? { take: limit } : {}),
    });
    result.fetched = ours.length;

    for (const t of ours) {
      const uttfId = Number(t.id.replace('uttf-trn-', ''));
      if (!Number.isFinite(uttfId)) {
        result.skipped++;
        continue;
      }
      let detail: UttfTournamentDetail | null = null;
      try {
        const body = await client.get<UttfTournamentDetail>('/tournaments/detail', {
          id: uttfId,
        });
        detail = body.data;
      } catch (e) {
        result.skipped++;
        result.warnings.push(`#${uttfId}: ${(e as Error).message}`);
        continue;
      }

      /*
       * DIQQAT: uttf.uz dagi `nameUz` KIRILL alifbosida keladi
       * ("Лос-Анжелес-2028 Олимпия ўйинлари"), bizning sayt esa lotin
       * o'zbekchada. Lotincha nom `tournaments/index` ning `name`
       * maydonidan keladi va u allaqachon `Tournament.name` da turibdi.
       * Shuning uchun uz uchun o'shani olamiz, kirillchani tashlaymiz.
       */
      const byLocale: Array<[Locale, string | null]> = [
        ['uz', t.name],
        ['ru', detail?.nameRu ?? null],
        ['en', detail?.nameEng ?? null],
      ];

      for (const [locale, name] of byLocale) {
        if (!name || !name.trim()) continue;
        if (!dryRun) {
          await this.prisma.tournamentTranslation.upsert({
            where: { tournamentId_locale: { tournamentId: t.id, locale } },
            create: { tournamentId: t.id, locale, name: name.trim() },
            update: { name: name.trim() },
          });
        }
        result.translations++;
      }
      if (result.sample.length < 8 && detail) {
        result.sample.push({
          action: 'translate',
          id: t.id,
          name: `${t.name} | ${detail.nameRu ?? '-'} | ${detail.nameEng ?? '-'}`,
        });
      }
    }

    this.log.log(
      `musobaqa nomlari: ${result.translations} ta tarjima` +
        (dryRun ? ' (DRY RUN — yozilmadi)' : ''),
    );
    return result;
  }
}
