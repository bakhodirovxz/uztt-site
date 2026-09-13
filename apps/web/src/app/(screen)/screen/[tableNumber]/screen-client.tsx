'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { subscribeToMatch, type MatchPayload } from '@/lib/socket';

const STAGE: Record<string, string> = {
  FINAL: 'FINAL',
  SEMIFINAL: 'YARIM FINAL',
  QUARTERFINAL: 'CHORAK FINAL',
  ROUND_OF_16: '1/8 FINAL',
  ROUND_OF_32: '1/16 FINAL',
  ROUND_1: '1-BOSQICH',
  GROUP: 'GURUH BOSQICHI',
};

function splitName(full: string) {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return { first: '', last: full.toUpperCase() };
  return {
    first: parts.slice(0, -1).join(' '),
    last: parts[parts.length - 1].toUpperCase(),
  };
}

export function ScreenClient({ tableNumber }: { tableNumber: number }) {
  const [match, setMatch] = useState<MatchPayload | null>(null);
  const [schedule, setSchedule] = useState<MatchPayload[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    api
      .get<MatchPayload>(`/matches/table/${tableNumber}/current`)
      .then(setMatch)
      .catch(() => setMatch(null))
      .finally(() => setLoaded(true));
    api
      .get<MatchPayload[]>(`/matches/table/${tableNumber}/schedule`)
      .then(setSchedule)
      .catch(() => setSchedule([]));
  }, [tableNumber]);

  useEffect(() => {
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!match) return;
    return subscribeToMatch(match.id, (p) => {
      setMatch((prev) => (prev && p.seq >= prev.seq ? p : prev));
      if (p.status === 'FINISHED') setTimeout(load, 15_000);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.id]);

  if (!loaded) return null;

  // O'yin yo'q — keyingi o'yinlar jadvali (Upcoming Match Slate)
  if (!match) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-8 p-12 text-white">
        <Header tableNumber={tableNumber} />
        <p className="font-heading text-3xl font-extrabold uppercase tracking-wide text-broadcast-muted">
          Hozircha o&apos;yin yo&apos;q
        </p>
      </div>
    );
  }

  const finished = match.status === 'FINISHED';
  const live = match.status === 'LIVE';
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
    <div className="flex h-screen flex-col p-[3vh] text-white">
      <Header
        tableNumber={tableNumber}
        tournament={match.tournament?.name}
        stage={STAGE[match.stage] ?? match.stage}
        live={live}
        waiting={!live && !finished}
        alert={
          alert && !finished
            ? alert.isMatchPoint
              ? 'MATCHPOINT'
              : 'SETPOINT'
            : null
        }
      />

      {/* Asosiy hisob */}
      <div className="flex flex-1 flex-col justify-center gap-[2vh]">
        {rows.map((r) => {
          const { first, last } = splitName(r.name);
          const isWinner = winnerSlot === r.slot;
          const serving = live && match.server === r.slot;
          return (
            <div
              key={r.slot}
              className={`flex items-center gap-[2vw] rounded-[1vh] px-[3vw] py-[2.5vh] ${
                isWinner ? 'bg-broadcast-gold text-broadcast-bg' : 'bg-broadcast-bg2'
              }`}
            >
              {/* Podacha */}
              <span
                className={`text-[4vh] leading-none ${
                  serving ? 'text-broadcast-gold' : 'text-transparent'
                }`}
              >
                ●
              </span>

              <div className="min-w-0 flex-1">
                <div className="truncate font-heading text-[7vh] font-extrabold uppercase leading-none">
                  {last}
                </div>
                <div
                  className={`truncate text-[3vh] ${isWinner ? 'text-broadcast-bg3' : 'text-white/60'}`}
                >
                  {first}
                </div>
              </div>

              {/* Kartochkalar */}
              <div className="flex gap-[0.6vw]">
                {r.cards.map((c, i) => (
                  <span
                    key={i}
                    className={`inline-block h-[5vh] w-[3vh] rounded-[0.4vh] ${
                      c.type === 'YELLOW' ? 'bg-broadcast-gold' : 'bg-broadcast-live'
                    }`}
                  />
                ))}
              </div>

              {/* Setlar */}
              <div className="grid size-[10vh] shrink-0 place-items-center rounded-[1vh] bg-broadcast-bg4 font-heading text-[6vh] font-extrabold tabular-nums text-white">
                {r.sets}
              </div>

              {/* Joriy ochko */}
              {!finished && (
                <div className="grid size-[14vh] shrink-0 place-items-center rounded-[1vh] bg-broadcast-accent font-heading text-[9vh] font-extrabold tabular-nums text-white">
                  {r.points}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Setlar tarixi / g'olib */}
      <div className="flex items-center justify-between text-[2.6vh]">
        <div className="flex gap-[1.5vw] tabular-nums text-white/70">
          {match.sets.map((s) => (
            <span key={s.setNumber}>
              <span className="text-white/40">{s.setNumber}:</span> {s.p1Points}-
              {s.p2Points}
            </span>
          ))}
        </div>
        {finished && match.winnerInfo && (
          <div className="font-heading font-extrabold uppercase tracking-wider text-broadcast-gold">
            {match.disqualifiedPlayerId ? 'Diskvalifikatsiya · ' : ''}
            G&apos;olib: {match.winnerInfo.name}
          </div>
        )}
      </div>

      {/* Keyingi o'yinlar */}
      {schedule.filter((s) => s.id !== match.id).length > 0 && (
        <div className="mt-[2vh] border-t border-white/10 pt-[1.5vh]">
          <div className="mb-[1vh] text-[2vh] font-bold uppercase tracking-[0.2em] text-broadcast-muted">
            Keyingi o&apos;yinlar
          </div>
          <div className="flex gap-[2vw] text-[2.4vh] text-white/80">
            {schedule
              .filter((s) => s.id !== match.id)
              .slice(0, 3)
              .map((s) => (
                <span key={s.id}>
                  {splitName(s.player1Name).last} — {splitName(s.player2Name).last}
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Header({
  tableNumber,
  tournament,
  stage,
  live,
  waiting,
  alert,
}: {
  tableNumber: number;
  tournament?: string;
  stage?: string;
  live?: boolean;
  waiting?: boolean;
  alert?: string | null;
}) {
  return (
    <div className="flex items-center gap-[1.5vw]">
      <span className="rounded-[0.8vh] bg-broadcast-accent px-[1.5vw] py-[1vh] font-heading text-[3vh] font-extrabold uppercase tracking-wider">
        STOL {tableNumber}
      </span>
      <span className="font-heading text-[3vh] font-bold uppercase tracking-wide text-white/80">
        {tournament ?? 'UZTT'}
        {stage ? ` · ${stage}` : ''}
      </span>
      {alert && (
        <span className="flex items-center gap-[0.6vw] rounded-[0.8vh] bg-broadcast-gold px-[1.5vw] py-[1vh] font-heading text-[3vh] font-extrabold uppercase tracking-wider text-broadcast-bg">
          <span className="size-[1.2vh] animate-pulse rounded-full bg-broadcast-bg" />
          {alert}
        </span>
      )}
      {live && (
        <span className="ml-auto flex items-center gap-[0.6vw] text-[3vh] font-extrabold uppercase text-broadcast-live">
          <span className="size-[1.4vh] animate-pulse rounded-full bg-broadcast-live" />
          JONLI
        </span>
      )}
      {waiting && (
        <span className="ml-auto text-[3vh] font-bold uppercase tracking-wide text-broadcast-muted">
          Boshlanishi kutilmoqda
        </span>
      )}
    </div>
  );
}
