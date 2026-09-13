'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { subscribeToMatch, type MatchPayload } from '@/lib/socket';

/** O'yin tafsiloti / post-match sahifasi — jonli yangilanadi */
export default function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const tm = useTranslations('match');
  const tc = useTranslations('common');
  const [match, setMatch] = useState<MatchPayload | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let active = true;
    api
      .get<MatchPayload>(`/matches/${id}`)
      .then((m) => {
        if (!active) return;
        setMatch(m);
        if (m.status !== 'FINISHED') {
          cleanup = subscribeToMatch(m.id, (p) => {
            setMatch((prev) => (prev && p.seq >= prev.seq ? p : prev));
          });
        }
      })
      .catch(() => setNotFound(true));
    return () => {
      active = false;
      cleanup?.();
    };
  }, [id]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted">
        404 — {tc('error')}
      </div>
    );
  }
  if (!match) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-muted">
        {tc('loading')}
      </div>
    );
  }

  const isLive = match.status === 'LIVE';
  const rows = [
    {
      slot: 1 as const,
      name: match.player1Name,
      sets: match.player1SetsWon,
      current: match.currentSetP1,
      cards: match.cards.filter((c) => c.player === 1),
    },
    {
      slot: 2 as const,
      name: match.player2Name,
      sets: match.player2SetsWon,
      current: match.currentSetP2,
      cards: match.cards.filter((c) => c.player === 2),
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {/* Sarlavha */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
        {match.tournament && (
          <Link
            href={{ pathname: '/events/[slug]', params: { slug: match.tournament.slug } }}
            className="font-semibold text-navy-700 hover:text-accent-400"
          >
            {match.tournament.name}
          </Link>
        )}
        <span>· {tm(`stage_${match.stage}`)}</span>
        {match.tableNumber && <span>· {tm('table')} {match.tableNumber}</span>}
        {isLive && (
          <span className="ml-auto flex items-center gap-1.5 font-bold text-live">
            <span className="size-2 animate-pulse rounded-full bg-live" />
            {tm('live')}
          </span>
        )}
      </div>

      {/* Katta scoreboard */}
      <div className="mt-4 overflow-hidden rounded-card bg-navy-900 text-white shadow-card">
        {rows.map((r) => {
          const winner = match.status === 'FINISHED' && match.winnerInfo?.name === r.name;
          return (
            <div
              key={r.slot}
              className={`flex items-center gap-4 px-6 py-5 ${r.slot === 1 ? 'border-b border-white/10' : ''}`}
            >
              <span className={`min-w-0 flex-1 truncate font-heading text-2xl ${winner ? 'font-extrabold text-gold-500' : 'font-semibold'}`}>
                {r.name}
                {r.cards.map((c, i) => (
                  <span
                    key={i}
                    className={`ml-2 inline-block h-4 w-2.5 rounded-[2px] align-middle ${c.type === 'YELLOW' ? 'bg-gold-500' : 'bg-live'}`}
                  />
                ))}
              </span>
              {isLive && (
                <span className="font-heading text-4xl font-extrabold tabular-nums text-accent-400">
                  {r.current}
                </span>
              )}
              <span className="grid size-11 place-items-center rounded bg-white/10 font-heading text-2xl font-extrabold tabular-nums">
                {r.sets}
              </span>
            </div>
          );
        })}
      </div>

      {/* Setlar jadvali */}
      {match.sets.length > 0 && (
        <div className="mt-5 overflow-x-auto rounded-card bg-surface-card shadow-card">
          <table className="w-full text-center text-sm tabular-nums">
            <thead>
              <tr className="bg-surface text-xs font-bold uppercase text-muted">
                <th className="px-4 py-2 text-left">{tm('sets')}</th>
                {match.sets.map((s) => (
                  <th key={s.setNumber} className="px-3 py-2">{s.setNumber}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <td className="px-4 py-2 text-left font-medium">{match.player1Name}</td>
                {match.sets.map((s) => (
                  <td key={s.setNumber} className={`px-3 py-2 ${s.p1Points > s.p2Points ? 'font-extrabold text-win' : ''}`}>
                    {s.p1Points}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-border">
                <td className="px-4 py-2 text-left font-medium">{match.player2Name}</td>
                {match.sets.map((s) => (
                  <td key={s.setNumber} className={`px-3 py-2 ${s.p2Points > s.p1Points ? 'font-extrabold text-win' : ''}`}>
                    {s.p2Points}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Yakun banneri */}
      {match.status === 'FINISHED' && match.winnerInfo && (
        <div className="mt-5 rounded-card border border-gold-500/40 bg-gold-100 p-5 text-center">
          <span className="font-heading text-lg font-extrabold uppercase text-gold-500">
            {match.disqualifiedPlayerId ? `${tm('disqualified')} → ` : ''}
            {tm('winner')}: {match.winnerInfo.name} (+{match.winnerInfo.pointsAwarded} {tm('points')})
          </span>
          {match.disqualificationReason && (
            <p className="mt-1 text-sm text-muted">{match.disqualificationReason}</p>
          )}
        </div>
      )}
    </div>
  );
}
