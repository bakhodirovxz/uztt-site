import { revalidateTag } from 'next/cache';

/**
 * API kontentni o'zgartirganda chaqiradi (x-revalidate-secret sarlavhasi bilan).
 * Sir mos kelmasa — 401; sirsiz endpoint keshni istalgan odam tozalay olishiga
 * olib kelardi.
 */
const ALLOWED_TAGS = ['news', 'pages', 'federation', 'media', 'tournaments'];

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return Response.json({ message: 'Revalidate sozlanmagan' }, { status: 503 });
  }
  if (request.headers.get('x-revalidate-secret') !== secret) {
    return Response.json({ message: 'Ruxsat yo‘q' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    tags?: unknown;
  } | null;
  const tags = Array.isArray(body?.tags)
    ? body.tags.filter(
        (t): t is string => typeof t === 'string' && ALLOWED_TAGS.includes(t),
      )
    : [];

  if (tags.length === 0) {
    return Response.json({ message: 'Teg ko‘rsatilmadi' }, { status: 400 });
  }

  // Next 16'da ikkinchi argument majburiy: 'max' — tegga bog'langan barcha
  // keshlangan javoblar darhol eskirgan deb belgilanadi.
  for (const tag of tags) revalidateTag(tag, 'max');
  return Response.json({ revalidated: tags });
}
