import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { setRequestLocale } from 'next-intl/server';
import { api, ApiError, cached } from '@/lib/api';

// Sahifa har so'rovda qayta render qilinadi, lekin API javoblari Data Cache'da
// teg bilan saqlanadi: admin kontentni o'zgartirsa /api/revalidate darhol tozalaydi.
// (Build vaqtida API o'chiq bo'lsa ham bo'sh sahifa "muzlab" qolmaydi.)
export const dynamic = 'force-dynamic';
export const fetchCache = 'default-cache';

interface StaticPage {
  key: string;
  locale: string;
  title: string;
  body: string;
  updatedAt: string;
}

async function fetchPage(key: string, locale: string) {
  return api.get<StaticPage>(`/pages/${encodeURIComponent(key)}?locale=${locale}`, cached('pages'))
    .catch((e) => {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; key: string }>;
}): Promise<Metadata> {
  const { locale, key } = await params;
  const page = await fetchPage(key, locale);
  if (!page) return {};
  return { title: page.title, description: page.body.slice(0, 160) };
}

export default async function StaticPageRoute({
  params,
}: {
  params: Promise<{ locale: string; key: string }>;
}) {
  const { locale, key } = await params;
  setRequestLocale(locale);

  const page = await fetchPage(key, locale);
  if (!page) notFound();

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-heading text-3xl font-extrabold uppercase tracking-tight">
        {page.title}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {new Date(page.updatedAt).toLocaleDateString(locale)}
      </p>
      {/* Markdown — XSS xavfsiz (HTML o'tkazilmaydi) */}
      <div className="prose-uztt mt-8 leading-relaxed">
        <ReactMarkdown>{page.body}</ReactMarkdown>
      </div>
    </article>
  );
}
