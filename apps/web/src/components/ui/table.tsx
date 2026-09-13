/**
 * Ma'lumot jadvali qobig'i — WTT o'lchovlari bo'yicha.
 *
 * O'lchangan (worldtabletennis.com/rankings):
 *   sarlavha katagi : 11.7px / 700 / rgb(68,68,68)
 *   qator balandligi: 55-57px, pastki chegara 1px #ddd
 *   qator urg'usi   : rgba(232,105,34,0.18)   (--c-row-highlight-color)
 *   o'yinchi rasmi  : 35x35, doira
 *   bayroq          : 23x18, radius 2px
 *
 * Faqat QOBIQ shu yerda. SinglesTable/PartnershipTable/TeamTable kabi
 * jadvallar domen mantiqi — ular o'z sahifasida qoladi.
 */
import type { ReactNode } from 'react';

export function DataTable({
  head,
  children,
  className = '',
}: {
  head: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    // Keng jadval sahifani gorizontal scrollga majburlamasin —
    // o'z konteyneri ichida aylansin.
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr className="border-b border-border-strong">{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Th({
  children,
  align = 'left',
  className = '',
}: {
  children?: ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  const a = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <th
      scope="col"
      className={`px-3 py-2.5 font-heading text-[11px] font-bold uppercase tracking-wider text-[#444] ${a} ${className}`}
    >
      {children}
    </th>
  );
}

export function Tr({
  children,
  highlight = false,
}: {
  children: ReactNode;
  highlight?: boolean;
}) {
  return (
    <tr
      className={`border-b border-border transition-colors hover:bg-[rgba(232,105,34,0.18)] ${
        highlight ? 'bg-[rgba(232,105,34,0.18)]' : ''
      }`}
    >
      {children}
    </tr>
  );
}

export function Td({
  children,
  align = 'left',
  className = '',
}: {
  children?: ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  const a = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return <td className={`px-3 py-2.5 ${a} ${className}`}>{children}</td>;
}

/**
 * Jadval ichidagi o'yinchi katagi: 35x35 doira rasm + ism.
 * Rasm bo'lmasa — bosh harflardan doira (WTT ham shunday qiladi).
 */
export function PlayerCell({
  photoUrl,
  firstName,
  lastName,
  sub,
}: {
  photoUrl?: string | null;
  firstName: string;
  lastName: string;
  /** Klub yoki viloyat kabi ikkinchi darajali matn */
  sub?: ReactNode;
}) {
  const initials = `${lastName?.[0] ?? ''}${firstName?.[0] ?? ''}`.toUpperCase();
  return (
    <span className="flex min-w-0 items-center gap-3">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- jadvalda
        // 35px avatar uchun next/image optimizatsiyasi ortiqcha yuk beradi
        <img
          src={photoUrl}
          alt=""
          width={35}
          height={35}
          loading="lazy"
          className="size-[35px] shrink-0 rounded-full bg-surface-alt object-cover"
        />
      ) : (
        <span className="grid size-[35px] shrink-0 place-items-center rounded-full bg-navy-800 font-heading text-[11px] font-bold text-white">
          {initials}
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate font-medium text-ink">
          {/* WTT familiyani BOSH HARFLAR bilan beradi */}
          <span className="uppercase">{lastName}</span> {firstName}
        </span>
        {sub ? <span className="block truncate text-xs text-muted">{sub}</span> : null}
      </span>
    </span>
  );
}
