import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { Container, PageTitleBar } from '@/components/ui';

interface ClubRow {
  id: string; slug: string; name: string; clubType: string | null; regionName: string | null;
  districtName: string | null; tableCount: number | null; _count: { players: number };
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'seo' });
  return pageMeta({ locale, href: '/clubs', title: t('clubs.title'), description: t('clubs.description') });
}

export default async function ClubsPage({
  params, searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; region?: string }>;
}) {
  const { locale } = await params;
  const { q, region } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('join');

  const qs = new URLSearchParams();
  if (q) qs.set('q', q);
  if (region) qs.set('region', region);
  const data = await api
    .get<{ rows: ClubRow[]; total: number }>(`/clubs?${qs}`)
    .catch(() => ({ rows: [] as ClubRow[], total: 0 }));
  const regions = await api
    .get<string[]>('/players/regions', { next: { revalidate: 300 } } as RequestInit)
    .catch(() => [] as string[]);

  return (
    <>
      <PageTitleBar title={t('clubsTitle')}>
        <Link href="/clubs/open" className="inline-flex min-h-9 items-center rounded-card border border-white/25 px-4 text-[13px] font-semibold uppercase tracking-wide text-white hover:border-accent-500 hover:text-accent-500">
          {t('linkOpenClub')}
        </Link>
      </PageTitleBar>
      <Container className="py-8">
        <form className="flex flex-wrap items-center gap-2" action="">
          <input type="search" name="q" defaultValue={q ?? ''} placeholder={t('clubSearch')} aria-label={t('clubSearch')}
            className="min-h-10 w-full rounded-md border border-border bg-surface-card px-3.5 text-sm outline-none focus:border-accent-500 sm:w-64" />
          <select name="region" defaultValue={region ?? ''} aria-label={t('region')} className="min-h-10 rounded-md border border-border bg-surface-card px-3 text-sm">
            <option value="">{t('region')}: —</option>
            {regions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button type="submit" className="min-h-10 rounded-md bg-accent-600 px-5 text-sm font-semibold text-white">{t('search')}</button>
        </form>

        {data.rows.length === 0 ? (
          <p className="mt-10 text-muted">{t('clubsEmpty')}</p>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.rows.map((c) => (
              <li key={c.id}>
                <Link href={{ pathname: '/clubs/[slug]', params: { slug: c.slug } }}
                  className="block rounded-card bg-surface-card p-5 shadow-card transition-colors hover:ring-2 hover:ring-accent-500">
                  <h2 className="font-heading text-lg font-extrabold">{c.name}</h2>
                  <p className="mt-1 text-sm text-muted">{[c.regionName, c.districtName].filter(Boolean).join(' · ') || '—'}</p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">
                    {t('players')}: {c._count.players}{c.tableCount ? ` · ${t('tables')}: ${c.tableCount}` : ''}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </>
  );
}
