'use client';

import { useEffect, useState } from 'react';
import type { MatchPayload } from '@/lib/socket';

function lastName(full: string) {
  const parts = full.trim().split(/\s+/);
  return (parts[parts.length - 1] ?? full).toUpperCase();
}

/**
 * TAYM-AUT (qoidalar 3.4.4.2) — uzoqdan ham yaqqol ko'rinadigan katta panel (TV va overlay uchun).
 * O'lchamlar ekran bo'yicha (vw/vh): 1920×1080 da sarlavha ≈105 px, hisoblagich ≈175 px.
 * Qolgan vaqt serverdan (`remainingMs`) olinadi — mijoz soati noto'g'ri bo'lsa ham to'g'ri ishlaydi.
 */
export function TimeoutAlert({
  match,
  compact = false,
  position = 'top',
}: {
  match: MatchPayload;
  compact?: boolean;
  /** TV da hisob qatorlarini yopmaslik uchun pastda */
  position?: 'top' | 'bottom';
}) {
  const to = match.timeout;
  const active = match.status !== 'FINISHED' ? to?.activePlayer ?? null : null;
  const remaining = to?.remainingMs ?? 0;
  const key = `${active}-${to?.activeUntil ?? ''}-${match.seq}`;
  // Har yangi holat (key) kelganda hisob `remaining` dan boshlanadi; oraliq qiymat faqat shu key uchun amal qiladi
  const [tick, setTick] = useState<{ key: string; left: number } | null>(null);

  useEffect(() => {
    if (!active) return;
    const receivedAt = Date.now();
    const id = setInterval(() => setTick({ key, left: Math.max(0, remaining - (Date.now() - receivedAt)) }), 200);
    return () => clearInterval(id);
  }, [key, active, remaining]);

  if (!active) return null;
  const left = tick && tick.key === key ? tick.left : remaining;
  if (left <= 0) return null;
  const secs = Math.ceil(left / 1000);
  const name = lastName(active === 1 ? match.player1Name : match.player2Name);
  const size = compact
    ? { title: 'text-[3.2vw]', name: 'text-[1.9vw]', count: 'text-[6vw]' }
    : { title: 'text-[5.4vw]', name: 'text-[2.6vw]', count: 'text-[9vw]' };

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 z-50 flex justify-center ${position === 'top' ? 'top-[12vh]' : 'bottom-[4vh]'}`}
      role="alert"
    >
      <div className="w-[62vw] overflow-hidden rounded-[1.4vw] border-[0.35vw] border-white bg-broadcast-gold shadow-[0_0_6vw_rgba(0,0,0,0.75)]">
        <div className="flex items-center justify-between gap-[3vw] px-[3vw] py-[2vh]">
          <div className="leading-none">
            <div className={`${size.title} font-black uppercase tracking-[0.06em] text-broadcast-bg`}>TAYM-AUT</div>
            <div className={`${size.name} mt-[1vh] font-extrabold uppercase tracking-wide text-broadcast-bg/80`}>{name}</div>
          </div>
          <div className={`${size.count} font-black tabular-nums leading-none text-broadcast-bg`}>{secs}</div>
        </div>
        <div className="h-[1.2vh] bg-broadcast-bg/25">
          <div className="h-full bg-broadcast-bg transition-[width] duration-200 ease-linear" style={{ width: `${(left / 60000) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
