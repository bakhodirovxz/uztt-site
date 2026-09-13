import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';

interface RankingRow {
  rank: number;
  movement: number | null;
  previousRank: number | null;
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  region: string;
  club: string | null;
  rankingPoints: number;
  ageCategory: { code: string; name: string } | null;
}

interface PartnerPlayer {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  region: string;
  club: string | null;
}

interface PartnershipRow {
  rank: number;
  id: string;
  points: number;
  player1: PartnerPlayer;
  player2: PartnerPlayer | null;
  ageCategory: { code: string; name: string } | null;
}

interface TeamRow {
  rank: number;
  id: string;
  name: string;
  regionName: string | null;
  districtName: string | null;
  gender: 'MALE' | 'FEMALE' | null;
  points: number;
  ageCategory: { code: string; name: string } | null;
}

interface PagedResult<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface SnapshotRow {
  id: string;
  label: string;
  takenAt: string;
  entryCount: number;
}

interface AgeCategory {
  id: string;
  code: string;
  name: string;
}

type RankingType = 'singles' | 'doubles' | 'mixed' | 'team';

export const dynamic = 'force-dynamic';

/** ▲ ko'tarilish / ▼ tushish / — o'zgarishsiz / NEW yangi */
function Movement({ value, newLabel }: { value: number | null; newLabel: string }) {
  if (value === null) {
    return (
      <span className="rounded bg-court-800 px-1.5 py-0.5 text-[11px] font-bold uppercase text-accent-500">
        {newLabel}
      </span>
    );
  }
  if (value === 0) return <span className="text-muted">—</span>;
  const up = value > 0;
  return (
    <span className={`font-bold tabular-nums ${up ? 'text-win' : 'text-live'}`}>
      {up ? '▲' : '▼'} {Math.abs(value)}
    </span>
  );
}

function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={`grid size-7 place-items-center rounded-full font-heading text-xs font-extrabold ${
        rank === 1
          ? 'bg-gold-500 text-navy-900'
          : rank <= 3
            ? 'bg-navy-800 text-white'
            : 'text-muted'
      }`}
    >
      {rank}
    </span>
  );
}

function PlayerLink({ player }: { player: PartnerPlayer }) {
  return (
    <Link
      href={{ pathname: '/players/[slug]', params: { slug: player.slug } }}
      className="inline-flex min-h-8 items-center font-semibold hover:text-navy-700"
    >
      {player.firstName} {player.lastName}
    </Link>
  );
}

export default async function RankingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    type?: string;
    gender?: string;
    category?: string;
    snapshot?: string;
    page?: string;
  }>;
}) {
  const { locale } = await params;
  const {
    type: rawType,
    gender = 'MALE',
    category,
    snapshot,
    page: rawPage,
  } = await searchParams;
  setRequestLocale(locale);
  const page = Math.max(1, Number.parseInt(rawPage ?? '1', 10) || 1);
  const tr = await getTranslations('rankingsPage');

  const type: RankingType =
    rawType === 'doubles' || rawType === 'mixed' || rawType === 'team'
      ? rawType
      : 'singles';
  const safeGender = gender === 'FEMALE' ? 'FEMALE' : 'MALE';

  const categories = await api
    .get<AgeCategory[]>('/draws/age-categories')
    .catch(() => [] as AgeCategory[]);

  /** Filtr havolasi — mavjud tanlovlarni saqlab, bittasini almashtiradi */
  const hrefWith = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { type, gender: safeGender, category, snapshot, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    return `?${next}`;
  };

  const chip = (active: boolean) =>
    `inline-flex min-h-9 items-center rounded border px-4 text-sm font-semibold transition-colors ${
      active
        ? 'border-navy-700 bg-navy-700 text-white'
        : 'border-border-strong bg-white text-ink hover:border-navy-600 hover:text-navy-700'
    }`;

  const TYPE_TABS: Array<[RankingType, string]> = [
    ['singles', tr('typeSingles')],
    ['doubles', tr('typeDoubles')],
    ['mixed', tr('typeMixed')],
    ['team', tr('typeTeam')],
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="font-heading text-3xl font-extrabold uppercase tracking-tight">
        {tr('title')}
      </h1>

      {/* Reyting turi: Yakkalik / Juftlik / Aralash juftlik / Jamoaviy */}
      <div className="mt-6 flex flex-wrap gap-2 border-b border-border pb-4">
        {TYPE_TABS.map(([key, label]) => (
          <a
            key={key}
            href={hrefWith({ type: key === 'singles' ? undefined : key })}
            className={chip(type === key)}
          >
            {label}
          </a>
        ))}
      </div>

      {type === 'singles' && (
        <SinglesTable
          locale={locale}
          gender={safeGender}
          category={category}
          snapshot={snapshot}
          page={page}
          categories={categories}
          hrefWith={hrefWith}
          chip={chip}
          tr={tr}
        />
      )}

      {(type === 'doubles' || type === 'mixed') && (
        <PartnershipTable
          type={type}
          gender={safeGender}
          category={category}
          page={page}
          categories={categories}
          hrefWith={hrefWith}
          chip={chip}
          tr={tr}
        />
      )}

      {type === 'team' && (
        <TeamTable
          gender={gender}
          category={category}
          page={page}
          categories={categories}
          hrefWith={hrefWith}
          chip={chip}
          tr={tr}
        />
      )}
    </div>
  );
}

