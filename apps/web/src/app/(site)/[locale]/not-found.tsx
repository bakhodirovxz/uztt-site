import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('nav');

  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <p className="font-heading text-8xl font-extrabold text-white/10">404</p>
      <h1 className="mt-2 font-heading text-2xl font-extrabold uppercase">
        Sahifa topilmadi
      </h1>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="rounded-md bg-accent-600 px-6 py-3 font-semibold text-white hover:bg-accent-500">
          Bosh sahifa
        </Link>
        <Link href="/events" className="rounded-md border border-border bg-surface-card px-6 py-3 font-semibold">
          {t('events')}
        </Link>
      </div>
    </div>
  );
}
