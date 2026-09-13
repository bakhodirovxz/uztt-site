'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { subscribeToMatches, type MatchPayload } from '@/lib/socket';

/**
 * Jonli hisoblar tickeri (WTT-uslub): qora panelda oq mini-kartalar,
 * gorizontal scroll, socket orqali real vaqtda yangilanadi.
 *
 * `data-live` atributi: e2e/visual/site.spec.ts shu selektorni maskalaydi,
 * lekin u komponentda MAVJUD EMAS edi — ya'ni maskalash ishlamay, har
 * baseline'ga o'zgaruvchan jonli hisob muhrlanardi.
 */
export function LiveTicker({ initial = [] }: { initial?: MatchPayload[] }) {
  const t = useTranslations('match');
  // Boshlang'ich ro'yxat serverdan keladi — lenta birinchi chizishdayoq to'la
  // bo'ladi (LCP kutmaydi) va kontent kechikib qo'shilib layoutni surmaydi.
  const [matches, setMatches] = useState<MatchPayload[]>(initial);

  useEffect(() => {
    let active = true;
    const load = () =>
      api
        .get<MatchPayload[]>('/matches/live')
        .then((ms) => active && setMatches(ms))
        .catch(() => {});
    // Server ma'lumoti bor bo'lsa darhol qayta so'ramaymiz — 30 soniyada yangilanadi
    if (initial.length === 0) load();
    const interval = setInterval(load, 30_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [initial.length]);

  // Jonli yangilanish: o'yin xonalariga obuna (socket dinamik yuklanadi)
  const matchIds = matches.map((m) => m.id).join(',');
  useEffect(() => {
    if (!matchIds) return;
    return subscribeToMatches(matchIds.split(','), (p) =>
      setMatches((prev) =>
        prev.map((m) => (m.id === p.id && p.seq >= m.seq ? p : m)),
      ),
    );
  }, [matchIds]);

  if (matches.length === 0) return null;

  return (
    <div data-live className="border-b border-white/10 bg-navy-950">
      <div className="rail mx-auto max-w-site px-4 py-2.5">
        {matches.map((m) => (
          <Link
            key={m.id}
            href={{ pathname: '/live/[id]', params: { id: m.id } }}
            className="w-64 rounded-md bg-white p-2.5 text-navy-900 shadow-card"
          >
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-navy-600">
              <span className="truncate">
                {m.tournament?.name ?? ''} · {t(`stage_${m.stage}`)}
              </span>
              <span className="ml-2 flex shrink-0 items-center gap-1 text-accent-700">
                <span className="size-1.5 animate-pulse rounded-full bg-live" />
                {t('live')}
              </span>
            </div>
            {(
              [
                [m.player1Name, m.player1SetsWon, m.currentSetP1],
                [m.player2Name, m.player2SetsWon, m.currentSetP2],
              ] as const
            ).map(([name, sets, pts], i) => (
              <div key={i} className="mt-1 flex items-center gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate font-semibold">{name}</span>
                <span className="font-heading font-extrabold text-accent-700 tabular-nums">
                  {sets}
                </span>
                <span className="w-6 text-right font-bold tabular-nums text-navy-600">
                  {pts}
                </span>
              </div>
            ))}
          </Link>
        ))}
      </div>
    </div>
  );
}