type Tr = (key: string) => string;
type HrefWith = (patch: Record<string, string | undefined>) => string;
type Chip = (active: boolean) => string;

function AgeCategoryFilter({
  categories,
  category,
  hrefWith,
  chip,
  tr,
}: {
  categories: AgeCategory[];
  category: string | undefined;
  hrefWith: HrefWith;
  chip: Chip;
  tr: Tr;
}) {
  if (categories.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <a href={hrefWith({ category: undefined })} className={chip(!category)}>
        {tr('allCategories')}
      </a>
      {categories.map((c) => (
        <a
          key={c.id}
          href={hrefWith({ category: c.code })}
          className={chip(category === c.code)}
        >
          {c.name}
        </a>
      ))}
    </div>
  );
}

/**
 * Sahifalash chizig'i: 1 2 3 ... 27 28 29 ... 54 55 — joriy sahifa atrofi
 * va boshi/oxiri har doim ko'rinadi, orasi "…" bilan qisqartiriladi.
 */
function Pagination({
  page,
  totalPages,
  hrefWith,
}: {
  page: number;
  totalPages: number;
  hrefWith: HrefWith;
}) {
  if (totalPages <= 1) return null;

  const pages = new Set<number>([1, totalPages]);
  for (let p = page - 1; p <= page + 1; p++) {
    if (p >= 1 && p <= totalPages) pages.add(p);
  }
  const sorted = Array.from(pages).sort((a, b) => a - b);

  const items: Array<number | 'ellipsis'> = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) items.push('ellipsis');
    items.push(p);
    prev = p;
  }

  const pageChip = (active: boolean) =>
    `inline-flex min-h-9 min-w-9 items-center justify-center rounded border px-2.5 text-sm font-semibold transition-colors ${
      active
        ? 'border-navy-700 bg-navy-700 text-white'
        : 'border-border-strong bg-white text-ink hover:border-navy-600 hover:text-navy-700'
    }`;

  return (
    <nav className="mt-6 flex flex-wrap items-center gap-1.5" aria-label="Pagination">
      <a
        href={hrefWith({ page: String(Math.max(1, page - 1)) })}
        aria-disabled={page === 1}
        className={`${pageChip(false)} ${page === 1 ? 'pointer-events-none opacity-40' : ''}`}
      >
        ‹
      </a>
      {items.map((it, i) =>
        it === 'ellipsis' ? (
          <span key={`e${i}`} className="px-1.5 text-muted">
            …
          </span>
        ) : (
          <a
            key={it}
            href={hrefWith({ page: String(it) })}
            className={pageChip(it === page)}
          >
            {it}
          </a>
        ),
      )}
      <a
        href={hrefWith({ page: String(Math.min(totalPages, page + 1)) })}
        aria-disabled={page === totalPages}
        className={`${pageChip(false)} ${page === totalPages ? 'pointer-events-none opacity-40' : ''}`}
      >
        ›
      </a>
    </nav>
  );
}

