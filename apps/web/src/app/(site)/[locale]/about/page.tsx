import { getTranslations, setRequestLocale } from 'next-intl/server';
import { api, cached } from '@/lib/api';

// Sahifa har so'rovda qayta render qilinadi, lekin API javoblari Data Cache'da
// teg bilan saqlanadi: admin kontentni o'zgartirsa /api/revalidate darhol tozalaydi.
// (Build vaqtida API o'chiq bo'lsa ham bo'sh sahifa "muzlab" qolmaydi.)
export const dynamic = 'force-dynamic';
export const fetchCache = 'default-cache';

interface StaffItem {
  id: string;
  type: 'EXECUTIVE' | 'STAFF';
  fullName: string;
  position: string;
  photoUrl: string | null;
  email: string | null;
}
interface DocItem {
  id: string;
  title: string;
  category: string;
  fileUrl: string;
}
interface SponsorItem {
  id: string;
  name: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  tier: number;
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('about');
  const tc = await getTranslations('common');
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  const [staff, documents, sponsors] = await Promise.all([
    api.get<StaffItem[]>(`/federation/staff?locale=${locale}`, cached('federation')).catch(() => []),
    api.get<DocItem[]>(`/federation/documents?locale=${locale}`, cached('federation')).catch(() => []),
    api.get<SponsorItem[]>('/federation/sponsors').catch(() => []),
  ]);

  const executives = staff.filter((s) => s.type === 'EXECUTIVE');
  const employees = staff.filter((s) => s.type === 'STAFF');

  const PersonCard = ({ p }: { p: StaffItem }) => (
    <div className="rounded-card bg-surface-card p-5 text-center shadow-card">
      <div className="mx-auto grid size-20 place-items-center rounded-full bg-navy-800 font-heading text-2xl font-extrabold text-white">
        {p.fullName
          .split(' ')
          .slice(0, 2)
          .map((w) => w[0])
          .join('')}
      </div>
      <h3 className="mt-3 font-heading font-bold">{p.fullName}</h3>
      <p className="text-sm text-muted">{p.position}</p>
      {p.email && (
        <a href={`mailto:${p.email}`} className="mt-1 block text-xs text-accent-400">
          {p.email}
        </a>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-site px-4 py-12">
      <h1 className="font-heading text-3xl font-extrabold uppercase tracking-tight">
        {t('title')}
      </h1>
      <p className="mt-3 max-w-2xl text-muted">{tc('siteName')}</p>

      <h2 className="mt-10 font-heading text-xl font-bold uppercase tracking-wide">
        {t('executives')}
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {executives.map((p) => <PersonCard key={p.id} p={p} />)}
      </div>

      {employees.length > 0 && (
        <>
          <h2 className="mt-10 font-heading text-xl font-bold uppercase tracking-wide">
            {t('staff')}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {employees.map((p) => <PersonCard key={p.id} p={p} />)}
          </div>
        </>
      )}

      <h2 className="mt-10 font-heading text-xl font-bold uppercase tracking-wide">
        {t('documents')}
      </h2>
      <div className="mt-4 space-y-2">
        {documents.map((d) => (
          <a
            key={d.id}
            href={d.fileUrl.startsWith('http') ? d.fileUrl : apiBase + d.fileUrl}
            className="flex items-center gap-3 rounded-card bg-surface-card px-4 py-3 shadow-card hover:shadow-card-hover"
          >
            <span className="grid size-9 place-items-center rounded bg-accent-100 font-heading text-xs font-extrabold text-danger">
              PDF
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">{d.title}</span>
            <span className="text-xs font-semibold uppercase text-muted">{d.category}</span>
            <span className="text-sm font-semibold text-accent-400">{t('download')} ↓</span>
          </a>
        ))}
      </div>

      <h2 className="mt-10 font-heading text-xl font-bold uppercase tracking-wide">
        {t('sponsors')}
      </h2>
      <div className="mt-4 flex flex-wrap gap-4">
        {sponsors.map((s) => (
          <div
            key={s.id}
            className={`grid min-w-40 place-items-center rounded-card bg-surface-card px-6 shadow-card ${
              s.tier === 1 ? 'h-24 font-heading text-lg font-extrabold' : 'h-18 py-4 font-semibold'
            }`}
          >
            {s.name}
          </div>
        ))}
      </div>
    </div>
  );
}
