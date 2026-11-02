'use client';

import { useState } from 'react';
import { photoThumbUrl } from '@/lib/photo';

/**
 * Kichik doira rasm. Kichik nusxa (≈4 KB) lazy yuklanadi; topilmasa asl rasm, u ham bo'lmasa bosh harflar.
 * Server yuklamasi: rasmlar statik fayl — nginx 30 kun keshlaydi.
 */
export function Avatar({
  photoUrl,
  firstName,
  lastName,
  size = 28,
  className = '',
}: {
  photoUrl?: string | null;
  firstName?: string;
  lastName?: string;
  size?: number;
  className?: string;
}) {
  const thumb = photoThumbUrl(photoUrl);
  const [src, setSrc] = useState<string | null>(thumb);
  const [failed, setFailed] = useState(false);
  const initials = `${lastName?.[0] ?? ''}${firstName?.[0] ?? ''}`.toUpperCase();
  const style = { width: size, height: size };
  if (!src || failed) {
    return (
      <span
        style={{ ...style, fontSize: Math.max(9, Math.round(size * 0.36)) }}
        className={`grid shrink-0 place-items-center rounded-full bg-navy-800 font-heading font-bold text-white ${className}`}
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
      className={`shrink-0 rounded-full bg-surface-alt object-cover ${className}`}
      onError={() => (src !== photoUrl && photoUrl ? setSrc(photoUrl) : setFailed(true))}
    />
  );
}
