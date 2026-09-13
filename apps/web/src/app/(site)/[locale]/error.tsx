'use client';

/** Sahifa darajasidagi xatolar uchun umumiy fallback */
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <p className="font-heading text-6xl font-extrabold text-accent-400/30">!</p>
      <h1 className="mt-2 font-heading text-2xl font-extrabold uppercase">
        Xatolik yuz berdi
      </h1>
      <p className="mt-2 text-muted">
        Sahifani yangilab ko'ring — muammo davom etsa administratorga xabar bering.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-md bg-accent-600 px-6 py-3 font-semibold text-white hover:bg-accent-500"
      >
        Qayta urinish
      </button>
    </div>
  );
}
