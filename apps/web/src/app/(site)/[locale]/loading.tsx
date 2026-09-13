/** Sahifa yuklanayotganda skeleton */
export default function Loading() {
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
