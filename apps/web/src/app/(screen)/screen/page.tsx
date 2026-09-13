'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type AuthUser } from '@/lib/api';
import { subscribeToMatch, type MatchPayload } from '@/lib/socket';

/** Bitta stol kartochkasi — socket orqali jonli yangilanadi. */
function ScreenCard({ initial }: { initial: MatchPayload }) {
  const [match, setMatch] = useState<MatchPayload>(initial);

  useEffect(
    () =>
      subscribeToMatch(initial.id, (p) => {
        setMatch((prev) => (p.seq >= prev.seq ? p : prev));
      }),
    [initial.id],
  );

  const p1Cards = match.cards.filter((c) => c.player === 1);
  const p2Cards = match.cards.filter((c) => c.player === 2);

  return (
    <div className="rounded-card bg-broadcast-bg2 p-6 shadow-2xl">
      <div className="mb-4 text-center text-xs font-bold uppercase tracking-[0.2em] text-broadcast-gold">
        {match.tableNumber ? `Stol ${match.tableNumber}` : ''}
      </div>

      <div className="space-y-4">
        {(
          [
            [match.player1Name, match.player1SetsWon, match.currentSetP1, p1Cards],
            [match.player2Name, match.player2SetsWon, match.currentSetP2, p2Cards],
          ] as const
        ).map(([name, setsWon, current, cards], i) => (
          <div key={i} className="flex items-center justify-between gap-3 text-white">
            <span className="min-w-0 truncate text-lg font-semibold">
              {name}
              {cards.map((c, j) => (
                <span
                  key={j}
                  className={`ml-1.5 inline-block h-3.5 w-2.5 rounded-[2px] align-middle ${
                    c.type === 'YELLOW' ? 'bg-broadcast-gold' : 'bg-broadcast-live'
                  }`}
                />
              ))}
            </span>
            <span className="flex shrink-0 items-center gap-3 tabular-nums">
              <span className="font-heading text-4xl font-extrabold text-broadcast-gold">
                {current}
              </span>
              <span className="grid size-8 place-items-center rounded bg-white/15 text-sm font-extrabold">
                {setsWon}
              </span>
            </span>
          </div>
        ))}
      </div>

      {match.sets.length > 0 && (
        <div className="mt-4 text-center text-xs tabular-nums text-white/50">
          {match.sets.map((s) => `${s.p1Points}-${s.p2Points}`).join('  ·  ')}
        </div>
      )}
    </div>
  );
}

/**
 * Zal ekrani: barcha jonli o'yinlar bir sahifada.
 * `stream.view` permissioni talab qilinadi — ekran hisobi bilan kiriladi.
 */
export default function ScreenPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [checked, setChecked] = useState(false);
  const [matches, setMatches] = useState<MatchPayload[]>([]);

  useEffect(() => {
    api
      .get<{ user: AuthUser }>('/auth/me')
      .then(({ user }) => {
        if (!user.permissions.includes('stream.view')) throw new Error();
        setAllowed(true);
      })
      .catch(() => router.replace('/login'))
      .finally(() => setChecked(true));
  }, [router]);

  const load = useCallback(() => {
    api
      .get<MatchPayload[]>('/matches/live')
      .then(setMatches)
      .catch(() => setMatches([]));
  }, []);

  useEffect(() => {
    if (!allowed) return;
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [allowed, load]);

  if (!checked || !allowed) {
    return (
      <div className="grid min-h-screen place-items-center bg-broadcast-bg text-white/50">
        Yuklanmoqda...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-broadcast-bg px-6 py-10">
      <h1 className="mb-8 text-center font-heading text-2xl font-extrabold uppercase tracking-[0.2em] text-broadcast-gold">
        Jonli hisoblar
      </h1>
      {matches.length === 0 ? (
        <p className="text-center text-lg text-white/50">
          Hozircha jonli o&apos;yin yo&apos;q
        </p>
      ) : (
        <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-2">
          {matches.map((m) => (
            <ScreenCard key={m.id} initial={m} />
          ))}
        </div>
      )}
    </div>
  );
}
