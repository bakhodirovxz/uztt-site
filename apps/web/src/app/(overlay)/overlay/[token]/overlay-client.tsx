'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { subscribeToMatch, type MatchPayload } from '@/lib/socket';
import { OverlayView } from '@/components/match/overlay-view';

export function OverlayClient({ token }: { token: string }) {
  const [match, setMatch] = useState<MatchPayload | null>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let active = true;
    api
      .get<MatchPayload>(`/matches/overlay/${token}`)
      .then((m) => {
        if (!active) return;
        setMatch(m);
        cleanup = subscribeToMatch(m.id, (p) => {
          setMatch((prev) => (prev && p.seq >= prev.seq ? p : prev));
        });
      })
      .catch(() => setMatch(null));
    return () => {
      active = false;
      cleanup?.();
    };
  }, [token]);

  if (!match) return null;

  return <OverlayView match={match} />;
}
