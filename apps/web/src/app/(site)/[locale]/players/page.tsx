import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { PlayerPopupLink } from '@/components/player/player-popup';
import { api } from '@/lib/api';
import { Avatar } from '@/components/ui/avatar';
import { Container, PageTitleBar, chipClass } from '@/components/ui';

interface PlayerRow {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  gender: 'MALE' | 'FEMALE';
  region: string;
  club: string | null;
  rankingPoints: number;
  photoUrl: string | null;
  ageCategory: { code: string; name: string } | null;
}

export const dynamic = 'force-dynamic';

/** O'yinchi rasmi — bo'lmasa ismi bosh harflaridan doira */
function PlayerAvatar({ p }: { p: PlayerRow; size?: string }) {
  return <Avatar photoUrl={p.photoUrl} firstName={p.firstName} lastName={p.lastName} size={44} />;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const { page } = await searchParams;
  const n = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);
  const t = await getTranslations({ locale, namespace: 'seo' });
  const meta = pageMeta({ locale, href: '/players', title: n > 1 ? `${t('players.title')} — ${n}` : t('players.title'), description: t('players.description') });
  // Sahifalangan ro'yxat: 2+ sahifalar indekslanmaydi, lekin havolalar kuzatiladi (dublikat title/kontent xavfi yo'q)
  return n > 1 ? { ...meta, robots: { index: false, follow: true } } : meta;
}

