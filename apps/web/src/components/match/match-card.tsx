'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { subscribeToMatch, type MatchPayload } from '@/lib/socket';

/** Jonli hisob kartasi — socket orqali avtomatik yangilanadi */
export function MatchCard({ initial }: { initial: MatchPayload }) {
  const t = useTranslations('match');
  const [match, setMatch] = useState(initial);

  useEffect(() => {
    // Faqat tugallanmagan o'yinlar uchun obuna bo'lamiz
    if (initial.status === 'FINISHED') return;
    return subscribeToMatch(initial.id, (p) => {
      // Eski (kechikkan) eventlarni tashlaymiz — seq monotonik
      setMatch((prev) => (p.seq >= prev.seq ? p : prev));
    });
  }, [initial.id, initial.status]);

  const isLive = match.status === 'LIVE';
  const p1Cards = match.cards.filter((c) => c.player === 1);
  const p2Cards = match.cards.filter((c) => c.player === 2);

  return (
    <div className="rounded-card bg-surface-card shadow-card">
      {/* Sarlavha: bosqich + holat (tafsilotga havola) */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <Link
          href={{ pathname: '/live/[id]', params: { id: match.id } }}
          className="inline-flex min-h-8 items-center text-xs font-semibold uppercase tracking-wide text-muted hover:text-accent-400"
        >
          {t(`stage_${match.stage}`)}
          {match.tableNumber ? ` · ${t('table')} ${match.tableNumber}` : ''} →
        </Link>
        {isLive ? (
          <span className="flex items-center gap-1.5 text-xs font-bold text-live">
            <span className="size-2 animate-pulse rounded-full bg-live" />
            {t('live')}
          </span>
        ) : (
          <span className="text-xs font-semibold text-muted">
            {match.status === 'FINISHED' ? t('finished') : t('scheduled')}
          </span>
        )}
      </div>

      {/* O'yinchilar va hisob */}
      <div className="space-y-2 px-4 py-3">
        {(
          [
            [match.player1Name, match.player1SetsWon, match.currentSetP1, p1Cards, 1],
            [match.player2Name, match.player2SetsWon, match.currentSetP2, p2Cards, 2],
          ] as const
        ).map(([name, setsWon, current, cards, slot]) => {
          const winner =
            match.status === 'FINISHED' &&
            match.winnerInfo &&
            ((slot === 1 && match.player1SetsWon > match.player2SetsWon) ||
              (slot === 2 && match.player2SetsWon > match.player1SetsWon) ||
              (match.disqualifiedPlayerId &&
                match.winnerInfo.name === name));
          return (
            <div key={slot} className="flex items-center justify-between gap-2">
              <span
                className={`truncate font-medium ${winner ? 'font-bold' : ''}`}
              >
                {name}
                {cards.map((c, i) => (
                  <span
                    key={i}
                    className={`ml-1.5 inline-block h-3.5 w-2.5 rounded-[2px] align-middle ${
                      c.type === 'YELLOW' ? 'bg-gold-500' : 'bg-live'
                    }`}
                  />
                ))}
              </span>
              <span className="flex items-center gap-3 tabular-nums">
                {isLive && (
                  <span className="text-lg font-bold text-accent-400">
                    {current}
                  </span>
                )}
                <span className="grid size-7 place-items-center rounded bg-navy-900 text-sm font-bold text-white">
                  {setsWon}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {/* Setlar / g'olib */}
      <div className="border-t border-border px-4 py-2 text-xs text-muted">
        {match.sets.length > 0 && (
          <span>
            {match.sets
              .map((s) => `${s.p1Points}-${s.p2Points}`)
              .join(', ')}
          </span>
        )}
        {match.status === 'FINISHED' && match.winnerInfo && (
          <span className="ml-2 font-semibold text-win">
            {match.disqualifiedPlayerId ? t('disqualified') + ' → ' : ''}
            {t('winner')}: {match.winnerInfo.name} (+
            {match.winnerInfo.pointsAwarded} {t('points')})
          </span>
        )}
      </div>
    </div>
  );
}
