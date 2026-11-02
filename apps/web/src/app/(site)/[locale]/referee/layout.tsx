import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/** Hakam paneli indekslanmaydi */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
