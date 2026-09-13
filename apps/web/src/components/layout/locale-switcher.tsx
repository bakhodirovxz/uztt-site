'use client';

import { useLocale } from 'next-intl';
import { useParams } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { usePathname, useRouter } from '@/i18n/navigation';

const LABELS: Record<string, string> = { uz: "O'z", ru: 'Ру', en: 'En' };

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();

  function switchTo(next: string) {
    // Joriy sahifani yangi tilda ochamiz (localized pathname avtomatik)
    router.replace(
      // @ts-expect-error — dinamik params bilan pathname birga uzatiladi
      { pathname, params },
      { locale: next },
    );
  }

  return (
    <div
      role="group"
      aria-label="Til / Язык / Language"
      className="flex items-center rounded-md border border-border-strong p-0.5"
    >
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => switchTo(l)}
          aria-current={l === locale ? 'true' : undefined}
          // min-h-8/min-w-9 — barmoq bilan bosish uchun yetarli maydon
          className={`min-h-8 min-w-9 rounded px-2 text-xs font-bold transition-colors ${
            l === locale
              ? 'bg-navy-700 text-white'
              : 'text-muted hover:bg-surface-alt hover:text-ink'
          }`}
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  );
}
