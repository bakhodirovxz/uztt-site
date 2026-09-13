import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { api, cached } from '@/lib/api';
import { Container, PageTitleBar } from '@/components/ui';

interface TournamentRow {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  venue: string | null;
  startDate: string;
  endDate: string;
  status: 'UPCOMING' | 'LIVE' | 'FINISHED';
  level: { code: string; name: string; coefficient: number };
}

export const dynamic = 'force-dynamic';
export const fetchCache = 'default-cache';

export default async function EventsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('nav');
  const te = await getTranslations('eventsPage');
  const tm = await getTranslations('match');

  const tournaments = await api.get<TournamentRow[]>(`/tournaments?locale=${locale}`, cached('tournaments', 60))
    .catch(() => [] as TournamentRow[]);

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  return (
    <>
      <PageTitleBar title={t('events')} />
      <Container className="py-8">

      {/*
        Ilgari har musobaqa to'liq enli qator edi: 50 ta turnir 7400px
        balandlik bergan. WTT bu ro'yxatni zich to'rda beradi (uning
        sahifasi 3237px) — biz ham ustunlarga o'tkazdik.
      */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tournaments.map((tr) => (
          <Link
            key={tr.id}
            href={{ pathname: '/events/[slug]', params: { slug: tr.slug } }}
            className="group flex items-start gap-3 rounded-card border border-border bg-surface-card p-3.5 shadow-card transition-shadow hover:shadow-card-hover"
          >
            {/* Sana bloki */}
            <div className="grid size-12 shrink-0 place-items-center rounded-card bg-navy-900 text-center text-white">
              <span className="font-heading text-[11px] font-bold uppercase leading-tight">
                {fmt(tr.startDate)}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="line-clamp-2 font-heading text-[15px] font-bold leading-snug group-hover:text-accent-500">
                {tr.name}
              </h2>
              <p className="mt-1 truncate text-xs text-muted">
                {[tr.city, tr.venue].filter(Boolean).join(' · ')}
              </p>
              <p className="mt-1.5 flex items-center gap-2">
                <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-accent-500">
                  {tr.level.name}
                </span>
                {tr.status === 'LIVE' ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-card bg-live px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                    <span className="size-1 animate-pulse rounded-full bg-white" />
                    {tm('live')}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-card bg-surface-alt px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted">
                    {tr.status === 'FINISHED' ? te('finished') : te('upcoming')}
                  </span>
                )}
              </p>
            </div>
          </Link>
        ))}
      </div>
      </Container>
    </>
  );
}
