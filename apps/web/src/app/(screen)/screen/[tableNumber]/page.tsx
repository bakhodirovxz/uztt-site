import { ScreenClient } from './screen-client';

/**
 * Zal monitori: stolga biriktirilgan katta ekran.
 * O'yin almashsa avtomatik yangi o'yinga o'tadi, o'yin yo'q paytda
 * keyingi o'yinlar jadvalini ko'rsatadi (WTT "Upcoming Match Slate").
 */
export default async function ScreenPage({
  params,
}: {
  params: Promise<{ tableNumber: string }>;
}) {
  const { tableNumber } = await params;
  return <ScreenClient tableNumber={Number(tableNumber)} />;
}
