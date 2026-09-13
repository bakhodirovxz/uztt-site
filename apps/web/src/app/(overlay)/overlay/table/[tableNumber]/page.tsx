import { OverlayTableClient } from './overlay-table-client';

/**
 * Stol raqami bo'yicha OBS overlay: /overlay/table/3 → 3-stoldagi joriy o'yin.
 * Token overlayidan farqi — havola o'zgarmaydi, o'yinlar almashsa ham.
 */
export default async function OverlayTablePage({
  params,
}: {
  params: Promise<{ tableNumber: string }>;
}) {
  const { tableNumber } = await params;
  return <OverlayTableClient tableNumber={Number(tableNumber)} />;
}
