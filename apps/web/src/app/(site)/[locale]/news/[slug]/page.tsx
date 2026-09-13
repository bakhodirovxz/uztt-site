import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import ReactMarkdown from 'react-markdown';
import { api, ApiError, cached } from '@/lib/api';
import { safeJsonLd } from '@/lib/json-ld';

// Sahifa har so'rovda qayta render qilinadi, lekin API javoblari Data Cache'da
// teg bilan saqlanadi: admin kontentni o'zgartirsa /api/revalidate darhol tozalaydi.
// (Build vaqtida API o'chiq bo'lsa ham bo'sh sahifa "muzlab" qolmaydi.)
export const dynamic = 'force-dynamic';
export const fetchCache = 'default-cache';

interface NewsDetail {
  id: string;
  title: string;
  slug: string;
  body: string;
  excerpt?: string | null;
  category: string | null;
  publishedAt: string | null;
  coverImageUrl: string | null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const article = await api.get<NewsDetail>(`/news/${slug}?locale=${locale}`, cached('news'))
    .catch(() => null);
  if (!article) return {};
  const description = (article.excerpt ?? article.body).slice(0, 160);
  return {
    title: article.title,
    description,
    openGraph: {
      title: article.title,
      description,
      type: 'article',
      publishedTime: article.publishedAt ?? undefined,
    },
  };
}

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const article = await api.get<NewsDetail>(`/news/${slug}?locale=${locale}`, cached('news'))
    .catch((e) => {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    });
  if (!article) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    datePublished: article.publishedAt ?? undefined,
    inLanguage: locale,
    publisher: {
      '@type': 'SportsOrganization',
      name: "O'zbekiston Stol Tennisi Federatsiyasi",
    },
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />
      {article.category && (
        <span className="rounded bg-accent-600 px-2 py-0.5 text-xs font-semibold uppercase text-white">
          {article.category}
        </span>
      )}
      <h1 className="mt-3 font-heading text-4xl font-extrabold leading-tight tracking-tight">
        {article.title}
      </h1>
      {article.publishedAt && (
        <p className="mt-2 text-sm text-muted">
          {new Date(article.publishedAt).toLocaleDateString(locale, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      )}
      {article.coverImageUrl && (
        <div className="relative mt-6 aspect-[16/9] w-full overflow-hidden rounded-card bg-navy-800">
          <Image
            src={article.coverImageUrl}
            alt={article.title}
            fill
            sizes="(min-width: 1024px) 768px, 100vw"
            className="object-cover"
            priority
          />
        </div>
      )}
      {/* Markdown qo'llab-quvvatlanadi (sarlavha, qalin, ro'yxat, havola).
          react-markdown xom HTML'ni render QILMAYDI — XSS'dan xavfsiz. */}
      <div className="prose-uztt mt-8 text-lg leading-relaxed">
        <ReactMarkdown>{article.body}</ReactMarkdown>
      </div>
    </article>
  );
}
