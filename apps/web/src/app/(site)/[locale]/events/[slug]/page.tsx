import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import { safeJsonLd } from '@/lib/json-ld';
import { MatchCard } from '@/components/match/match-card';
import { BracketView, type BracketData } from '@/components/match/bracket-view';
import type { MatchPayload } from '@/lib/socket';

type ApiMatch = Omit<
  MatchPayload,
  | 'player1Name'
  | 'player2Name'
  | 'winnerInfo'
  | 'refereeVerified'
  | 'tournamentId'
  | 'disqualificationReason'
> & {
  player1: { firstName: string; lastName: string } | null;
  player2: { firstName: string; lastName: string } | null;
};

interface TournamentDetail {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  venue: string | null;
  startDate: string;
  endDate: string;
  status: string;
  level: { code: string; name: string; coefficient: number };
  matches: ApiMatch[];
  categories: Array<{
    id: string;
    gender: 'MALE' | 'FEMALE' | null;
    eventType: 'SINGLES' | 'DOUBLES' | 'MIXED_DOUBLES' | 'TEAM';
    maxEntries: number | null;
    registrationDeadline: string | null;
    ageCategory: { code: string; name: string };
    entries: { confirmed: number; pending: number; total: number };
  }>;
}

interface LevelRegulation {
  code: string;
  name: string;
  description: string | null;
  coefficient: number;
  rules: Array<{ key: string; label: string; points: number }>;
}

interface NewsItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: string | null;
}

interface GalleryItem {
  id: string;
  title: string;
  coverUrl: string | null;
  photoCount: number;
}

interface VideoItem {
  id: string;
  youtubeId: string;
  title: string;
}

