'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { SITE_CONTACT } from '@/lib/site-config';
import { LocaleSwitcher } from './locale-switcher';
import { HeaderSearch } from './header-search';

type NavPath = '/events' | '/live' | '/rankings' | '/players' | '/news';

const NAV_ITEMS: Array<{ href: NavPath; key: string }> = [
  { href: '/events', key: 'events' },
  { href: '/live', key: 'live' },
  { href: '/rankings', key: 'rankings' },
  { href: '/players', key: 'players' },
  { href: '/news', key: 'news' },
];

export function SiteHeader() {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Kirgan foydalanuvchiga "Kirish" emas, "Kabinet" ko'rsatiladi
  const [authed, setAuthed] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    api
      .get('/auth/me')
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false));
  }, [pathname]);

  // Sahifa almashganda menyu ochiq qolib ketmasin
  useEffect(() => setOpen(false), [pathname]);

  /*
   * Mobil menyu: Escape, sahifa scroll'ini qulflash va fokus tutqichi.
   * Uchalasi ham yo'q edi — menyu ochiq turganda orqadagi sahifa
   * aylanaverardi va Tab fokusi menyudan tashqariga chiqib ketardi.
   */
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        burgerRef.current?.focus();
        return;
      }
      if (e.key !== 'Tab' || !menuRef.current) return;
      const items = menuRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select',
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  /*
   * Faol bo'lim. Ilgari `pathname === item.href` edi — ya'ni
   * /yangiliklar/<slug> ochilganda NEWS bo'limi hech qachon yonmasdi.
   * next-intl `usePathname()` ichki (lokalizatsiyalanmagan) yo'lni
   * qaytaradi, shuning uchun segment bo'yicha solishtiramiz.
   */
  const isActive = useCallback(
    (href: string) => pathname === href || pathname.startsWith(href + '/'),
    [pathname],
  );

  const ctaHref = authed ? ('/panel' as const) : ('/login' as const);
  const ctaLabel = authed ? t('panel') : t('login');

  return (
    <header className="sticky top-0 z-50 bg-navy-950 text-white">
      {/* Yuqori qator — logo, tashkilot nomi, aloqa, til, kirish */}
      <div className="mx-auto flex h-[76px] max-w-site items-center gap-4 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-3">
          <Image
            src="/uttf-logo.png"
            alt={tc('siteName')}
            width={48}
            height={48}
            className="size-12 shrink-0"
            priority
          />
          <span className="hidden font-heading text-[15px] font-extrabold uppercase leading-tight tracking-wide text-white sm:block">
            {tc('siteName')}
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-5">
          <a
            href={SITE_CONTACT.phoneHref}
            className="hidden flex-col items-end text-right leading-tight lg:flex"
          >
            <span className="font-heading text-[15px] font-bold text-white">
              {SITE_CONTACT.phone}
            </span>
            <span className="text-xs text-white/60">{SITE_CONTACT.email}</span>
          </a>

          <LocaleSwitcher />

          <Link
            href={ctaHref}
            className="hidden items-center gap-2 rounded-card bg-accent-500 px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-accent-400 md:flex"
          >
            {ctaLabel}
          </Link>

          {/* Mobile burger */}
          <button
            ref={burgerRef}
            type="button"
            aria-label="Menu"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
            className="grid size-10 place-items-center rounded md:hidden"
          >
            <span className="space-y-1.5">
              <span className="block h-0.5 w-6 bg-white" />
              <span className="block h-0.5 w-6 bg-white" />
              <span className="block h-0.5 w-6 bg-white" />
            </span>
          </button>
        </div>
      </div>

      {/* Pastki qator — asosiy navigatsiya */}
      <nav className="hidden border-t border-white/10 md:block">
        <div className="mx-auto flex h-[52px] max-w-site items-center gap-1 px-4">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            const isLive = item.href === '/live';
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center gap-2 px-3 py-2 text-[13px] font-bold uppercase tracking-wide transition-colors hover:text-accent-500 ${
                  active
                    ? 'text-accent-500 after:absolute after:inset-x-3 after:-bottom-[15px] after:h-0.5 after:bg-accent-500'
                    : 'text-white'
                }`}
              >
                {isLive && (
                  <span className="size-2 shrink-0 animate-pulse rounded-full bg-live" />
                )}
                {t(item.key)}
              </Link>
            );
          })}
          <div className="ml-auto">
            <HeaderSearch />
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div
          id="mobile-menu"
          ref={menuRef}
          className="border-t border-white/10 bg-navy-950 px-4 py-3 md:hidden"
        >
          {/* Qidiruv mobil menyuda ham bo'lishi kerak — ilgari yo'q edi */}
          <div className="mb-2">
            <HeaderSearch />
          </div>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={`block px-3 py-2.5 text-sm font-bold uppercase tracking-wide hover:bg-white/5 ${
                isActive(item.href) ? 'text-accent-500' : 'text-white'
              }`}
            >
              {t(item.key)}
            </Link>
          ))}
          <Link
            href={ctaHref}
            onClick={() => setOpen(false)}
            className="mt-2 block rounded-card bg-accent-500 px-4 py-2.5 text-center text-sm font-bold uppercase tracking-wide text-white"
          >
            {ctaLabel}
          </Link>
        </div>
      )}
    </header>
  );
}
