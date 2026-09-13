import Image from 'next/image';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import { PointsChart } from '@/components/player/points-chart';

interface PlayerDetail {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  gender: 'MALE' | 'FEMALE';
  region: string;
  club: string | null;
  clubRecord: {
    id: string;
    slug: string;
    name: string;
    logoUrl: string | null;
    regionName: string | null;
  } | null;
  rankingPoints: number;
  photoUrl: string | null;
  licenseNumber: string | null;
  ageCategory: { code: string; name: string } | null;
  rank: number | null;
  matches: Array<{
    id: string;
    stage: string;
    status: string;
    winnerId: string | null;
    player1: { id: string; firstName: string; lastName: string } | null;
    player2: { id: string; firstName: string; lastName: string } | null;
    tournament: { name: string };
    sets: Array<{ p1Points: number; p2Points: number }>;
    player1SetsWon: number;
    player2SetsWon: number;
  }>;
}

interface PlayerHistory {
  points: Array<{ date: string; delta: number; points: number; reason: string }>;
  ranks: Array<{ label: string; takenAt: string; rank: number; points: number }>;
  stats: {
    played: number;
    wins: number;
    losses: number;
    winRate: number;
    titles: number;
    setsWon: number;
    setsLost: number;
  };
}

export const dynamic = 'force-dynamic';

const chip = (active: boolean) =>
  `inline-flex min-h-9 items-center rounded border px-4 text-sm font-semibold transition-colors ${
    active
      ? 'border-navy-700 bg-navy-700 text-white'
      : 'border-border-strong bg-white text-ink hover:border-navy-600 hover:text-navy-700'
  }`;

/** O'ng paneldagi kartalar (Hudud, Sport maktabi/klubi) — uttf.uz uslubiga mos */
function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-border bg-surface-card p-4">
      <h3 className="border-b border-border pb-2 font-heading text-sm font-bold uppercase tracking-wide text-ink">
        {title}
      </h3>
      <dl className="mt-3 space-y-2.5">{children}</dl>
    </div>
  );
}