const TABS = [
  'overview',
  'bracket',
  'matches',
  'results',
  'news',
  'gallery',
] as const;
type Tab = (typeof TABS)[number];

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const t = await api
    .get<TournamentDetail>(`/tournaments/${slug}?locale=${locale}`)
    .catch(() => null);
  if (!t) return {};
  const description = `${t.level.name} · ${[t.city, t.venue].filter(Boolean).join(', ')}`;
  return {
    title: t.name,
    description,
    openGraph: { title: t.name, description, type: 'website' },
  };
}

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { locale, slug } = await params;
  const { tab: tabParam } = await searchParams;
  setRequestLocale(locale);
  const te = await getTranslations('eventsPage');
  const tb = await getTranslations('bracket');
  const tm = await getTranslations('match');
  const tg = await getTranslations('groups');
  const tn = await getTranslations('nav');

  const t = await api
    .get<TournamentDetail>(`/tournaments/${slug}?locale=${locale}`)
    .catch((e) => {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    });
  if (!t) notFound();

  const [brackets, news, galleries, videos, regulation] = await Promise.all([
    api
      .get<BracketData[]>(`/draws/tournament/${slug}`)
      .catch(() => [] as BracketData[]),
    api
      .get<NewsItem[]>(`/news?locale=${locale}&tournamentId=${t.id}`)
      .catch(() => [] as NewsItem[]),
    api
      .get<GalleryItem[]>(`/galleries?locale=${locale}&tournamentId=${t.id}`)
      .catch(() => [] as GalleryItem[]),
    api
      .get<VideoItem[]>(`/videos?locale=${locale}&tournamentId=${t.id}`)
      .catch(() => [] as VideoItem[]),
    api
      .get<LevelRegulation>(`/levels/${t.level.code}`)
      .catch(() => null),
  ]);

  const finished = t.matches.filter((m) => m.status === 'FINISHED');
  const upcoming = t.matches.filter((m) => m.status !== 'FINISHED');
  const hasMedia = galleries.length > 0 || videos.length > 0;

  // Bo'sh bo'limlar tabda ko'rinmaydi — foydalanuvchi bo'sh sahifaga tushmaydi
  const visibleTabs = TABS.filter((key) => {
    if (key === 'bracket') return brackets.length > 0;
    if (key === 'news') return news.length > 0;
    if (key === 'gallery') return hasMedia;
    if (key === 'results') return finished.length > 0;
    return true;
  });
  const tab: Tab = visibleTabs.includes(tabParam as Tab)
    ? (tabParam as Tab)
    : 'overview';

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  /** API o'yinini MatchCard kutgan payloadga o'giradi */
  const toPayload = (m: ApiMatch): MatchPayload =>
    ({
      ...m,
      tournamentId: t.id,
      player1Name: m.player1
        ? `${m.player1.firstName} ${m.player1.lastName}`
        : "Noma'lum",
      player2Name: m.player2
        ? `${m.player2.firstName} ${m.player2.lastName}`
        : "Noma'lum",
      winnerInfo: null,
      refereeVerified: false,
      disqualificationReason: null,
    }) as MatchPayload;

  const categoryLabel = (c: TournamentDetail['categories'][number]) => {
    const gender =
      c.gender === 'MALE'
        ? tg('men')
        : c.gender === 'FEMALE'
          ? tg('women')
          : tg('open');
    return `${c.ageCategory.name} · ${gender} · ${tg(`event_${c.eventType}`)}`;
  };

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: t.name,
    sport: 'Table Tennis',
    startDate: t.startDate,
    endDate: t.endDate,
    location: {
      '@type': 'Place',
      name: t.venue ?? t.city ?? 'Uzbekistan',
      address: t.city ?? 'Uzbekistan',
    },
    organizer: {
      '@type': 'SportsOrganization',
      name: "O'zbekiston Stol Tennisi Federatsiyasi",
    },
  };

  const sectionTitle = (text: string) => (
    <h2 className="font-heading text-xl font-bold uppercase tracking-wide">
      {text}
    </h2>
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      <section className="bg-navy-900 text-white">
        <div className="mx-auto max-w-site px-4 py-12">
          <p className="text-sm uppercase tracking-wider text-gold-500">
            {t.level.name} · ×{t.level.coefficient}
          </p>
          <h1 className="mt-1 font-heading text-4xl font-extrabold uppercase tracking-tight">
            {t.name}
          </h1>
          <p className="mt-2 text-white/70">
            {[t.city, t.venue].filter(Boolean).join(' · ')} — {fmt(t.startDate)}
            {' → '}
            {fmt(t.endDate)}
          </p>
        </div>

        {/* Tab navigatsiyasi — URL bilan boshqariladi (ulashish va SEO uchun) */}
        <nav
          aria-label={t.name}
          className="border-t border-navy-800 bg-navy-950/60"
        >
          <div className="mx-auto flex max-w-site gap-1 overflow-x-auto px-4">
            {visibleTabs.map((key) => (
              <Link
                key={key}
                href={{
                  pathname: '/events/[slug]',
                  params: { slug },
                  query: key === 'overview' ? {} : { tab: key },
                }}
                aria-current={tab === key ? 'page' : undefined}
                className={`shrink-0 whitespace-nowrap border-b-2 px-4 py-3.5 text-sm font-bold uppercase tracking-wide transition-colors ${
                  tab === key
                    ? 'border-accent-500 text-white'
                    : 'border-transparent text-white/60 hover:text-white'
                }`}
              >
                {te(
                  `tab${key.charAt(0).toUpperCase()}${key.slice(1)}` as
                    | 'tabOverview'
                    | 'tabBracket'
                    | 'tabMatches'
                    | 'tabResults'
                    | 'tabNews'
                    | 'tabGallery',
                )}
              </Link>
            ))}
          </div>
        </nav>
      </section>

      {/* ==================== UMUMIY ==================== */}
      {tab === 'overview' && (
        <div className="mx-auto max-w-site space-y-10 px-4 py-10">
          <section>
            {sectionTitle(te('info'))}
            <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                [te('level'), `${t.level.name} (×${t.level.coefficient})`],
                [te('dates'), `${fmt(t.startDate)} — ${fmt(t.endDate)}`],
                [te('venue'), [t.venue, t.city].filter(Boolean).join(', ') || '—'],
                [
                  te('status'),
                  t.status === 'LIVE'
                    ? te('liveNow')
                    : t.status === 'FINISHED'
                      ? te('finished')
                      : te('upcoming'),
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-card border border-border bg-surface-card p-4"
                >
                  <dt className="text-xs font-bold uppercase tracking-wider text-muted">
                    {label}
                  </dt>
                  <dd className="mt-1 font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {regulation && regulation.rules.length > 0 && (
            <section>
              {sectionTitle(te('regulation'))}
              <p className="mt-2 text-sm text-muted">
                {regulation.description ?? regulation.name} — {te('regulationHint')}
              </p>
              <div className="mt-4 overflow-x-auto rounded-card border border-border bg-surface-card">
                <table className="w-full min-w-[28rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wider text-muted">
                      <th className="px-4 py-3 font-bold">{te('regulationCase')}</th>
                      <th className="px-4 py-3 text-right font-bold">
                        {te('regulationPoints')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {regulation.rules.map((r) => (
                      <tr key={r.key} className="border-b border-border/60">
                        <td className="px-4 py-2.5">{r.label}</td>
                        <td className="px-4 py-2.5 text-right font-heading font-extrabold tabular-nums">
                          {r.points}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {t.categories.length > 0 && (
            <section>
              {sectionTitle(te('categories'))}
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {t.categories.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-card border border-border bg-surface-card p-4"
                  >
                    <p className="font-heading font-bold">{categoryLabel(c)}</p>
                    <p className="mt-1 text-sm text-muted">
                      {c.entries.confirmed}
                      {c.maxEntries ? `/${c.maxEntries}` : ''} {te('entries')}
                    </p>
                    <p className="mt-2 text-xs text-muted">
                      {te('deadline')}:{' '}
                      {c.registrationDeadline
                        ? fmt(c.registrationDeadline)
                        : te('noDeadline')}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {finished.length > 0 && (
            <section>
              {sectionTitle(te('results'))}
              <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {finished.slice(0, 3).map((m) => (
                  <MatchCard key={m.id} initial={toPayload(m)} />
                ))}
              </div>
            </section>
          )}

          {news.length > 0 && (
            <section>
              {sectionTitle(tn('news'))}
              <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {news.slice(0, 3).map((n) => (
                  <Link
                    key={n.id}
                    href={{ pathname: '/news/[slug]', params: { slug: n.slug } }}
                    className="rounded-card border border-border bg-surface-card p-5 transition-colors hover:border-court-500"
                  >
                    <h3 className="font-heading font-bold leading-snug">
                      {n.title}
                    </h3>
                    {n.excerpt && (
                      <p className="mt-2 line-clamp-2 text-sm text-muted">
                        {n.excerpt}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ==================== SETKA ==================== */}
      {tab === 'bracket' && (
        <section className="mx-auto max-w-site px-4 py-10">
          {sectionTitle(tb('title'))}
          <div className="mt-5 space-y-8">
            {brackets.map((b) => (
              <BracketView key={b.id} bracket={b} />
            ))}
          </div>
        </section>
      )}

      {/* ==================== O'YINLAR ==================== */}
      {tab === 'matches' && (
        <section className="mx-auto max-w-site px-4 py-10">
          {sectionTitle(te('matches'))}
          {upcoming.length === 0 ? (
            <p className="mt-5 text-muted">{te('noMatches')}</p>
          ) : (
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((m) => (
                <MatchCard key={m.id} initial={toPayload(m)} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ==================== NATIJALAR ==================== */}
      {tab === 'results' && (
        <section className="mx-auto max-w-site px-4 py-10">
          {sectionTitle(te('results'))}
          {finished.length === 0 ? (
            <p className="mt-5 text-muted">{te('noResults')}</p>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[36rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                    <th className="py-2 pr-4 font-bold">{tm('stage_FINAL')}</th>
                    <th className="py-2 pr-4 font-bold">{tm('winner')}</th>
                    <th className="py-2 pr-4 font-bold">{tm('sets')}</th>
                    <th className="py-2 font-bold">{tm('table')}</th>
                  </tr>
                </thead>
                <tbody>
                  {finished.map((m) => {
                    const p1 = m.player1
                      ? `${m.player1.lastName} ${m.player1.firstName}`
                      : '—';
                    const p2 = m.player2
                      ? `${m.player2.lastName} ${m.player2.firstName}`
                      : '—';
                    const p1Won = m.player1SetsWon > m.player2SetsWon;
                    return (
                      <tr key={m.id} className="border-b border-border/60">
                        <td className="py-3 pr-4 text-xs uppercase text-muted">
                          {tm(`stage_${m.stage}`)}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={p1Won ? 'font-bold' : 'text-muted'}>
                            {p1}
                          </span>
                          <span className="mx-2 text-muted">—</span>
                          <span className={!p1Won ? 'font-bold' : 'text-muted'}>
                            {p2}
                          </span>
                        </td>
                        <td className="py-3 pr-4 font-mono font-bold">
                          {m.player1SetsWon}:{m.player2SetsWon}
                        </td>
                        <td className="py-3 text-muted">
                          {m.tableNumber ?? '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ==================== YANGILIKLAR ==================== */}
      {tab === 'news' && (
        <section className="mx-auto max-w-site px-4 py-10">
          {sectionTitle(tn('news'))}
          <div className="mt-5 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {news.map((n) => (
              <Link
                key={n.id}
                href={{ pathname: '/news/[slug]', params: { slug: n.slug } }}
                className="group rounded-card border border-border bg-surface-card p-5 transition-colors hover:border-court-500"
              >
                <h3 className="font-heading text-lg font-bold leading-snug group-hover:text-accent-400">
                  {n.title}
                </h3>
                {n.excerpt && (
                  <p className="mt-2 line-clamp-3 text-sm text-muted">
                    {n.excerpt}
                  </p>
                )}
                {n.publishedAt && (
                  <p className="mt-3 text-xs text-muted">
                    {new Date(n.publishedAt).toLocaleDateString(locale)}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ==================== GALEREYA VA VIDEO ==================== */}
      {tab === 'gallery' && (
        <div className="mx-auto max-w-site space-y-10 px-4 py-10">
          {galleries.length > 0 && (
            <section>
              {sectionTitle(te('tabGallery'))}
              <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {galleries.map((g) => (
                  <Link
                    key={g.id}
                    href={{ pathname: '/galleries/[id]', params: { id: g.id } }}
                    className="group overflow-hidden rounded-card bg-surface-card shadow-card"
                  >
                    <div className="relative aspect-[4/3] bg-navy-800">
                      {g.coverUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={
                            g.coverUrl.startsWith('http')
                              ? g.coverUrl
                              : apiBase + g.coverUrl
                          }
                          alt={g.title}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                      )}
                      <span className="absolute bottom-3 right-3 rounded bg-navy-950/80 px-2 py-0.5 text-xs font-semibold text-white">
                        {g.photoCount} {te('photoCount')}
                      </span>
                    </div>
                    <h3 className="p-4 font-heading font-bold leading-snug">
                      {g.title}
                    </h3>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {videos.length > 0 && (
            <section>
              {sectionTitle(te('videos'))}
              <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {videos.map((v) => (
                  <div
                    key={v.id}
                    className="overflow-hidden rounded-card bg-surface-card shadow-card"
                  >
                    <div className="aspect-video">
                      <iframe
                        src={`https://www.youtube-nocookie.com/embed/${v.youtubeId}`}
                        title={v.title}
                        allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
                        allowFullScreen
                        className="h-full w-full"
                      />
                    </div>
                    <h3 className="p-4 font-heading font-bold leading-snug">
                      {v.title}
                    </h3>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
