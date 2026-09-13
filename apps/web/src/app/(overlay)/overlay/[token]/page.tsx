import { OverlayClient } from './overlay-client';

/**
 * OBS Browser Source overlay: shaffof fon, pastda hisob paneli.
 * Legacy Overlay.jsx dan portlangan — token orqali o'yin, socket orqali jonli hisob.
 */
export default async function OverlayPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <OverlayClient token={token} />;
}
