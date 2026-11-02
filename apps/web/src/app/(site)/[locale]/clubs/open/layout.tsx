import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { pageMeta } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'seo' });
  return pageMeta({ locale, href: '/clubs/open', title: t('clubsOpen.title'), description: t('clubsOpen.description'), noindex: false });
}

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
