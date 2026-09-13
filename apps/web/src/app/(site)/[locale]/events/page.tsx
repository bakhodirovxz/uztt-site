import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { api, cached } from '@/lib/api';

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

  const tournaments = await api.get<TournamentRow[]>('/tournaments', cached('tournaments', 60))
    .catch(() => [] as TournamentRow[]);

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  return (
    <div className="mx-auto max-w-site px-4 py-12">
      <h1 className="font-heading text-3xl font-extrabold uppercase tracking-tight">
        {t('events')}
      </h1>

      <div className="mt-8 space-y-4">
        {tournaments.map((tr) => (
          <Link
            key={tr.id}
            href={{ pathname: '/events/[slug]', params: { slug: tr.slug } }}
            className="group flex flex-wrap items-center gap-4 rounded-card bg-surface-card p-5 shadow-card transition-shadow hover:shadow-card-hover"
          >
            {/* Sana bloki */}
            <div className="grid size-16 shrink-0 place-items-center rounded-card bg-navy-900 text-center text-white">
              <span className="font-heading text-xs font-bold uppercase leading-tight">
                {fmt(tr.startDate)}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="truncate font-heading text-lg font-bold group-hover:text-accent-400">
                {tr.name}
              </h2>
              <p className="truncate text-sm text-muted">
                {[tr.city, tr.venue].filter(Boolean).join(' · ')} ·{' '}
                {tr.level.name} (×{tr.level.coefficient})
              </p>
            </div>

            {tr.status === 'LIVE' ? (
              <span className="flex items-center gap-1.5 rounded-full bg-accent-700 px-3 py-1 text-xs font-bold uppercase text-white">
                <span className="size-1.5 animate-pulse rounded-full bg-white" />
                {tm('live')}
              </span>
            ) : (
              <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-muted">
                {tr.status === 'FINISHED' ? te('finished') : te('upcoming')}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
