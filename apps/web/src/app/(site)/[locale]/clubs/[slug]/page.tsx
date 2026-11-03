import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { PlayerPopupLink } from '@/components/player/player-popup';
import { api } from '@/lib/api';
import { pageMeta } from '@/lib/seo';
import { Container, PageTitleBar, PlayerCell } from '@/components/ui';

interface ClubDetail {
  id: string; slug: string; name: string; clubType: string | null; regionName: string | null;
  tableCount: number | null;
  players: Array<{ id: string; slug: string; firstName: string; lastName: string; rankingPoints: number; photoUrl: string | null }>;
  coachCount: number;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const club = await api.get<ClubDetail>(`/clubs/${encodeURIComponent(slug)}`).catch(() => null);
  if (!club) return {};
  return pageMeta({
    locale,
    href: { pathname: '/clubs/[slug]', params: { slug } },
    title: club.name,
    description: [club.name, club.clubType, club.regionName].filter(Boolean).join(' · '),
  });
}

export default async function ClubPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('join');
  const club = await api.get<ClubDetail>(`/clubs/${encodeURIComponent(slug)}`).catch(() => null);
  if (!club) notFound();

  return (
    <>
      <PageTitleBar title={club.name} />
      <Container className="py-8">
        <p className="text-sm text-muted">
          {[club.clubType, club.regionName].filter(Boolean).join(' · ')}
        </p>
        <p className="mt-1 text-sm text-muted">
          {t('coaches')}: {club.coachCount}{club.tableCount ? ` · ${t('tables')}: ${club.tableCount}` : ''}
        </p>
        <h2 className="mt-8 font-heading text-lg font-extrabold uppercase">{t('players')}</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {club.players.map((p) => (
            <li key={p.id} className="rounded-card bg-surface-card p-3 shadow-card">
              <PlayerPopupLink slug={p.slug}>
                <PlayerCell photoUrl={p.photoUrl} firstName={p.firstName} lastName={p.lastName} sub={`${p.rankingPoints}`} />
              </PlayerPopupLink>
            </li>
          ))}
        </ul>
        <Link href="/clubs" className="mt-8 inline-block text-sm font-semibold text-accent-600">← {t('back')}</Link>
      </Container>
    </>
  );
}
