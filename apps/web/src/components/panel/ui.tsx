'use client';

import { useState, type ReactNode } from 'react';

/**
 * Panel uchun umumiy UI primitivlari.
 * Maqsad: har sahifada bir xil forma/holat/harakat tili — kam qaror, kam kod.
 */

export const inputClass =
  'w-full rounded-md border border-border bg-surface-raised px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted/70 focus:border-accent-500';

/** Sahifa sarlavhasi + o'ng tomonda asosiy harakat */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
      <div>
        <h1 className="font-heading text-2xl font-extrabold uppercase tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function Card({
  title,
  description,
  children,
  className = '',
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-card border border-border bg-surface-card p-5 shadow-card ${className}`}
    >
      {title && (
        <header className="mb-4">
          <h2 className="font-heading text-base font-bold">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs text-muted">{description}</p>
          )}
        </header>
      )}
      {children}
    </section>
  );
}

/** Yorliqli maydon — har input o'z nomi bilan (a11y + tushunarlilik) */
export function Field({
  label,
  hint,
  required,
  children,
  className = '',
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
        {label}
        {required && <span className="ml-1 text-accent-400">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

/*
 * Bu tonlar qorong'i mavzu davridan qolgan edi: `info` OQ sahifada
 * TO'Q KO'K quti chizardi (bg-court-900), `warn` esa och sariq fonda
 * och sariq matn berardi. Ikkalasi ham yorug' fonga moslandi.
 */
const ALERT_STYLES = {
  info: 'border-court-500/40 bg-court-100 text-court-800',
  success: 'border-win/40 bg-win/10 text-win',
  danger: 'border-accent-500/40 bg-accent-100 text-danger',
  warn: 'border-gold-500/40 bg-gold-100 text-gold-600',
} as const;

export function Alert({
  kind = 'info',
  children,
}: {
  kind?: keyof typeof ALERT_STYLES;
  children: ReactNode;
}) {
  if (!children) return null;
  return (
    <p
      role={kind === 'danger' ? 'alert' : 'status'}
      className={`rounded-md border px-3.5 py-2.5 text-sm font-medium ${ALERT_STYLES[kind]}`}
    >
      {children}
    </p>
  );
}

/** Bo'sh holat — nima yo'qligini va keyin nima qilishni aytadi */
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-card border border-dashed border-border px-6 py-10 text-center">
      <p className="font-heading font-bold">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const BUTTON_STYLES = {
  primary:
    'bg-accent-600 text-white hover:bg-accent-500 disabled:opacity-50',
  secondary:
    'border border-border bg-surface-raised text-ink hover:border-accent-500 disabled:opacity-50',
  ghost: 'text-muted hover:bg-surface-raised hover:text-ink disabled:opacity-50',
  danger:
    'border border-accent-500/40 text-danger hover:bg-accent-100 disabled:opacity-50',
} as const;

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON_STYLES;
  size?: 'sm' | 'md';
}) {
  const sizing = size === 'sm' ? 'min-h-8 px-3 text-xs' : 'min-h-10 px-4 text-sm';
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md font-semibold transition-colors ${sizing} ${BUTTON_STYLES[variant]} ${className}`}
    />
  );
}

/**
 * Ikki qadamli o'chirish: birinchi bosishda "Tasdiqlang?" ga aylanadi.
 * window.confirm o'rniga — kontekstni yo'qotmaydi va tasodifiy bosishdan saqlaydi.
 */
export function ConfirmButton({
  onConfirm,
  label = "O'chirish",
  confirmLabel = 'Tasdiqlang',
  size = 'sm',
}: {
  onConfirm: () => void | Promise<void>;
  label?: string;
  confirmLabel?: string;
  size?: 'sm' | 'md';
}) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <Button variant="ghost" size={size} onClick={() => setArmed(true)}>
        {label}
      </Button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <Button
        variant="danger"
        size={size}
        onClick={async () => {
          setArmed(false);
          await onConfirm();
        }}
      >
        {confirmLabel}
      </Button>
      <Button variant="ghost" size={size} onClick={() => setArmed(false)}>
        Bekor
      </Button>
    </span>
  );
}

/** Ro'yxat qatori — barcha CRUD ro'yxatlarida bir xil ko'rinish */
export function Row({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface-card px-4 py-3 transition-colors hover:border-border-strong ${className}`}
    >
      {children}
    </div>
  );
}

// Fonlar shaffof emas — matn kontrasti fon qatlamiga bog'liq bo'lib qolmasin
const BADGE_STYLES = {
  neutral: 'bg-surface-raised text-muted',
  live: 'bg-accent-700 text-white',
  success: 'bg-win/15 text-win',
  warn: 'bg-gold-600 text-navy-950',
  court: 'bg-navy-900 text-accent-500',
} as const;

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: keyof typeof BADGE_STYLES;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${BADGE_STYLES[tone]}`}
    >
      {children}
    </span>
  );
}
