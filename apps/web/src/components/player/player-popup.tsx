'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';

interface Detail {
  slug: string;
  firstName: string;
  lastName: string;
  gender: 'MALE' | 'FEMALE';
  region: string;
  club: string | null;
  rankingPoints: number;
  photoUrl: string | null;
  ageCategory: { code: string; name: string } | null;
  age?: number | null;
  rank: number | null;
}

/**
 * O'yinchi kartochkasi — alohida sahifa ochilmaydi, uttf.uz dagidek oyna (popup) chiqadi.
 * Ma'lumot bosilganda bir marta olinadi (ro'yxatni oldindan og'irlashtirmaslik uchun).
 * Esc, fon yoki ✕ bilan yopiladi; fokus oynaga o'tadi va yopilganda qaytadi.
 */
export function PlayerPopupLink({
  slug,
  className,
  children,
  onClick,
}: {
  slug: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => {
    setOpen(false);
    trigger.current?.focus();
  }, []);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={`w-full cursor-pointer text-left ${className ?? ''}`}
        aria-haspopup="dialog"
        onClick={() => {
          onClick?.();
          setOpen(true);
        }}
      >
        {children}
      </button>
      {open && <PlayerDialog slug={slug} onClose={close} />}
    </>
  );
}

function PlayerDialog({ slug, onClose }: { slug: string; onClose: () => void }) {
  const t = useTranslations('playerPopup');
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState(false);
  const [broken, setBroken] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    api
      .get<Detail>(`/players/${encodeURIComponent(slug)}`)
      .then((d) => alive && setData(d))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [slug]);

  useEffect(() => {
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const initials = data ? `${data.lastName[0] ?? ''}${data.firstName[0] ?? ''}`.toUpperCase() : '';
  return createPortal(
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label={data ? `${data.lastName} ${data.firstName}` : t('loading')}
        tabIndex={-1}
        className="relative grid w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-2xl outline-none sm:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full text-2xl leading-none text-ink/60 hover:bg-black/5 hover:text-ink"
        >
          ×
        </button>

        <div className="flex min-h-64 items-end justify-center bg-gradient-to-br from-slate-100 to-slate-300 sm:min-h-[22rem]">
          {data?.photoUrl && !broken ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.photoUrl} alt="" onError={() => setBroken(true)} className="max-h-[26rem] w-full object-contain object-bottom" />
          ) : (
            <span className="mb-10 grid size-32 place-items-center rounded-full bg-navy-800 font-heading text-4xl font-bold text-white">
              {initials || '…'}
            </span>
          )}
        </div>

        <div className="flex flex-col justify-center gap-6 p-7 sm:p-10">
          {error ? (
            <p className="text-sm text-muted">{t('error')}</p>
          ) : !data ? (
            <p className="text-sm text-muted">{t('loading')}</p>
          ) : (
            <>
              <h2 className="font-heading text-2xl font-extrabold leading-tight text-navy-800 sm:text-3xl">
                {data.lastName} {data.firstName}
              </h2>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
                <Item label={t('rank')} value={data.rank ? t('place', { n: data.rank }) : '—'} />
                <Item label={t('points')} value={String(data.rankingPoints)} />
                <Item label={t('gender')} value={data.gender === 'MALE' ? t('male') : t('female')} />
                <Item label={t('age')} value={[data.age ? String(data.age) : null, data.ageCategory?.name].filter(Boolean).join(' · ') || '—'} />
                <Item label={t('region')} value={data.region} />
                <Item label={t('club')} value={data.club ?? '—'} />
              </dl>
              <Link
                href={{ pathname: '/players/[slug]', params: { slug } }}
                className="inline-flex min-h-11 w-fit items-center rounded-md bg-accent-600 px-5 text-sm font-semibold text-white hover:bg-accent-500"
              >
                {t('fullProfile')} →
              </Link>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-sky-600">{label}:</dt>
      <dd className="mt-0.5 break-words text-lg font-bold text-navy-900">{value}</dd>
    </div>
  );
}
