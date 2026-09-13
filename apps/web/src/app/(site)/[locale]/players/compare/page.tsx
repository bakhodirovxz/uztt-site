import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';

interface PlayerLite {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  region: string;
  club: string | null;
  rankingPoints: number;
}

interface H2H {
  playerA: PlayerLite;
  playerB: PlayerLite;
  totals: {
    aWins: number;
    bWins: number;
    played: number;
    setsA: number;
    setsB: number;
  };
  matches: Array<{
    id: string;
    stage: string;
    winnerId: string | null;
    player1: { id: string; firstName: string; lastName: string } | null;
    player1SetsWon: number;
    player2SetsWon: number;
    tournament: { name: string };
    sets: Array<{ p1Points: number; p2Points: number }>;
  }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const tp = await getTranslations({ locale, namespace: 'playersPage' });
  return { title: tp('compareTitle') };
}

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { locale } = await params;
  const { a, b } = await searchParams;
  setRequestLocale(locale);
  const tp = await getTranslations('playersPage');
  const tm = await getTranslations('match');

  const players = await api
    .get<{ rows: PlayerLite[] }>('/players?pageSize=500')
    .then((r) => r.rows)
    .catch(() => [] as PlayerLite[]);

  const h2h =
    a && b && a !== b
      ? await api.get<H2H>(`/players/${a}/vs/${b}`).catch(() => null)
      : null;

  const selectClass =
    'w-full rounded-md border border-border bg-surface-card px-3 py-2.5 text-sm outline-none focus:border-accent-500';

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="font-heading text-3xl font-extrabold uppercase tracking-tight">
        {tp('compareTitle')}
      </h1>
      <p className="mt-2 text-muted">{tp('comparePick')}</p>

      {/* JS'siz ishlaydi: oddiy GET forma */}
      <form className="mt-6 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
            {tp('selectA')}
          </span>
          <select name="a" defaultValue={a ?? ''} className={selectClass}>
            <option value="">—</option>
            {players.map((p) => (
              <option key={p.id} value={p.slug}>
                {p.lastName} {p.firstName} ({p.rankingPoints})
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
            {tp('selectB')}
          </span>
          <select name="b" defaultValue={b ?? ''} className={selectClass}>
            <option value="">—</option>
            {players.map((p) => (
              <option key={p.id} value={p.slug}>
                {p.lastName} {p.firstName} ({p.rankingPoints})
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent-600 px-6 font-semibold text-white hover:bg-accent-500"
        >
          {tp('compare')}
        </button>
      </form>

      {h2h && (
        <>
          {/* Umumiy hisob */}
          <section className="mt-10 rounded-card border border-border bg-surface-card p-6">
            <div className="grid grid-cols-3 items-center gap-4 text-center">
              <div>
                <Link
                  href={{
                    pathname: '/players/[slug]',
                    params: { slug: h2h.playerA.slug },
                  }}
                  className="font-heading text-lg font-extrabold uppercase hover:text-accent-400"
                >
                  {h2h.playerA.lastName} {h2h.playerA.firstName}
                </Link>
                <p className="mt-1 text-xs text-muted">
                  {h2h.playerA.region} · {h2h.playerA.rankingPoints} {tp('points')}
                </p>
              </div>

              <div>
                <div className="font-heading text-4xl font-extrabold tabular-nums">
                  <span
                    className={
                      h2h.totals.aWins > h2h.totals.bWins ? 'text-win' : ''
                    }
                  >
                    {h2h.totals.aWins}
                  </span>
                  <span className="mx-2 text-muted">:</span>
                  <span
                    className={
                      h2h.totals.bWins > h2h.totals.aWins ? 'text-win' : ''
                    }
                  >
                    {h2h.totals.bWins}
                  </span>
                </div>
                <p className="mt-1 text-xs uppercase tracking-wider text-muted">
                  {tp('h2h')} · {tp('sets')} {h2h.totals.setsA}:{h2h.totals.setsB}
                </p>
              </div>

              <div>
                <Link
                  href={{
                    pathname: '/players/[slug]',
                    params: { slug: h2h.playerB.slug },
                  }}
                  className="font-heading text-lg font-extrabold uppercase hover:text-accent-400"
                >
                  {h2h.playerB.lastName} {h2h.playerB.firstName}
                </Link>
                <p className="mt-1 text-xs text-muted">
                  {h2h.playerB.region} · {h2h.playerB.rankingPoints} {tp('points')}
                </p>
              </div>
            </div>
          </section>

          {/* Qarshilashuvlar ro'yxati */}
          {h2h.matches.length === 0 ? (
            <p className="mt-6 text-muted">{tp('noH2h')}</p>
          ) : (
            <div className="mt-6 space-y-2">
              {h2h.matches.map((m) => {
                const aIsP1 = m.player1?.id === h2h.playerA.id;
                const aSets = aIsP1 ? m.player1SetsWon : m.player2SetsWon;
                const bSets = aIsP1 ? m.player2SetsWon : m.player1SetsWon;
                return (
                  <div
                    key={m.id}
                    className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface-card px-4 py-3"
                  >
                    <span className="text-xs uppercase tracking-wide text-muted">
                      {tm(`stage_${m.stage}`)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-muted">
                      {m.tournament.name}
                    </span>
                    <span className="text-sm tabular-nums text-muted">
                      {m.sets.map((s) => `${s.p1Points}-${s.p2Points}`).join(', ')}
                    </span>
                    <span className="font-heading font-extrabold tabular-nums">
                      {aSets}:{bSets}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