async function SinglesTable({
  locale,
  gender,
  category,
  snapshot,
  page,
  categories,
  hrefWith,
  chip,
  tr,
}: {
  locale: string;
  gender: string;
  category: string | undefined;
  snapshot: string | undefined;
  page: number;
  categories: AgeCategory[];
  hrefWith: HrefWith;
  chip: Chip;
  tr: Tr;
}) {
  const query = new URLSearchParams({ gender, page: String(page) });
  if (category) query.set('ageCategory', category);
  if (snapshot) query.set('snapshot', snapshot);

  const EMPTY_PAGE: PagedResult<RankingRow> = {
    rows: [],
    total: 0,
    page: 1,
    pageSize: 100,
    totalPages: 1,
  };

  const [data, snapshots] = await Promise.all([
    api
      .get<PagedResult<RankingRow>>(`/rankings?${query}`)
      .catch(() => EMPTY_PAGE),
    api.get<SnapshotRow[]>('/rankings/snapshots').catch(() => [] as SnapshotRow[]),
  ]);
  const rows = data.rows;

  const activeSnapshot = snapshots.find((s) => s.label === snapshot);

  return (
    <>
      {activeSnapshot && (
        <p className="mt-4 text-sm text-muted">
          {tr('snapshot')}: {activeSnapshot.label} ({tr('takenAt')}{' '}
          {new Date(activeSnapshot.takenAt).toLocaleDateString(locale)})
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {(
          [
            ['MALE', tr('men')],
            ['FEMALE', tr('women')],
          ] as const
        ).map(([key, label]) => (
          <a key={key} href={hrefWith({ gender: key })} className={chip(gender === key)}>
            {label}
          </a>
        ))}
      </div>

      <AgeCategoryFilter categories={categories} category={category} hrefWith={hrefWith} chip={chip} tr={tr} />

      {snapshots.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">
            {tr('snapshot')}
          </span>
          <a href={hrefWith({ snapshot: undefined })} className={chip(!snapshot)}>
            {tr('current')}
          </a>
          {snapshots.slice(0, 8).map((s) => (
            <a
              key={s.id}
              href={hrefWith({ snapshot: s.label })}
              className={chip(snapshot === s.label)}
            >
              {s.label}
            </a>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="mt-8 text-muted">{tr('empty')}</p>
      ) : (
        <>
          <p className="mt-6 text-sm text-muted">
            {tr('total')}: {data.total.toLocaleString(locale)}
          </p>
          <div className="mt-2 overflow-x-auto rounded-card bg-surface-card shadow-card">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-alt text-ink">
                <tr>
                  <th className="px-4 py-3 font-heading text-xs font-bold uppercase tracking-wider">#</th>
                  <th className="px-3 py-3 font-heading text-xs font-bold uppercase tracking-wider">
                    {tr('movement')}
                  </th>
                  <th className="px-4 py-3 font-heading text-xs font-bold uppercase tracking-wider">
                    {tr('player')}
                  </th>
                  <th className="hidden px-4 py-3 font-heading text-xs font-bold uppercase tracking-wider sm:table-cell">
                    {tr('region')}
                  </th>
                  <th className="px-4 py-3 text-right font-heading text-xs font-bold uppercase tracking-wider">
                    {tr('points')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border hover:bg-surface">
                    <td className="px-4 py-3">
                      <RankBadge rank={r.rank} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs">
                      <Movement value={r.movement} newLabel={tr('new')} />
                    </td>
                    <td className="px-4 py-3">
                      <PlayerLink player={r} />
                      {r.club && (
                        <span className="ml-2 hidden text-xs text-muted md:inline">{r.club}</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-muted sm:table-cell">{r.region}</td>
                    <td className="px-4 py-3 text-right font-heading font-extrabold tabular-nums text-court-500">
                      {r.rankingPoints}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={data.page} totalPages={data.totalPages} hrefWith={hrefWith} />
        </>
      )}
    </>
  );
}

async function PartnershipTable({
  type,
  gender,
  category,
  page,
  categories,
  hrefWith,
  chip,
  tr,
}: {
  type: 'doubles' | 'mixed';
  gender: string;
  category: string | undefined;
  page: number;
  categories: AgeCategory[];
  hrefWith: HrefWith;
  chip: Chip;
  tr: Tr;
}) {
  const query = new URLSearchParams({ page: String(page) });
  if (type === 'doubles') query.set('gender', gender);
  if (category) query.set('ageCategory', category);

  const EMPTY_PAGE: PagedResult<PartnershipRow> = {
    rows: [],
    total: 0,
    page: 1,
    pageSize: 100,
    totalPages: 1,
  };

  const data = await api
    .get<PagedResult<PartnershipRow>>(`/rankings/${type}?${query}`)
    .catch(() => EMPTY_PAGE);
  const rows = data.rows;

  return (
    <>
      {type === 'doubles' && (
        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              ['MALE', tr('men')],
              ['FEMALE', tr('women')],
            ] as const
          ).map(([key, label]) => (
            <a key={key} href={hrefWith({ gender: key })} className={chip(gender === key)}>
              {label}
            </a>
          ))}
        </div>
      )}

      <AgeCategoryFilter categories={categories} category={category} hrefWith={hrefWith} chip={chip} tr={tr} />

      {rows.length === 0 ? (
        <p className="mt-8 text-muted">{tr('empty')}</p>
      ) : (
        <>
          <p className="mt-6 text-sm text-muted">
            {tr('total')}: {data.total.toLocaleString()}
          </p>
          <div className="mt-2 overflow-x-auto rounded-card bg-surface-card shadow-card">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-alt text-ink">
                <tr>
                  <th className="px-4 py-3 font-heading text-xs font-bold uppercase tracking-wider">#</th>
                  <th className="px-4 py-3 font-heading text-xs font-bold uppercase tracking-wider">
                    {tr('pair')}
                  </th>
                  <th className="px-4 py-3 text-right font-heading text-xs font-bold uppercase tracking-wider">
                    {tr('points')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border hover:bg-surface">
                    <td className="px-4 py-3">
                      <RankBadge rank={r.rank} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <PlayerLink player={r.player1} />
                        <span className="text-muted">/</span>
                        {r.player2 ? (
                          <PlayerLink player={r.player2} />
                        ) : (
                          <span className="text-muted">{tr('unknownPartner')}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-heading font-extrabold tabular-nums text-court-500">
                      {r.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={data.page} totalPages={data.totalPages} hrefWith={hrefWith} />
        </>
      )}
    </>
  );
}

async function TeamTable({
  gender,
  category,
  page,
  categories,
  hrefWith,
  chip,
  tr,
}: {
  gender: string | undefined;
  category: string | undefined;
  page: number;
  categories: AgeCategory[];
  hrefWith: HrefWith;
  chip: Chip;
  tr: Tr;
}) {
  const query = new URLSearchParams({ page: String(page) });
  if (gender) query.set('gender', gender);
  if (category) query.set('ageCategory', category);

  const EMPTY_PAGE: PagedResult<TeamRow> = {
    rows: [],
    total: 0,
    page: 1,
    pageSize: 100,
    totalPages: 1,
  };

  const data = await api
    .get<PagedResult<TeamRow>>(`/rankings/teams?${query}`)
    .catch(() => EMPTY_PAGE);
  const rows = data.rows;

  return (
    <>
      <div className="mt-4 flex flex-wrap gap-2">
        {(
          [
            [undefined, tr('allCategories')],
            ['MALE', tr('men')],
            ['FEMALE', tr('women')],
            ['MIXED', tr('mixedTeams')],
          ] as const
        ).map(([key, label]) => (
          <a
            key={label}
            href={hrefWith({ gender: key })}
            className={chip(gender === key || (!gender && key === undefined))}
          >
            {label}
          </a>
        ))}
      </div>

      <AgeCategoryFilter categories={categories} category={category} hrefWith={hrefWith} chip={chip} tr={tr} />

      {rows.length === 0 ? (
        <p className="mt-8 text-muted">{tr('empty')}</p>
      ) : (
        <>
          <p className="mt-6 text-sm text-muted">
            {tr('total')}: {data.total.toLocaleString()}
          </p>
          <div className="mt-2 overflow-x-auto rounded-card bg-surface-card shadow-card">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-alt text-ink">
                <tr>
                  <th className="px-4 py-3 font-heading text-xs font-bold uppercase tracking-wider">#</th>
                  <th className="px-4 py-3 font-heading text-xs font-bold uppercase tracking-wider">
                    {tr('team')}
                  </th>
                  <th className="hidden px-4 py-3 font-heading text-xs font-bold uppercase tracking-wider sm:table-cell">
                    {tr('region')}
                  </th>
                  <th className="px-4 py-3 text-right font-heading text-xs font-bold uppercase tracking-wider">
                    {tr('points')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border hover:bg-surface">
                    <td className="px-4 py-3">
                      <RankBadge rank={r.rank} />
                    </td>
                    <td className="px-4 py-3 font-semibold">{r.name}</td>
                    <td className="hidden px-4 py-3 text-muted sm:table-cell">
                      {r.regionName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-heading font-extrabold tabular-nums text-court-500">
                      {r.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={data.page} totalPages={data.totalPages} hrefWith={hrefWith} />
        </>
      )}
    </>
  );
}
