import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import {
  Container,
  PageTitleBar,
  GradientCard,
  TabBar,
  Chip,
  ChipGroup,
  chipClass,
  Movement,
  RankNumber,
  Pagination,
  DataTable,
  Th,
  Tr,
  Td,
  PlayerCell,
} from '@/components/ui';

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
  photoUrl: string | null;
  ageCategory: { code: string; name: string } | null;
}

interface PartnerPlayer {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  region: string;
  club: string | null;
  photoUrl?: string | null;
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

function PlayerLink({ player }: { player: PartnerPlayer }) {
  return (
    <Link
      href={{ pathname: '/players/[slug]', params: { slug: player.slug } }}
      className="inline-flex min-h-8 items-center font-medium hover:text-accent-500"
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

  const chip = chipClass;

  const TYPE_TABS: Array<[RankingType, string]> = [
    ['singles', tr('typeSingles')],
    ['doubles', tr('typeDoubles')],
    ['mixed', tr('typeMixed')],
    ['team', tr('typeTeam')],
  ];

  return (
    <>
      <PageTitleBar title={tr('title')} />
      <Container className="py-8">
        {/* Reyting turi — WTT uslubidagi tablar (to'q sariq chiziq) */}
        <TabBar
          items={TYPE_TABS.map(([key, label]) => ({
            key,
            label,
            href: hrefWith({ type: key === 'singles' ? undefined : key }),
            active: type === key,
          }))}
        />

        <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="min-w-0">

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

          {/* WTT reyting sahifasidagi "TOP RANKED PLAYERS" bloklari */}
          <aside className="space-y-5">
            <TopRanked gender="MALE" title={tr('men')} tr={tr} />
            <TopRanked gender="FEMALE" title={tr('women')} tr={tr} />
          </aside>
        </div>
      </Container>
    </>
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
 * Yon paneldagi "eng yuqori o'rindagilar" kartasi — WTT'dagi
 * "TOP RANKED PLAYERS" bloki. Gradient sarlavha rangi jinsga qarab
 * (o'lchangan: erkaklar ko'k-firuza, ayollar magenta-siyoh).
 */
async function TopRanked({
  gender,
  title,
  tr,
}: {
  gender: 'MALE' | 'FEMALE';
  title: string;
  tr: Tr;
}) {
  const data = await api
    .get<PagedResult<RankingRow>>(`/rankings?gender=${gender}&pageSize=5`)
    .catch(() => null);
  const rows = data?.rows ?? [];
  if (rows.length === 0) return null;

  return (
    <GradientCard
      tone={gender === 'MALE' ? 'men' : 'women'}
      title={title}
      subtitle={tr('topRanked')}
    >
      <ol>
        {rows.map((r) => (
          <li key={r.id} className="border-b border-border last:border-0">
            <Link
              href={{ pathname: '/players/[slug]', params: { slug: r.slug } }}
              className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[rgba(232,105,34,0.18)]"
            >
              <span className="w-4 shrink-0 text-center font-heading text-sm font-bold tabular-nums text-muted">
                {r.rank}
              </span>
              {r.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.photoUrl}
                  alt=""
                  width={28}
                  height={28}
                  loading="lazy"
                  className="size-7 shrink-0 rounded-full bg-surface-alt object-cover"
                />
              ) : (
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-navy-800 text-[10px] font-bold text-white">
                  {(r.lastName?.[0] ?? '') + (r.firstName?.[0] ?? '')}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-[13px]">
                <span className="uppercase">{r.lastName}</span> {r.firstName}
              </span>
              <span className="shrink-0 font-heading text-sm font-bold tabular-nums">
                {r.rankingPoints}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </GradientCard>
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
          <div className="mt-2 rounded-card bg-surface-card shadow-card">
            <DataTable
              head={
                <>
                  <Th className="w-24">#</Th>
                  <Th>{tr('player')}</Th>
                  <Th className="hidden sm:table-cell">{tr('region')}</Th>
                  <Th align="right">{tr('points')}</Th>
                </>
              }
            >
              {rows.map((r) => (
                <Tr key={r.id}>
                  <Td className="w-24 whitespace-nowrap">
                    <span className="flex items-center gap-2">
                      <RankNumber rank={r.rank} />
                      <Movement
                        movement={r.movement}
                        isNew={r.movement === null}
                        newLabel={tr('new')}
                      />
                    </span>
                  </Td>
                  <Td>
                    <Link
                      href={{ pathname: '/players/[slug]', params: { slug: r.slug } }}
                      className="block hover:text-accent-500"
                    >
                      <PlayerCell
                        photoUrl={r.photoUrl}
                        firstName={r.firstName}
                        lastName={r.lastName}
                        sub={r.club ?? undefined}
                      />
                    </Link>
                  </Td>
                  <Td className="hidden text-[13px] text-muted sm:table-cell">{r.region}</Td>
                  <Td align="right" className="font-heading font-bold tabular-nums">
                    {r.rankingPoints}
                  </Td>
                </Tr>
              ))}
            </DataTable>
          </div>

          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            hrefFor={(p) => hrefWith({ page: p > 1 ? String(p) : undefined })}
          />
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
            <table className="w-full min-w-[520px] text-left">
              <thead>
                <tr className="border-b border-border-strong">
                  <th className="px-3 py-2.5 font-heading text-[11px] font-bold uppercase tracking-wider text-[#444]">#</th>
                  <th className="px-3 py-2.5 font-heading text-[11px] font-bold uppercase tracking-wider text-[#444]">
                    {tr('pair')}
                  </th>
                  <th className="px-3 py-2.5 text-right font-heading text-[11px] font-bold uppercase tracking-wider text-[#444]">
                    {tr('points')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border transition-colors hover:bg-[rgba(232,105,34,0.18)]">
                    <td className="px-4 py-3">
                      <RankNumber rank={r.rank} />
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
                    <td className="px-3 py-2.5 text-right font-heading font-bold tabular-nums">
                      {r.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            hrefFor={(p) => hrefWith({ page: p > 1 ? String(p) : undefined })}
          />
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
            <table className="w-full min-w-[520px] text-left">
              <thead>
                <tr className="border-b border-border-strong">
                  <th className="px-3 py-2.5 font-heading text-[11px] font-bold uppercase tracking-wider text-[#444]">#</th>
                  <th className="px-3 py-2.5 font-heading text-[11px] font-bold uppercase tracking-wider text-[#444]">
                    {tr('team')}
                  </th>
                  <th className="hidden px-3 py-2.5 font-heading text-[11px] font-bold uppercase tracking-wider text-[#444] sm:table-cell">
                    {tr('region')}
                  </th>
                  <th className="px-3 py-2.5 text-right font-heading text-[11px] font-bold uppercase tracking-wider text-[#444]">
                    {tr('points')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border transition-colors hover:bg-[rgba(232,105,34,0.18)]">
                    <td className="px-4 py-3">
                      <RankNumber rank={r.rank} />
                    </td>
                    <td className="px-4 py-3 font-semibold">{r.name}</td>
                    <td className="hidden px-4 py-3 text-muted sm:table-cell">
                      {r.regionName ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-heading font-bold tabular-nums">
                      {r.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            hrefFor={(p) => hrefWith({ page: p > 1 ? String(p) : undefined })}
          />
        </>
      )}
    </>
  );
}
