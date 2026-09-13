/**
 * Filtr va navigatsiya primitivlari.
 *
 * Bular ilgari `rankings/page.tsx` (700 qator) ichida lokal funksiya bo'lib
 * qamalgan edi — boshqa sahifalar ulardan foydalana olmasdi va har biri
 * o'z filtr tilini qayta ixtiro qilardi. O'lchovlar WTT'dan.
 */
import type { ReactNode } from 'react';

/**
 * Bo'lim tablari — WTT uslubi: pastida 4px chegara, faol holatda to'q sariq.
 * O'lchangan: 15.6px/600, padding 5px 10px, border-bottom 4px #ff6b00.
 */
export function TabBar({
  items,
  className = '',
}: {
  items: Array<{ key: string; label: ReactNode; href: string; active: boolean }>;
  className?: string;
}) {
  return (
    <nav
      className={`flex flex-wrap items-center gap-x-1 border-b border-border ${className}`}
    >
      {items.map((it) => (
        <a
          key={it.key}
          href={it.href}
          aria-current={it.active ? 'page' : undefined}
          className={`-mb-px border-b-4 px-3 py-2.5 font-heading text-sm font-semibold uppercase tracking-wide transition-colors ${
            it.active
              ? 'border-accent-500 text-ink'
              : 'border-transparent text-muted hover:border-border-strong hover:text-ink'
          }`}
        >
          {it.label}
        </a>
      ))}
    </nav>
  );
}

/**
 * Filtr pilli. WTT tig'iz burchak ishlatadi (radius 2px), faol holat —
 * qora plashka. Ilgari faol rang navy edi va uchta sahifada uch xil edi.
 */
export function chipClass(active: boolean): string {
  return `inline-flex min-h-9 items-center rounded-card border px-3.5 text-[13px] font-semibold transition-colors ${
    active
      ? 'border-navy-950 bg-navy-950 text-white'
      : 'border-border-strong bg-surface-card text-ink hover:border-accent-500 hover:text-accent-500'
  }`;
}

export function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <a href={href} aria-current={active ? 'true' : undefined} className={chipClass(active)}>
      {children}
    </a>
  );
}

/** Bir qatorga tizilgan filtr pillari + ixtiyoriy yorliq */
export function ChipGroup({
  label,
  children,
  className = '',
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {label ? (
        <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-muted">
          {label}
        </span>
      ) : null}
      {children}
    </div>
  );
}

/**
 * Reyting o'zgarishi: ▲ yashil ko'tarildi, ▼ qizil tushdi, — o'zgarmadi.
 * "YANGI" ilgari to'q ko'k plashka edi va jadvalda haddan tashqari
 * ko'zga tashlanardi — endi sokin kulrang yorliq.
 */
export function Movement({
  movement,
  isNew,
  newLabel = 'NEW',
}: {
  movement: number | null;
  isNew?: boolean;
  newLabel?: string;
}) {
  if (isNew) {
    return (
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
        {newLabel}
      </span>
    );
  }
  if (movement === null || movement === 0) {
    return <span className="text-muted">—</span>;
  }
  const up = movement > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-bold tabular-nums ${
        up ? 'text-win' : 'text-danger'
      }`}
    >
      {up ? '▲' : '▼'}
      {Math.abs(movement)}
    </span>
  );
}

/**
 * Reyting o'rni. WTT raqamni TO'Q SARIQ va 700 og'irlikda beradi
 * (o'lchangan: 15.6px/700 rgb(255,107,0)); podium uchun medal rangi.
 */
export function RankNumber({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="grid size-7 place-items-center rounded-full bg-gold-500 font-heading text-xs font-extrabold text-navy-950">
        1
      </span>
    );
  }
  if (rank === 2 || rank === 3) {
    return (
      <span className="grid size-7 place-items-center rounded-full bg-navy-800 font-heading text-xs font-extrabold text-white">
        {rank}
      </span>
    );
  }
  return (
    <span className="font-heading text-[15px] font-bold tabular-nums text-accent-500">
      {rank}
    </span>
  );
}

/**
 * Sahifalash: 1 2 3 … 27 28 29 … 54 55 — joriy sahifa atrofi va
 * boshi/oxiri ko'rinadi, orasi "…" bilan qisqaradi.
 */
export function Pagination({
  page,
  totalPages,
  hrefFor,
  total,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
  /** Jami yozuvlar soni (ixtiyoriy, o'ngda ko'rsatiladi) */
  total?: number;
}) {
  if (totalPages <= 1) return null;

  const keep = new Set<number>([1, totalPages]);
  for (let p = page - 1; p <= page + 1; p++) {
    if (p >= 1 && p <= totalPages) keep.add(p);
  }
  const sorted = [...keep].sort((a, b) => a - b);

  const items: Array<number | 'gap'> = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) items.push('gap');
    items.push(p);
    prev = p;
  }

  const box =
    'inline-flex min-h-9 min-w-9 items-center justify-center rounded-card border px-3 text-[13px] font-semibold transition-colors';

  return (
    <nav className="mt-8 flex flex-wrap items-center justify-center gap-2">
      <a
        href={hrefFor(Math.max(1, page - 1))}
        aria-label="Oldingi"
        className={`${box} ${
          page <= 1
            ? 'pointer-events-none border-border text-muted opacity-40'
            : 'border-border-strong hover:border-accent-500 hover:text-accent-500'
        }`}
      >
        ‹
      </a>
      {items.map((it, i) =>
        it === 'gap' ? (
          <span key={`gap-${i}`} className="px-1 text-muted">
            …
          </span>
        ) : (
          <a
            key={it}
            href={hrefFor(it)}
            aria-current={it === page ? 'page' : undefined}
            className={`${box} ${
              it === page
                ? 'border-navy-950 bg-navy-950 text-white'
                : 'border-border-strong hover:border-accent-500 hover:text-accent-500'
            }`}
          >
            {it}
          </a>
        ),
      )}
      <a
        href={hrefFor(Math.min(totalPages, page + 1))}
        aria-label="Keyingi"
        className={`${box} ${
          page >= totalPages
            ? 'pointer-events-none border-border text-muted opacity-40'
            : 'border-border-strong hover:border-accent-500 hover:text-accent-500'
        }`}
      >
        ›
      </a>
      {typeof total === 'number' ? (
        <span className="ml-2 text-xs tabular-nums text-muted">{total}</span>
      ) : null}
    </nav>
  );
}
