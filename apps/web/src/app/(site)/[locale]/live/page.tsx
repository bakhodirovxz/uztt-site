'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { Container, PageTitleBar } from '@/components/ui';
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
    <>
      <PageTitleBar title={t('live')}>
        <span className="inline-block size-3 animate-pulse rounded-full bg-live" />
      </PageTitleBar>
      <Container className="py-8">

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
      </Container>
    </>
  );
}
