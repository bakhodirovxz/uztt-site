import { getTranslations, setRequestLocale } from 'next-intl/server';
import { api, cached } from '@/lib/api';

// Sahifa har so'rovda qayta render qilinadi, lekin API javoblari Data Cache'da
// teg bilan saqlanadi: admin kontentni o'zgartirsa /api/revalidate darhol tozalaydi.
// (Build vaqtida API o'chiq bo'lsa ham bo'sh sahifa "muzlab" qolmaydi.)
export const dynamic = 'force-dynamic';
export const fetchCache = 'default-cache';

interface VideoItem {
  id: string;
  youtubeId: string;
  title: string;
  category: string | null;
  publishedAt: string | null;
}

export default async function VideosPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('media');

  const videos = await api.get<VideoItem[]>(`/videos?locale=${locale}`, cached('media'))
    .catch(() => [] as VideoItem[]);

  return (
    <div className="mx-auto max-w-site px-4 py-12">
      <h1 className="font-heading text-3xl font-extrabold uppercase tracking-tight">
        {t('videos')}
      </h1>

      {videos.length === 0 ? (
        <p className="mt-6 text-muted">{t('empty')}</p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v) => (
            <div
              key={v.id}
              className="overflow-hidden rounded-card bg-surface-card shadow-card"
            >
              <div className="aspect-video bg-navy-900">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${v.youtubeId}`}
                  title={v.title}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>
              <div className="p-4">
                {v.category && (
                  <span className="text-xs font-semibold uppercase text-accent-400">
                    {v.category}
                  </span>
                )}
                <h2 className="mt-0.5 font-heading font-bold leading-snug">
                  {v.title}
                </h2>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
