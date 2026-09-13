import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { api, cached } from '@/lib/api';

// Sahifa har so'rovda qayta render qilinadi, lekin API javoblari Data Cache'da
// teg bilan saqlanadi: admin kontentni o'zgartirsa /api/revalidate darhol tozalaydi.
// (Build vaqtida API o'chiq bo'lsa ham bo'sh sahifa "muzlab" qolmaydi.)
export const dynamic = 'force-dynamic';
export const fetchCache = 'default-cache';

interface GalleryItem {
  id: string;
  title: string;
  coverUrl: string | null;
  photoCount: number;
  publishedAt: string | null;
}

export default async function GalleriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('media');
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  const galleries = await api.get<GalleryItem[]>(`/galleries?locale=${locale}`, cached('media'))
    .catch(() => [] as GalleryItem[]);

  return (
    <div className="mx-auto max-w-site px-4 py-12">
      <h1 className="font-heading text-3xl font-extrabold uppercase tracking-tight">
        {t('galleries')}
      </h1>

      {galleries.length === 0 ? (
        <p className="mt-6 text-muted">{t('empty')}</p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {galleries.map((g) => (
            <Link
              key={g.id}
              href={{ pathname: '/galleries/[id]', params: { id: g.id } }}
              className="group overflow-hidden rounded-card bg-surface-card shadow-card transition-shadow hover:shadow-card-hover"
            >
              <div className="relative aspect-[4/3] bg-navy-800">
                {g.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={g.coverUrl.startsWith('http') ? g.coverUrl : apiBase + g.coverUrl}
                    alt={g.title}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div
                    className="absolute inset-0 opacity-70"
                    style={{
                      background:
                        'radial-gradient(400px 250px at 70% 30%, rgba(255,107,0,0.35), transparent 60%)',
                    }}
                  />
                )}
                <span className="absolute bottom-3 right-3 rounded bg-navy-950/80 px-2 py-0.5 text-xs font-semibold text-white">
                  {g.photoCount} {t('photos')}
                </span>
              </div>
              <div className="p-4">
                <h2 className="font-heading font-bold leading-snug group-hover:text-accent-400">
                  {g.title}
                </h2>
                {g.publishedAt && (
                  <p className="mt-1 text-xs text-muted">
                    {new Date(g.publishedAt).toLocaleDateString(locale)}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
