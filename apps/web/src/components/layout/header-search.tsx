'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';

interface PlayerHit {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  region: string;
  rankingPoints: number;
}

/**
 * Sarlavhadagi qidiruv: ikonka bosilganda maydon ochiladi, 2 harfdan keyin
 * o'yinchilar taklifi chiqadi (pg_trgm — xato yozilgan harflarga chidamli).
 * Enter — to'liq qidiruv sahifasiga o'tadi.
 */
export function HeaderSearch() {
  const t = useTranslations('searchPage');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<PlayerHit[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const query = q.trim();

  useEffect(() => {
    if (query.length < 2) return;
    const timer = setTimeout(() => {
      api
        .get<{ players: PlayerHit[] }>(
          `/search/typeahead?q=${encodeURIComponent(query)}`,
        )
        .then((r) => setHits(r.players))
        .catch(() => setHits([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  // Qidiruv qisqarganda eski takliflar ko'rinmasin (state'ni effektda tozalamaymiz)
  const suggestions = query.length >= 2 ? hits : [];

  function submit() {
    if (query.length < 2) return;
    setOpen(false);
    router.push({ pathname: '/search', query: { q: query } });
  }

  return (
    <div ref={boxRef} className="relative">
      {open ? (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder={t('placeholder')}
            aria-label={t('title')}
            aria-controls="header-search-suggestions"
            className="h-9 w-44 rounded-md border border-border-strong bg-surface-alt px-3 text-sm text-ink outline-none placeholder:text-muted focus:border-navy-600 sm:w-64"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t('close')}
            className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-alt hover:text-ink"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('title')}
          className="grid size-9 place-items-center rounded-full text-ink/70 transition-colors hover:bg-surface-alt hover:text-ink"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.5" y2="16.5" />
          </svg>
        </button>
      )}

      {open && suggestions.length > 0 && (
        <ul id="header-search-suggestions" className="absolute right-0 top-11 z-50 w-72 overflow-hidden rounded-card border border-border bg-surface-card shadow-card">
          {suggestions.map((p) => (
            <li key={p.id}>
              <Link
                href={{ pathname: '/players/[slug]', params: { slug: p.slug } }}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-surface-raised"
              >
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {p.lastName} {p.firstName}
                </span>
                <span className="text-xs text-muted">{p.region}</span>
                <span className="font-heading font-bold tabular-nums">
                  {p.rankingPoints}
                </span>
              </Link>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={submit}
              className="w-full border-t border-border px-4 py-2.5 text-left text-sm font-semibold text-accent-500 hover:bg-surface-raised"
            >
              {t('allResults')}
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
