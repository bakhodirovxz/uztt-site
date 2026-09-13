'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { MatchCard } from '@/components/match/match-card';
import type { MatchPayload } from '@/lib/socket';

export default function LivePage() {
  const t = useTranslations('nav');
  const tm = useTranslations('match');
  const tc = useTranslations('common');
  const [matches, setMatches] = useState<MatchPayload[] | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      api
        .get<MatchPayload[]>('/matches/live')
        .then((m) => active && setMatches(m))
        .catch(() => active && setMatches([]));
    load();
    // Yangi jonli o'yinlar paydo bo'lishini davriy tekshiramiz
    const interval = setInterval(load, 30_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="mx-auto max-w-site px-4 py-12">
      <h1 className="flex items-center gap-3 font-heading text-3xl font-extrabold uppercase tracking-tight">
        <span className="inline-block size-3 animate-pulse rounded-full bg-live" />
        {t('live')}
      </h1>

      {matches === null ? (
        <p className="mt-6 text-muted">{tc('loading')}</p>
      ) : matches.length === 0 ? (
        <p className="mt-6 text-muted">{tm('noLive')}</p>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((m) => (
            <MatchCard key={m.id} initial={m} />
          ))}
        </div>
      )}
    </div>
  );
}
