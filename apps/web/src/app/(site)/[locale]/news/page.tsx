import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { api, cached } from '@/lib/api';
import { Container, PageTitleBar } from '@/components/ui';

// Sahifa har so'rovda qayta render qilinadi, lekin API javoblari Data Cache'da
// teg bilan saqlanadi: admin kontentni o'zgartirsa /api/revalidate darhol tozalaydi.
// (Build vaqtida API o'chiq bo'lsa ham bo'sh sahifa "muzlab" qolmaydi.)
export const dynamic = 'force-dynamic';
export const fetchCache = 'default-cache';

interface NewsItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  category: string | null;
  isFeatured: boolean;
  publishedAt: string | null;
  coverImageUrl: string | null;
}

export default async function NewsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('nav');

  const items = await api.get<NewsItem[]>(`/news?locale=${locale}`, cached('news'))
    .catch(() => [] as NewsItem[]);

  return (
    <>
      <PageTitleBar title={t('news')} />
      <Container className="py-8">

      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {items.map((n) => (
          <Link
            key={n.id}
            href={{ pathname: '/news/[slug]', params: { slug: n.slug } }}
            className="group overflow-hidden rounded-card bg-surface-card shadow-card transition-shadow hover:shadow-card-hover"
          >
            <div className="relative h-40 overflow-hidden bg-navy-800">
              {n.coverImageUrl ? (
                <Image
                  src={n.coverImageUrl}
                  alt={n.title}
                  fill
                  sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                />
              ) : (
                <div
                  className="absolute inset-0 opacity-70"
                  style={{
                    background:
                      'radial-gradient(400px 200px at 80% 20%, rgba(255,107,0,0.4), transparent 60%)',
                  }}
                />
              )}
              {n.category && (
                <span className="absolute left-3 top-3 rounded bg-accent-600 px-2 py-0.5 text-xs font-semibold uppercase text-white">
                  {n.category}
                </span>
              )}
            </div>
            <div className="p-5">
              <h2 className="font-heading text-lg font-bold leading-snug group-hover:text-accent-400">
                {n.title}
              </h2>
              {n.excerpt && (
                <p className="mt-2 line-clamp-2 text-sm text-muted">
                  {n.excerpt}
                </p>
              )}
              {n.publishedAt && (
                <p className="mt-3 text-xs text-muted">
                  {new Date(n.publishedAt).toLocaleDateString(locale)}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
      </Container>
    </>
  );
}
