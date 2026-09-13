/**
 * Sayt bo'ylab takrorlanadigan tuzilma primitivlari.
 *
 * Barcha o'lchovlar worldtabletennis.com dan olingan (tools/visual-parity).
 * Ilgari bu naqshlar 30+ joyda inline Tailwind satri bo'lib takrorlanardi,
 * shuning uchun ular bir-biridan asta-sekin uzoqlashib ketgan edi (masalan
 * uchta xil "asosiy tugma" rangi paydo bo'lgan).
 */
import type { ReactNode } from 'react';

/** Sahifa konteyneri — WTT ~1382px */
export function Container({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'main' | 'nav';
}) {
  return <Tag className={`mx-auto max-w-site px-4 ${className}`}>{children}</Tag>;
}

/**
 * Qora sahifa sarlavha paneli — WTT'da har bo'lim shu bilan boshlanadi.
 * O'lchangan: balandlik 60px, fon #000, matn oq, padding 7px 19.5px.
 */
export function PageTitleBar({
  title,
  meta,
  children,
}: {
  title: string;
  /** O'ngdagi qo'shimcha matn (masalan "oxirgi yangilanish") */
  meta?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="bg-navy-950 text-white">
      <Container className="flex min-h-[60px] flex-wrap items-center justify-between gap-x-6 gap-y-2 py-2">
        <h1 className="font-heading text-lg font-extrabold uppercase tracking-wide md:text-xl">
          {title}
        </h1>
        {meta ? <span className="text-xs text-white/60">{meta}</span> : null}
        {children}
      </Container>
    </div>
  );
}

/**
 * Bo'lim sarlavhasi (eyebrow + H2 + "barchasi" havolasi).
 * Ilgari bosh sahifa faylining ichida qamalgan edi.
 */
export function SectionHead({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h2 className="mt-2 font-heading text-2xl font-extrabold uppercase tracking-tight">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

/**
 * Gradientli sarlavhali karta — WTT reyting sahifasidagi
 * "TOP RANKED PLAYERS" bloklari. O'lchangan: sarlavha 65px.
 */
export function GradientCard({
  tone,
  title,
  subtitle,
  children,
}: {
  tone: 'men' | 'women' | 'brand' | 'teams';
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const grad = {
    men: 'grad-men',
    women: 'grad-women',
    brand: 'grad-brand',
    teams: 'grad-teams',
  }[tone];
  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface-card shadow-card">
      <div className={`${grad} flex min-h-[52px] items-center gap-2 px-4 py-3 text-white`}>
        <span className="font-heading text-lg font-extrabold">{title}</span>
        {subtitle ? (
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/80">
            {subtitle}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}
