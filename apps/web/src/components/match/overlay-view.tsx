'use client';

import type { MatchPayload } from '@/lib/socket';

const STAGE_LABELS: Record<string, string> = {
  FINAL: 'FINAL',
  SEMIFINAL: 'YARIM FINAL',
  QUARTERFINAL: 'CHORAK FINAL',
  ROUND_OF_16: '1/8 FINAL',
  ROUND_OF_32: '1/16 FINAL',
  ROUND_1: '1-BOSQICH',
  GROUP: 'GURUH BOSQICHI',
};

/** "Aziz Rahimov" → { last: "RAHIMOV", first: "Aziz" } (WTT uslubi) */
function splitName(full: string) {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return { first: '', last: full.toUpperCase() };
  return {
    first: parts.slice(0, -1).join(' '),
    last: parts[parts.length - 1].toUpperCase(),
  };
}

/**
 * OBS Browser Source scorebug — WTT Streaming Guidelines bo'yicha:
 * pastki chap burchak, ixcham panel, bosqich qatori, podacha indikatori,
 * sariq/qizil kartochkalar, setpoint/matchpoint ko'rsatkichi.
 * Fon shaffof — OBS'da chroma-key kerak emas.
 */
export function OverlayView({ match }: { match: MatchPayload }) {
  const finished = match.status === 'FINISHED';
  const alert = match.pointAlert;

  const rows = [
    {
      slot: 1 as const,
      name: match.player1Name,
      sets: match.player1SetsWon,
      points: match.currentSetP1,
      cards: match.cards.filter((c) => c.player === 1),
    },
    {
      slot: 2 as const,
      name: match.player2Name,
      sets: match.player2SetsWon,
      points: match.currentSetP2,
      cards: match.cards.filter((c) => c.player === 2),
    },
  ];

  const winnerSlot = finished
    ? match.player1SetsWon > match.player2SetsWon
      ? 1
      : 2
    : null;

  return (
    <div className="fixed bottom-12 left-12 w-fit font-[system-ui] leading-none">
      {/* Bosqich qatori + setpoint/matchpoint indikatori */}
      <div className="flex w-full items-stretch overflow-hidden rounded-t-[4px]">
        <div className="flex-1 bg-broadcast-accent px-4 py-2 text-[13px] font-extrabold uppercase tracking-[0.12em] text-white">
          {match.tournament?.name ?? 'UZTT'}
          {match.stage ? ` | ${STAGE_LABELS[match.stage] ?? match.stage}` : ''}
          {match.tableNumber ? ` | STOL ${match.tableNumber}` : ''}
        </div>
        {alert && !finished && (
          <div className="flex items-center gap-2 bg-broadcast-gold px-4 py-2 text-[13px] font-extrabold uppercase tracking-[0.12em] text-broadcast-bg">
            <span className="size-2 animate-pulse rounded-full bg-broadcast-bg" />
            {alert.isMatchPoint ? 'MATCHPOINT' : 'SETPOINT'}
          </div>
        )}
      </div>

      {/* O'yinchi qatorlari */}
      <div className="w-full overflow-hidden rounded-b-[4px] shadow-[0_4px_24px_rgba(0,0,0,0.55)]">
        {rows.map((r) => {
          const { first, last } = splitName(r.name);
          const isWinner = winnerSlot === r.slot;
          const serving = !finished && match.server === r.slot;
          return (
            <div
              key={r.slot}
              className={`flex items-stretch ${r.slot === 1 ? 'border-b border-white/10' : ''}`}
            >
              {/* Ism bloki */}
              <div
                className={`flex min-w-[300px] flex-1 items-center gap-2.5 px-4 py-2.5 text-[18px] ${
                  isWinner ? 'bg-broadcast-gold text-broadcast-bg' : 'bg-broadcast-bg/95 text-white'
                }`}
              >
                {/* Podacha indikatori */}
                <span
                  className={`text-[12px] leading-none ${serving ? 'text-broadcast-gold' : 'text-transparent'}`}
                  aria-label={serving ? 'podacha' : undefined}
                >
                  ●
                </span>
                <span className="font-extrabold uppercase tracking-wide">{last}</span>
                <span className={isWinner ? 'text-broadcast-bg3' : 'text-white/70'}>
                  {first}
                </span>
                {/* Kartochkalar */}
                <span className="ml-auto flex items-center gap-1.5 pl-3">
                  {r.cards.map((c, i) => (
                    <span
                      key={i}
                      className={`inline-block h-[19px] w-[14px] rounded-[2px] ${
                        c.type === 'YELLOW' ? 'bg-broadcast-gold' : 'bg-broadcast-live'
                      }`}
                      title={c.type === 'YELLOW' ? 'Sariq kartochka' : 'Qizil kartochka'}
                    />
                  ))}
                </span>
              </div>

              {/* Setlar */}
              <div className="grid w-[46px] shrink-0 place-items-center bg-broadcast-bg4 text-[18px] font-extrabold tabular-nums text-white">
                {r.sets}
              </div>

              {/* Joriy ochko */}
              <div
                className={`grid w-[46px] shrink-0 place-items-center text-[18px] font-extrabold tabular-nums text-white ${
                  finished ? 'bg-broadcast-bg3' : 'bg-broadcast-accent'
                }`}
              >
                {finished ? '–' : r.points}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tugagan setlar + yakun holati */}
      {(match.sets.length > 0 || finished) && (
        <div className="mt-[3px] flex w-fit items-center gap-3 rounded-[4px] bg-broadcast-bg/90 px-4 py-[7px] text-[13px] tabular-nums text-white/85">
          {match.sets.length > 0 && (
            <span>
              {match.sets.map((s) => `${s.p1Points}-${s.p2Points}`).join('  ')}
            </span>
          )}
          {finished && match.winnerInfo && (
            <span className="font-extrabold uppercase tracking-wider text-broadcast-gold">
              {match.disqualifiedPlayerId ? 'DISKVALIFIKATSIYA · ' : ''}
              G&apos;OLIB: {splitName(match.winnerInfo.name).last}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
