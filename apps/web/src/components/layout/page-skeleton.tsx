/**
 * Sahifa yuklanayotganda skeleton (loading.tsx lar shuni qayta eksport qiladi).
 * [locale]/loading.tsx ATAYLAB yo'q: u barcha sahifalarni Suspense'ga o'raydi,
 * javob 200 bilan oqimga ketadi va [slug] sahifadagi notFound() 404 bera olmaydi
 * (soft-404). Skeletni faqat ostida [slug]/[id] sahifasi yo'q segmentga qo'y.
 */
export default function PageSkeleton() {
  return (
    <div className="mx-auto max-w-site animate-pulse px-4 py-12">
      <div className="h-9 w-64 rounded bg-border" />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-40 rounded-card bg-surface-card shadow-card" />
        ))}
      </div>
    </div>
  );
}
