'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { subscribeToMatch, type MatchPayload } from '@/lib/socket';
import { OverlayView } from '@/components/match/overlay-view';
import { ShowcaseLayer } from '@/components/showcase/showcase-layer';
import { OverlayAds } from '@/components/showcase/overlay-ads';

/**
 * Stolga biriktirilgan overlay: token emas, stol raqami bo'yicha.
 * O'yin tugagach 6 soniyadan keyin shu stoldagi keyingi o'yinga o'tadi —
 * OBS sahnasini almashtirmasdan butun kun ishlatish uchun.
 */
export function OverlayTableClient({ tableNumber }: { tableNumber: number }) {
  const [match, setMatch] = useState<MatchPayload | null>(null);

  const load = useCallback(() => {
    api
      .get<MatchPayload>(`/matches/table/${tableNumber}/current`)
      .then(setMatch)
      .catch(() => setMatch(null));
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
      if (p.status === 'FINISHED') setTimeout(load, 6_000);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.id]);

  // Bo'sh vaqt: stolda o'yin yo'q yoki hakam hali kirmagan (kod tasdiqlanmagan) — reklama
  const idle = !match || (match.status === 'SCHEDULED' && !match.refereeVerified);

  return (
    <>
      {match && <OverlayView match={match} />}
      <OverlayAds table={tableNumber} idle={idle} />
      <ShowcaseLayer match={match} variant="overlay" />
    </>
  );
}
