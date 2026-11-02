import { DrawBoard } from '@/components/screen/draw-board';

/** OBS Browser Source: guruh jadvallari va setka (shaffof fon, rasmlar bilan). Ommaviy ma'lumot — kirish shart emas. */
export default async function OverlayDrawPage({ params, searchParams }: { params: Promise<{ categoryId: string }>; searchParams: Promise<{ view?: string }> }) {
  const { categoryId } = await params;
  const { view } = await searchParams;
  const v = view === 'groups' || view === 'bracket' ? view : 'all';
  return <DrawBoard categoryId={categoryId} transparent view={v} />;
}
