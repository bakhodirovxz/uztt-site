'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';

interface SearchResults {
  players: Array<{ id: string; slug: string; firstName: string; lastName: string; region: string; rankingPoints: number }>;
  tournaments: Array<{ id: string; slug: string; name: string; city: string | null; status: string }>;
  news: Array<{ slug: string; title: string; excerpt: string | null }>;
}

const EMPTY: SearchResults = { players: [], tournaments: [], news: [] };

export default function SearchPage() {
  const t = useTranslations('searchPage');
  const locale = useLocale();
  const searchParams = useSearchParams();
  // Sarlavhadagi qidiruvdan kelgan so'rov darhol bajariladi
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  // Natija o'zi qaysi so'rovga tegishli ekanini eslab qoladi — shunda
  // eskirgan natijani effektda tozalash shart emas, render paytida chetlanadi
  const [data, setData] = useState<{ key: string; results: SearchResults } | null>(
    null,
  );

  const term = q.trim();
  const key = term.length < 2 ? '' : `${locale}:${term}`;

  // Debounce: yozish to'xtagach 300ms dan keyin qidiramiz
  useEffect(() => {
    if (!key) return;
    const timer = setTimeout(() => {
      api
        .get<SearchResults>(`/search?q=${encodeURIComponent(term)}&locale=${locale}`)
        .then((r) => setData({ key, results: r }))
        .catch(() => setData({ key, results: EMPTY }));
    }, 300);
    return () => clearTimeout(timer);
  }, [key, term, locale]);

  const fresh = key !== '' && data?.key === key;
  const results = fresh ? data.results : EMPTY;
  const searched = fresh;

  const total =
    results.players.length + results.tournaments.length + results.news.length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="font-heading text-3xl font-extrabold uppercase tracking-tight">
        {t('title')}
      </h1>

      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('placeholder')}
        className="mt-6 w-full rounded-card border border-border bg-surface-card px-5 py-4 text-lg shadow-card outline-none focus:border-accent-500"
      />
      {q.trim().length < 2 && (
        <p className="mt-3 text-sm text-muted">{t('hint')}</p>
      )}
      {searched && total === 0 && (
        <p className="mt-6 text-muted">{t('empty')}</p>
      )}

      {results.players.length > 0 && (
        <section className="mt-8">
          <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-muted">
            {t('players')}
          </h2>
          <div className="mt-2 space-y-2">
            {results.players.map((p) => (
              <Link
                key={p.id}
                href={{ pathname: '/players/[slug]', params: { slug: p.slug } }}
                className="flex items-center gap-3 rounded-card bg-surface-card px-4 py-3 shadow-card hover:shadow-card-hover"
              >
                <span className="font-semibold">{p.firstName} {p.lastName}</span>
                <span className="text-sm text-muted">{p.region}</span>
                <span className="ml-auto font-heading font-extrabold tabular-nums">{p.rankingPoints}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {results.tournaments.length > 0 && (
        <section className="mt-8">
          <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-muted">
            {t('tournaments')}
          </h2>
          <div className="mt-2 space-y-2">
            {results.tournaments.map((tr) => (
              <Link
                key={tr.id}
                href={{ pathname: '/events/[slug]', params: { slug: tr.slug } }}
                className="flex items-center gap-3 rounded-card bg-surface-card px-4 py-3 shadow-card hover:shadow-card-hover"
              >
                <span className="font-semibold">{tr.name}</span>
                <span className="text-sm text-muted">{tr.city}</span>
                <span className="ml-auto text-xs font-semibold text-muted">{tr.status}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {results.news.length > 0 && (
        <section className="mt-8">
          <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-muted">
            {t('news')}
          </h2>
          <div className="mt-2 space-y-2">
            {results.news.map((n) => (
              <Link
                key={n.slug}
                href={{ pathname: '/news/[slug]', params: { slug: n.slug } }}
                className="block rounded-card bg-surface-card px-4 py-3 shadow-card hover:shadow-card-hover"
              >
                <span className="font-semibold">{n.title}</span>
                {n.excerpt && (
                  <p className="mt-0.5 line-clamp-1 text-sm text-muted">{n.excerpt}</p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
