'use client';

import { useEffect, useState } from 'react';

/** Raqamni `from` dan `to` gacha sanab chiqadi (easeOutCubic). `reduceMotion` bo'lsa darhol oxirgi qiymat. */
export function useCountUp(
  from: number,
  to: number,
  delayMs: number,
  durMs: number,
): number {
  const [v, setV] = useState(from);
  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || from === to) {
      setV(to);
      return;
    }
    let raf = 0;
    const t0 = performance.now() + delayMs;
    const tick = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - t0) / durMs));
      setV(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to, delayMs, durMs]);
  return v;
}