export default async function PlayersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    gender?: string;
    q?: string;
    region?: string;
    age?: string;
    page?: string;
  }>;
}) {
  const { locale } = await params;
  const { gender, q, region, age, page } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('nav');
  const tp = await getTranslations('playersPage');

  const qs = new URLSearchParams();
  if (gender === 'MALE' || gender === 'FEMALE') qs.set('gender', gender);
  if (q) qs.set('search', q);
  if (region) qs.set('region', region);
  if (age) qs.set('ageCategory', age);
  if (page) qs.set('page', page);
  const paged = await api
    .get<{
      rows: PlayerRow[];
      total: number;
      page: number;
      totalPages: number;
    }>(`/players?${qs}`)
    .catch(() => ({ rows: [] as PlayerRow[], total: 0, page: 1, totalPages: 1 }));
  const players = paged.rows;

  // Viloyatlar alohida yengil endpointdan (ilgari butun ro'yxat ikki marta
  // tortilardi) va 5 daqiqa keshlanadi
  const regions = await api
    .get<string[]>('/players/regions', { next: { revalidate: 300 } } as RequestInit)
    .catch(() => [] as string[]);

  const ageCats = await api
    .get<Array<{ id: string; code: string; name: string }>>('/draws/age-categories', { next: { revalidate: 300 } } as RequestInit)
    .catch(() => []);

  const pageQuery = (p: number) => {
    const query: Record<string, string> = {};
    if (gender === 'MALE' || gender === 'FEMALE') query.gender = gender;
    if (q) query.q = q;
    if (region) query.region = region;
    if (age) query.age = age;
    if (p > 1) query.page = String(p);
    return query;
  };

  const tabs = [
    { key: undefined, label: tp('all') },
    { key: 'MALE', label: tp('men') },
    { key: 'FEMALE', label: tp('women') },
  ];

  /** Joriy filtrlarni saqlab, bittasini almashtiruvchi havola */
  const hrefWith = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { gender, q, region, age, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    return `?${next}`;
  };

  return (
    <>
      <PageTitleBar title={t('players')}>
        <Link
          href="/players/compare"
          className="inline-flex min-h-9 items-center rounded-card border border-white/25 px-4 text-[13px] font-semibold uppercase tracking-wide text-white transition-colors hover:border-accent-500 hover:text-accent-500"
        >
          {tp('compare')}
        </Link>
      </PageTitleBar>
      <Container className="py-8">

      {/* Filtrlar: qidiruv + jins + viloyat (hammasi URL'da — havola bo'lishib bo'ladi) */}
      <form className="mt-6 flex flex-wrap items-center gap-2" action="">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ''}
          placeholder={tp('searchPlaceholder')}
          aria-label={tp('searchPlaceholder')}
          className="min-h-10 w-full rounded-md border border-border bg-surface-card px-3.5 text-sm outline-none focus:border-accent-500 sm:w-64"
        />
        {gender && <input type="hidden" name="gender" value={gender} />}
        {age && <input type="hidden" name="age" value={age} />}
        <select
          name="region"
          defaultValue={region ?? ''}
          aria-label={tp('region')}
          className="min-h-10 rounded-md border border-border bg-surface-card px-3 text-sm"
        >
          <option value="">{tp('region')}: {tp('all')}</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="min-h-10 rounded-card bg-accent-500 px-5 text-[13px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-accent-400"
        >
          {tp('search')}
        </button>
      </form>

      {/* Yosh segmenti — kumulyativ: U-13 = 13 yosh va undan kichik hamma */}
      {ageCats.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Yosh segmenti">
          <a href={hrefWith({ age: undefined })} className={chipClass(!age)}>
            {tp('all')}
          </a>
          {ageCats.map((c) => (
            <a key={c.id} href={hrefWith({ age: c.code })} className={chipClass(age === c.code)}>
              {c.name}
            </a>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <a
            key={tab.label}
            href={hrefWith({ gender: tab.key })}
            className={chipClass(gender === tab.key || (!gender && !tab.key))}
          >
            {tab.label}
          </a>
        ))}
      </div>

      {players.length === 0 ? (
        <p className="mt-10 rounded-card border border-dashed border-border px-6 py-10 text-center text-muted">
          {tp('notFound')}
        </p>
      ) : (
        <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {players.map((p, i) => (
            <li key={p.id}>
              <PlayerPopupLink
                slug={p.slug}
                className="group flex items-center gap-4 rounded-card border border-border bg-surface-card px-4 py-3.5 transition-colors hover:border-court-500"
              >
                {/* Reyting o'rni — asosiy ma'lumot, shuning uchun birinchi */}
                <span className="w-7 shrink-0 text-center font-heading text-lg font-extrabold tabular-nums text-muted">
                  {i + 1}
                </span>
                <PlayerAvatar p={p} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="block truncate font-heading font-bold group-hover:text-accent-500">
                      {p.lastName} {p.firstName}
                    </span>
                    {p.ageCategory && (
                      <span className="shrink-0 rounded bg-surface-alt px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted">
                        {p.ageCategory.code}
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-sm text-muted">
                    {p.region}
                    {p.club ? ` · ${p.club}` : ''}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-heading text-lg font-extrabold tabular-nums">
                    {p.rankingPoints}
                  </span>
                  <span className="block text-[11px] uppercase tracking-wider text-muted">
                    {tp('points')}
                  </span>
                </span>
              </PlayerPopupLink>
            </li>
          ))}
        </ol>
      )}

      {/* Sahifalash — ro'yxat endi 100 talik sahifalarda keladi.
          To'liq ellipsli Pagination komponenti reyting sahifasidan
          ajratilgach shu yerga ham qo'yiladi. */}
      {paged.totalPages > 1 && (
        <nav
          className="mt-8 flex items-center justify-center gap-2"
          aria-label={tp('rank')}
        >
          <Link
            href={{ pathname: '/players', query: pageQuery(paged.page - 1) }}
            aria-disabled={paged.page <= 1}
            className={`inline-flex min-h-9 items-center rounded border border-border-strong px-3 text-sm ${
              paged.page <= 1
                ? 'pointer-events-none opacity-40'
                : 'hover:border-accent-500'
            }`}
          >
            ‹
          </Link>
          <span className="text-sm text-muted tabular-nums">
            {paged.page} / {paged.totalPages}
            <span className="ml-2 opacity-70">({paged.total})</span>
          </span>
          <Link
            href={{ pathname: '/players', query: pageQuery(paged.page + 1) }}
            aria-disabled={paged.page >= paged.totalPages}
            className={`inline-flex min-h-9 items-center rounded border border-border-strong px-3 text-sm ${
              paged.page >= paged.totalPages
                ? 'pointer-events-none opacity-40'
                : 'hover:border-accent-500'
            }`}
          >
            ›
          </Link>
        </nav>
      )}
      </Container>
    </>
  );
}
