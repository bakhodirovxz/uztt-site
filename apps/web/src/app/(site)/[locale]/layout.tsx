import type { Metadata } from 'next';
import { Inter, Roboto } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { LiveTicker } from '@/components/match/live-ticker';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import '@/styles/globals.css';

/**
 * WTT "Bio Sans" (Fontfabric, TIJORAT — ITTF serveridan) ishlatadi.
 * Uni ko'chirish litsenziya buzilishi bo'lardi, shuning uchun eng yaqin
 * ERKIN muqobil: Inter (100-900 variable, KIRILL bor — Archivo'da
 * kirill subseti yo'q, ruscha sahifa sistem shriftga tushib qolardi). Body uchun Roboto —
 * WTT'ning o'zida ham body Roboto'ga tushadi (o'lchab tasdiqlandi).
 *
 * Shriftlar variable (o'zgaruvchan) ko'rinishda: `weight` ko'rsatilmasa
 * next/font bitta faylda barcha qalinliklarni beradi — 4 ta alohida fayl o'rniga 1 ta.
 *
 * Kirill subseti faqat ruscha sahifalarga yuklanadi: uz/en foydalanuvchisi
 * o'qimaydigan glifni yuklab o'tirmaydi (sahifada ~60 KB kam).
 */
// O'zbek lotin alifbosi va ingliz tili uchun `latin` yetarli:
// oʻ/gʻ dagi belgilar ham shu diapazonda. `latin-ext` (ā, ș, ğ...) olib
// tashlandi — har sahifada ikkita ortiqcha shrift fayli yuklanardi.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const roboto = Roboto({
  subsets: ['latin'],
  variable: '--font-roboto',
  display: 'swap',
});

const interCyrillic = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
});

const robotoCyrillic = Roboto({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-roboto',
  display: 'swap',
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common' });
  return {
    title: {
      default: t('siteName'),
      template: `%s | ${t('siteShort')}`,
    },
    description: t('siteName'),
  };
}

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  // Kirill glifllari faqat ruscha sahifada kerak
  const heading = locale === 'ru' ? interCyrillic : inter;
  const body = locale === 'ru' ? robotoCyrillic : roboto;

  return (
    <html lang={locale} className={`${heading.variable} ${body.variable}`}>
      <body className="flex min-h-screen flex-col">
        <NextIntlClientProvider>
          {/* Jonli hisob tasmasi header USTIDA — WTT layout tili.
              Ilgari faqat bosh sahifada edi, ya'ni boshqa sahifadagi
              tashrifchi jonli o'yin borligini bilmasdi. */}
          <LiveTicker />
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