function InfoRow({
  label,
  value,
  notAvailable,
}: {
  label: string;
  value: string | null | undefined;
  notAvailable: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <dt className="text-muted">{label}:</dt>
      <dd className={`text-right font-semibold ${value ? 'text-ink' : 'italic text-muted'}`}>
        {value || notAvailable}
      </dd>
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const player = await api
    .get<PlayerDetail>(`/players/${slug}`)
    .catch(() => null);
  if (!player) return {};
  const title = `${player.firstName} ${player.lastName}`;
  const description = `${title} — ${player.region}${player.club ? `, ${player.club}` : ''} · ${player.rankingPoints} ball`;
  return {
    title,
    description,
    openGraph: { title, description, type: 'profile' },
  };
}

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('nav');
  const tp = await getTranslations('playersPage');

  const player = await api.get<PlayerDetail>(`/players/${slug}`).catch((e) => {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  });
  if (!player) notFound();

  const history = await api
    .get<PlayerHistory>(`/players/${slug}/history`)
    .catch(() => null);

  const stats = history?.stats;

  return (
    <>
      {/* Orqaga + sahifa nomi + bo'lim havolalari (uttf.uz'dagi Sportchi sahifasi tuzilishiga mos) */}
      <div className="border-b border-border bg-surface-card">
        <div className="mx-auto flex max-w-site flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-2 text-sm">
            <Link
              href="/players"
              className="inline-flex min-h-8 items-center gap-1 font-semibold text-muted hover:text-ink"
            >
              ‹ {tp('back')}
            </Link>
            <span className="text-border-strong">|</span>
            <span className="font-heading font-bold uppercase tracking-wide text-navy-700">
              {t('players')}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="#malumotlar" className={chip(true)}>
              {tp('tabInfo')}
            </a>
            <a href="#musobaqalar" className={chip(false)}>
              {tp('tabMatches')}
            </a>
            <a href="#ballar-tarixi" className={chip(false)}>
              {tp('tabPointsHistory')}
            </a>
          </div>
        </div>
      </div>

      {/* Profil hero */}
      <section id="malumotlar" className="bg-surface">
        <div className="mx-auto grid max-w-site gap-8 px-4 py-10 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-wrap items-start gap-6">
            {player.photoUrl ? (
              <div className="relative size-28 shrink-0 overflow-hidden rounded-full bg-surface-alt sm:size-36">
                <Image src={player.photoUrl} alt="" fill sizes="144px" className="object-cover" />
              </div>
            ) : (
              <div className="grid size-28 shrink-0 place-items-center rounded-full bg-navy-800 font-heading text-3xl font-extrabold text-white sm:size-36">
                {player.firstName[0]}
                {player.lastName[0]}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-heading text-3xl font-extrabold uppercase tracking-tight text-ink sm:text-4xl">
                  {player.firstName} {player.lastName}
                </h1>
                {player.ageCategory && (
                  <span className="rounded bg-surface-alt px-2 py-1 text-xs font-bold uppercase tracking-wider text-muted">
                    {player.ageCategory.code}
                  </span>
                )}
              </div>
              {player.clubRecord?.logoUrl && (
                <span className="relative mt-2 inline-block size-6 overflow-hidden rounded-full bg-surface-alt align-middle">
                  <Image
                    src={player.clubRecord.logoUrl}
                    alt={player.clubRecord.name}
                    fill
                    sizes="24px"
                    className="object-contain"
                  />
                </span>
              )}

              {/* Yoshi / Reyting / Ballar / ID raqami — uttf.uz'dagi statistika qatoriga mos */}
              <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wider text-muted">
                    {tp('age')}
                  </dt>
                  <dd className="mt-1 font-heading text-2xl font-extrabold text-ink">
                    {player.ageCategory?.name ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wider text-muted">
                    {tp('rank')}
                  </dt>
                  <dd className="mt-1 font-heading text-2xl font-extrabold tabular-nums text-navy-700">
                    {player.rank ? `${player.rank}-o'rin` : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wider text-muted">
                    {tp('points')}
                  </dt>
                  <dd className="mt-1 font-heading text-2xl font-extrabold tabular-nums text-court-500">
                    {player.rankingPoints}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wider text-muted">
                    {tp('idNumber')}
                  </dt>
                  <dd className="mt-1 font-heading text-lg font-extrabold tabular-nums text-ink">
                    {player.licenseNumber ?? '—'}
                  </dd>
                </div>
              </dl>

              <Link
                href={{ pathname: '/players/compare', query: { a: player.slug } }}
                className="mt-6 inline-flex min-h-9 items-center rounded-md border border-border-strong px-4 text-sm font-semibold text-ink transition-colors hover:border-navy-600 hover:text-navy-700"
              >
                {tp('compare')}
              </Link>
            </div>
          </div>

          {/* O'ng panel: Hudud + Sport maktabi/klubi (uttf.uz'dagi kartalarga mos) */}
          <div className="space-y-6">
            <InfoCard title={tp('addressBox')}>
              <InfoRow label={tp('addressName')} value={player.region || null} notAvailable={tp('notAvailable')} />
            </InfoCard>
            <InfoCard title={tp('clubBox')}>
              <InfoRow
                label={tp('clubName')}
                value={player.clubRecord?.name ?? player.club ?? null}
                notAvailable={tp('notAvailable')}
              />
              <InfoRow
                label={tp('addressName')}
                value={player.clubRecord?.regionName ?? null}
                notAvailable={tp('notAvailable')}
              />
            </InfoCard>
          </div>
        </div>
      </section>

      {/* Statistika va reyting grafigi */}
      <div id="ballar-tarixi" className="mx-auto max-w-site space-y-10 px-4 py-10">
        {stats && stats.played > 0 && (
          <section>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {(
                [
                  [tp('played'), String(stats.played)],
                  [tp('wins'), String(stats.wins)],
                  [tp('losses'), String(stats.losses)],
                  [tp('winRate'), `${stats.winRate}%`],
                  [tp('sets'), `${stats.setsWon}:${stats.setsLost}`],
                ] as const
              ).map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-card border border-border bg-surface-card p-4"
                >
                  <dt className="text-xs font-bold uppercase tracking-wider text-muted">
                    {label}
                  </dt>
                  <dd className="mt-1 font-heading text-2xl font-extrabold tabular-nums">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <PointsChart
          data={history?.points ?? []}
          title={tp('pointsHistory')}
          emptyLabel={tp('noPointsHistory')}
          tableLabel={tp('tableView')}
          dateLabel={tp('date')}
          pointsLabel={tp('points')}
          locale={locale}
        />

        {history && history.ranks.length > 0 && (
          <section>
            <h2 className="font-heading text-xl font-bold uppercase tracking-wide">
              {tp('rankHistory')}
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {history.ranks.map((r) => (
                <span
                  key={r.label}
                  className="rounded-md border border-border bg-surface-card px-3 py-2 text-sm"
                >
                  <span className="text-muted">{r.label}</span>{' '}
                  <span className="font-heading font-extrabold tabular-nums">
                    #{r.rank}
                  </span>
                </span>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* O'yinlar tarixi */}
      <section id="musobaqalar" className="mx-auto max-w-site px-4 py-10">
        <h2 className="font-heading text-xl font-bold uppercase tracking-wide">
          {tp('matches')}
        </h2>
        <div className="mt-4 space-y-3">
          {player.matches.map((m) => {
            const won = m.winnerId === player.id;
            const opponent =
              m.player1?.id === player.id ? m.player2 : m.player1;
            return (
              <div
                key={m.id}
                className="flex flex-wrap items-center gap-3 rounded-card bg-surface-card px-4 py-3 shadow-card"
              >
                <span
                  className={`grid size-8 place-items-center rounded-full text-sm font-extrabold text-white ${
                    m.status !== 'FINISHED'
                      ? 'bg-muted'
                      : won
                        ? 'bg-win'
                        : 'bg-live'
                  }`}
                >
                  {m.status !== 'FINISHED' ? '•' : won ? 'G' : 'M'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    vs{' '}
                    {opponent
                      ? `${opponent.firstName} ${opponent.lastName}`
                      : '—'}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {m.tournament.name}
                  </div>
                </div>
                <div className="text-sm tabular-nums text-muted">
                  {m.sets.map((s) => `${s.p1Points}-${s.p2Points}`).join(', ')}
                </div>
                <div className="font-heading font-extrabold tabular-nums">
                  {m.player1SetsWon}:{m.player2SetsWon}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
