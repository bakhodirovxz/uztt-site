import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { api, cached } from '@/lib/api';
import { LiveTicker } from '@/components/match/live-ticker';
import type { MatchPayload } from '@/lib/socket';

interface NewsItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  category: string | null;
  isFeatured: boolean;
  publishedAt: string | null;
  coverImageUrl: string | null;
}
interface RankingRow {
  rank: number;
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  region: string;
  rankingPoints: number;
}
interface TournamentRow {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  startDate: string;
  endDate: string;
  status: string;
  level: { name: string };
}
interface VideoItem {
  id: string;
  youtubeId: string;
  title: string;
  category: string | null;
}

// Sahifa har so'rovda yig'iladi (jonli lenta va reyting yangi bo'lishi kerak),
// lekin sekin o'zgaruvchi bloklar Data Cache'dan olinadi — TTFB pasayadi.
export const dynamic = 'force-dynamic';
export const fetchCache = 'default-cache';

/**
 * Bo'lim sarlavhasi: tepasida stolning markaziy chizig'i motivi (eyebrow),
 * chapda nom, o'ngda "hammasi" havolasi.
 */
function SectionHead({
  title,
  href,
  more,
  eyebrow,
}: {
  title: string;
  href: Parameters<typeof Link>[0]['href'];
  more: string;
  eyebrow?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2 className="mt-2 font-heading text-2xl font-extrabold uppercase tracking-tight">
          {title}
        </h2>
      </div>
      <Link
        href={href}
        className="inline-flex min-h-9 items-center text-sm font-bold uppercase tracking-wide text-accent-500 hover:text-accent-400"
      >
        {more} →
      </Link>
    </div>
  );
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const tm = await getTranslations('media');

  const [news, rankingsM, rankingsF, tournaments, videos, sponsors, liveMatches] =
    await Promise.all([
      api.get<NewsItem[]>(`/news?locale=${locale}`, cached('news', 60)).catch(() => []),
      api
        .get<{ rows: RankingRow[] }>('/rankings?gender=MALE&pageSize=5')
        .then((r) => r.rows)
        .catch(() => [] as RankingRow[]),
      api
        .get<{ rows: RankingRow[] }>('/rankings?gender=FEMALE&pageSize=5')
        .then((r) => r.rows)
        .catch(() => [] as RankingRow[]),
      api.get<TournamentRow[]>('/tournaments', cached('tournaments', 60)).catch(() => []),
      api.get<VideoItem[]>(`/videos?locale=${locale}`, cached('media', 300)).catch(() => []),
      api
        .get<Array<{ id: string; name: string; tier: number }>>(
          '/federation/sponsors',
          cached('federation', 300),
        )
        .catch(() => []),
      // Jonli lenta serverdan to'ldiriladi — birinchi chizishda joyida turadi
      api.get<MatchPayload[]>('/matches/live').catch(() => []),
    ]);

  const hero = news.find((n) => n.isFeatured) ?? news[0];
  const stories = news.filter((n) => n.id !== hero?.id).slice(0, 4);
  const upcoming = tournaments
    .filter((tr) => tr.status !== 'FINISHED')
    .slice(0, 3);

  return (
    <>
      <LiveTicker initial={liveMatches} />

      {/* HERO — to'liq eni, katta sarlavha (WTT layout tili, UZTT brendi) */}
      {hero ? (
        <section className="relative overflow-hidden bg-navy-950">
          {hero.coverImageUrl && (
            <Image
              src={hero.coverImageUrl}
              alt={hero.title}
              fill
              priority
              sizes="100vw"
              className="object-cover opacity-60"
            />
          )}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(1000px 500px at 80% 0%, rgba(255,107,0,0.32), transparent 55%), radial-gradient(700px 400px at 5% 100%, rgba(219,69,38,0.18), transparent 55%), linear-gradient(180deg, rgba(0,0,0,0) 35%, #000000 100%)',
            }}
          />
          <div className="relative mx-auto max-w-site px-4 pb-16 pt-14 md:pb-24 md:pt-20">
            {hero.category && (
              <span className="rounded bg-accent-600 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-white">
                {hero.category}
              </span>
            )}
            <h1 className="mt-4 max-w-4xl font-heading text-4xl font-extrabold leading-[1.05] text-white md:text-6xl">
              {hero.title}
            </h1>
            {hero.excerpt && (
              <p className="mt-5 max-w-2xl text-white/75 md:text-lg">
                {hero.excerpt}
              </p>
            )}
            <Link
              href={{ pathname: '/news/[slug]', params: { slug: hero.slug } }}
              className="mt-8 inline-block rounded-md bg-white px-6 py-3 font-bold uppercase tracking-wide text-navy-900 transition-colors hover:bg-gold-500"
            >
              {t('readMore')} →
            </Link>
          </div>
        </section>
      ) : (
        <section className="bg-navy-950 py-20 text-center">
          <h1 className="font-heading text-4xl font-extrabold uppercase text-white md:text-6xl">
            {t('heroTitle')}
          </h1>
        </section>
      )}

      {/* TOP STORIES — 4 ustunli yangilik kartalari */}
      <section className="mx-auto max-w-site px-4 pt-14">
        <SectionHead
          title={t('sectionNews')}
          href="/news"
          more={t('all')}
          eyebrow="Federatsiya"
        />
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stories.map((n) => (
            <Link
              key={n.id}
              href={{ pathname: '/news/[slug]', params: { slug: n.slug } }}
              className="group overflow-hidden rounded-card bg-surface-card shadow-card transition-shadow hover:shadow-card-hover"
            >
              <div className="relative h-36 overflow-hidden bg-navy-800">
                {n.coverImageUrl ? (
                  <Image
                    src={n.coverImageUrl}
                    alt={n.title}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div
                    className="absolute inset-0 opacity-80 transition-transform duration-300 group-hover:scale-105"
                    style={{
                      background:
                        'radial-gradient(300px 160px at 75% 25%, rgba(255,107,0,0.45), transparent 65%), radial-gradient(240px 140px at 15% 85%, rgba(219,69,38,0.45), transparent 60%)',
                    }}
                  />
                )}
                {n.category && (
                  <span className="absolute bottom-2 left-2 rounded bg-accent-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    {n.category}
                  </span>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-heading font-bold leading-snug group-hover:text-accent-400">
                  {n.title}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* VIDEOLAR — katta karta + grid (WTT layout) */}
      {videos.length > 0 && (
        <section className="band-alt mt-14 py-14">
          <div className="mx-auto max-w-site px-4">
          <SectionHead
            title={tm('videos')}
            href="/videos"
            more={t('all')}
            eyebrow="Kadrlar"
          />
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <VideoTile v={videos[0]} big />
            <div className="grid grid-cols-2 gap-4">
              {videos.slice(1, 5).map((v) => (
                <VideoTile key={v.id} v={v} />
              ))}
            </div>
          </div>
          </div>
        </section>
      )}

      {/* REYTING + MUSOBAQALAR */}
      <section className="mx-auto grid max-w-site gap-8 px-4 py-14 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionHead
            title={t('sectionRankings')}
            href="/rankings"
            more={t('all')}
            eyebrow="Milliy reyting"
          />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {(
              [
                [rankingsM, t('men')],
                [rankingsF, t('women')],
              ] as const
            ).map(([rows, label]) => (
              <div key={label} className="rounded-card bg-surface-card p-4 shadow-card">
                <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-muted">
                  {label}
                </h3>
                {rows.slice(0, 5).map((r) => (
                  <Link
                    key={r.id}
                    href={{ pathname: '/players/[slug]', params: { slug: r.slug } }}
                    className="flex min-h-9 items-center gap-3 border-b border-border py-2.5 last:border-0 hover:text-gold-500"
                  >
                    <span
                      className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-extrabold ${
                        r.rank === 1
                          ? 'bg-gold-500 text-navy-950'
                          : 'bg-surface-raised'
                      }`}
                    >
                      {r.rank}
                    </span>
                    <span className="flex-1 truncate text-sm font-medium">
                      {r.firstName} {r.lastName}
                    </span>
                    <span className="font-heading text-sm font-extrabold tabular-nums">
                      {r.rankingPoints}
                    </span>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionHead
            title={t('sectionEvents')}
            href="/events"
            more={t('all')}
            eyebrow="Kalendar"
          />
          <div className="mt-5 space-y-3">
            {upcoming.map((tr) => (
              <Link
                key={tr.id}
                href={{ pathname: '/events/[slug]', params: { slug: tr.slug } }}
                className="block rounded-card bg-surface-card p-4 shadow-card transition-shadow hover:shadow-card-hover"
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-accent-500">
                  {tr.level.name}
                </div>
                <div className="mt-1 font-heading font-bold leading-snug">
                  {tr.name}
                </div>
                <div className="mt-1 text-sm text-muted">
                  {tr.city} ·{' '}
                  {new Date(tr.startDate).toLocaleDateString(locale, {
                    day: 'numeric',
                    month: 'short',
                  })}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* HOMIYLAR */}
      {sponsors.length > 0 && (
        <section className="border-t border-border bg-navy-950/60">
          <div className="rail mx-auto max-w-site items-center px-4 py-8">
            {sponsors.map((s) => (
              <span
                key={s.id}
                className={`font-heading uppercase tracking-wider text-muted ${
                  s.tier === 1 ? 'text-lg font-extrabold' : 'text-sm font-bold'
                } px-6`}
              >
                {s.name}
              </span>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function VideoTile({ v, big = false }: { v: VideoItem; big?: boolean }) {
  return (
    <Link
      href="/videos"
      className={`group relative block overflow-hidden rounded-card bg-navy-800 shadow-card ${
        big ? 'min-h-64 lg:min-h-full' : 'aspect-video'
      }`}
    >
      <div
        className="absolute inset-0 opacity-90 transition-transform duration-300 group-hover:scale-105"
        style={{
          background:
            'radial-gradient(60% 70% at 70% 30%, rgba(219,69,38,0.6), transparent 70%), radial-gradient(50% 60% at 20% 80%, rgba(255,107,0,0.4), transparent 65%)',
        }}
      />
      <span
        className={`absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-accent-600 text-white transition-transform group-hover:scale-110 ${
          big ? 'size-16 text-2xl' : 'size-10 text-sm'
        }`}
      >
        ▶
      </span>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-950 to-transparent p-4 pt-10">
        {v.category && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-accent-400">
            {v.category}
          </span>
        )}
        <h3 className={`font-heading font-bold leading-snug ${big ? 'text-xl' : 'text-sm'}`}>
          {v.title}
        </h3>
      </div>
    </Link>
  );
}
