'use client';

import { useState } from 'react';
import { photoThumbUrl } from '@/lib/photo';

/**
 * Rang to'plami: `site` — sayt tokenlari; `broadcast` — faqat --color-broadcast-* (/screen va /overlay uchun,
 * CLAUDE.md: efir sahifalari sayt tokenlarini ishlatmaydi).
 */
const TONE = {
  site: { fallback: 'bg-navy-800 text-white', img: 'bg-surface-alt' },
  broadcast: { fallback: 'bg-broadcast-bg3 text-white', img: 'bg-broadcast-bg2' },
} as const;

/**
 * Kichik doira rasm. Kichik nusxa (≈4 KB) lazy yuklanadi; topilmasa asl rasm, u ham bo'lmasa bosh harflar.
 * Server yuklamasi: rasmlar statik fayl — nginx 30 kun keshlaydi.
 * Holat `photoUrl` ga bog'langan: prop o'zgarsa (masalan, setkada o'yinchi almashsa) rasm qaytadan tanlanadi.
 */
export function Avatar({
  photoUrl,
  firstName,
  lastName,
  size = 28,
  className = '',
  tone = 'site',
}: {
  photoUrl?: string | null;
  firstName?: string;
  lastName?: string;
  size?: number;
  className?: string;
  tone?: keyof typeof TONE;
}) {
  // stage: 0 — kichik nusxa, 1 — asl rasm, 2 — ikkalasi ham yuklanmadi
  const [failure, setFailure] = useState<{ url: string | null | undefined; stage: 0 | 1 | 2 }>({ url: photoUrl, stage: 0 });
  const stage = failure.url === photoUrl ? failure.stage : 0;
  const thumb = photoThumbUrl(photoUrl);
  const hasOriginal = !!photoUrl && photoUrl !== thumb;
  const src = stage === 0 ? thumb : stage === 1 && hasOriginal ? photoUrl : null;
  const colors = TONE[tone];
  const initials = `${lastName?.[0] ?? ''}${firstName?.[0] ?? ''}`.toUpperCase();
  const style = { width: size, height: size };
  if (!src) {
    return (
      <span
        style={{ ...style, fontSize: Math.max(9, Math.round(size * 0.36)) }}
        className={`grid shrink-0 place-items-center rounded-full font-heading font-bold ${colors.fallback} ${className}`}
        aria-hidden
      >
        {initials}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- kichik avatar: next/image ortiqcha yuk
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      style={style}
      className={`shrink-0 rounded-full object-cover ${colors.img} ${className}`}
      onError={() => setFailure({ url: photoUrl, stage: stage === 0 && hasOriginal ? 1 : 2 })}
    />
  );
}
