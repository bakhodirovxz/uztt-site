'use client';

import { useCallback, useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Photo {
  id: string;
  url: string;
  thumbUrl: string | null;
  credit: string | null;
}

const abs = (u: string) => (u.startsWith('http') ? u : API_BASE + u);

/** Oddiy lightbox: grid → to'liq ekran, ←/→/Esc klaviatura bilan */
export function Lightbox({ photos }: { photos: Photo[] }) {
  const [index, setIndex] = useState<number | null>(null);

  const close = useCallback(() => setIndex(null), []);
  const step = useCallback(
    (d: number) => {
      setIndex((i) =>
        i === null ? null : (i + d + photos.length) % photos.length,
      );
    },
    [photos.length],
  );

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, close, step]);

  if (photos.length === 0) {
    return <p className="mt-6 text-muted">—</p>;
  }

  return (
    <>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {photos.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setIndex(i)}
            className="group aspect-square overflow-hidden rounded-card bg-navy-800"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={abs(p.thumbUrl ?? p.url)}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {index !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/95 p-4"
          onClick={close}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); step(-1); }}
            className="absolute left-4 grid size-11 place-items-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20"
            aria-label="Oldingi"
          >
            ‹
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={abs(photos[index].url)}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] max-w-full rounded-card object-contain"
          />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); step(1); }}
            className="absolute right-4 grid size-11 place-items-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20"
            aria-label="Keyingi"
          >
            ›
          </button>
          <button
            type="button"
            onClick={close}
            className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Yopish"
          >
            ✕
          </button>
          {photos[index].credit && (
            <span className="absolute bottom-4 text-xs text-white/60">
              © {photos[index].credit}
            </span>
          )}
        </div>
      )}
    </>
  );
}
