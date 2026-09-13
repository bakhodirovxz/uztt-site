import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { api, ApiError, cached } from '@/lib/api';
import { Lightbox } from './lightbox';

// Sahifa har so'rovda qayta render qilinadi, lekin API javoblari Data Cache'da
// teg bilan saqlanadi: admin kontentni o'zgartirsa /api/revalidate darhol tozalaydi.
// (Build vaqtida API o'chiq bo'lsa ham bo'sh sahifa "muzlab" qolmaydi.)
export const dynamic = 'force-dynamic';
export const fetchCache = 'default-cache';

interface GalleryDetail {
  id: string;
  title: string;
  publishedAt: string | null;
  photos: Array<{
    id: string;
    url: string;
    thumbUrl: string | null;
    credit: string | null;
  }>;
}

export default async function GalleryDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const gallery = await api.get<GalleryDetail>(`/galleries/${id}?locale=${locale}`, cached('media'))
    .catch((e) => {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    });
  if (!gallery) notFound();

  return (
    <div className="mx-auto max-w-site px-4 py-12">
      <h1 className="font-heading text-3xl font-extrabold uppercase tracking-tight">
        {gallery.title}
      </h1>
      {gallery.publishedAt && (
        <p className="mt-1 text-sm text-muted">
          {new Date(gallery.publishedAt).toLocaleDateString(locale)}
        </p>
      )}
      <Lightbox photos={gallery.photos} />
    </div>
  );
}
