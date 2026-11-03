'use client';

import { useState } from 'react';

/**
 * YouTube pleyeri faqat bosilganda yuklanadi. Oldin 26 ta iframe sahifani 28 MB ga
 * yetkazardi; muqova rasmi esa bir necha o'n KB.
 */
export function YoutubeLite({ id, title }: { id: string; title: string }) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="h-full w-full"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={title}
      className="group relative block h-full w-full overflow-hidden bg-navy-900"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- tashqi muqova, next/image optimizatoridan o'tkazilmaydi */}
      <img
        src={`https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
      <span className="absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/70 text-2xl text-white transition-transform group-hover:scale-110">
        ▶
      </span>
    </button>
  );
}
