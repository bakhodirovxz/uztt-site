import { DrawBoard } from '@/components/screen/draw-board';

/** Zal televizori: guruh jadvallari va setka, o'yinchi rasmlari bilan. Ma'lumot ommaviy, shuning uchun kirish talab qilinmaydi. */
export default async function ScreenDrawPage({ params, searchParams }: { params: Promise<{ categoryId: string }>; searchParams: Promise<{ view?: string }> }) {
  const { categoryId } = await params;
  const { view } = await searchParams;
  const v = view === 'groups' || view === 'bracket' ? view : 'all';
  return (
    <main className="min-h-screen bg-broadcast-bg">
      <DrawBoard categoryId={categoryId} view={v} />
    </main>
  );
}
