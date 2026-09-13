import Image from 'next/image';
import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { api, cached } from '@/lib/api';
import { SITE_CONTACT } from '@/lib/site-config';

interface FooterPage {
  key: string;
  title: string;
}

export async function SiteFooter() {
  const t = await getTranslations('footer');
  const tc = await getTranslations('common');
  const tn = await getTranslations('nav');
  const locale = await getLocale();
  const year = new Date().getFullYear();

  // Huquqiy sahifalar bazadan keladi — matn o'zgarsa deploy shart emas
  const pages = await api
    .get<FooterPage[]>(`/pages?locale=${locale}`, cached('pages'))
    .catch(() => [] as FooterPage[]);

  return (
    <footer className="bg-navy-950 text-white/70">
      <div className="mx-auto grid max-w-site gap-8 px-4 py-12 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-3">
            <Image
              src="/uttf-logo.png"
              alt={tc('siteName')}
              width={40}
              height={40}
              className="size-10 shrink-0"
            />
            <span className="font-heading text-lg font-bold text-white">
              {tc('siteShort')}
            </span>
          </div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed">
            {tc('siteName')}
          </p>
        </div>

        <nav className="text-sm">
          <h3 className="mb-3 font-heading text-sm font-bold uppercase tracking-wider text-white">
            {t('about')}
          </h3>
          <ul className="space-y-2">
            <li>
              <Link href="/events" className="inline-flex min-h-8 items-center hover:text-white">
                {tn('events')}
              </Link>
            </li>
            <li>
              <Link href="/rankings" className="inline-flex min-h-8 items-center hover:text-white">
                {tn('rankings')}
              </Link>
            </li>
            <li>
              <Link href="/players" className="inline-flex min-h-8 items-center hover:text-white">
                {tn('players')}
              </Link>
            </li>
            <li>
              <Link href="/news" className="inline-flex min-h-8 items-center hover:text-white">
                {tn('news')}
              </Link>
            </li>
            <li>
              <Link href="/videos" className="inline-flex min-h-8 items-center hover:text-white">
                {tn('videos')}
              </Link>
            </li>
            <li>
              <Link href="/galleries" className="inline-flex min-h-8 items-center hover:text-white">
                {tn('galleries')}
              </Link>
            </li>
            <li>
              <Link href="/about" className="inline-flex min-h-8 items-center hover:text-white">
                {t('about')}
              </Link>
            </li>
            <li>
              <Link href="/contact" className="inline-flex min-h-8 items-center hover:text-white">
                {t('contact')}
              </Link>
            </li>
          </ul>
        </nav>

        <div className="text-sm">
          <h3 className="mb-3 font-heading text-sm font-bold uppercase tracking-wider text-white">
            {t('contact')}
          </h3>
          <p>{SITE_CONTACT.city}</p>
          <p className="mt-1">
            <a href={SITE_CONTACT.phoneHref} className="hover:text-white">
              {SITE_CONTACT.phone}
            </a>
          </p>
          <p className="mt-1">
            <a href={SITE_CONTACT.emailHref} className="hover:text-white">
              {SITE_CONTACT.email}
            </a>
          </p>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs">
        <p>
          © {year} {tc('siteShort')} — {t('rights')}
        </p>
        {pages.length > 0 && (
          <ul className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1">
            {pages.map((p) => (
              <li key={p.key}>
                <Link
                  href={{ pathname: '/pages/[key]', params: { key: p.key } }}
                  className="inline-flex min-h-8 items-center hover:text-white"
                >
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </footer>
  );
}
