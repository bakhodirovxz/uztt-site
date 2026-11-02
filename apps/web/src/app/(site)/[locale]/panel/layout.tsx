import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import PanelShell from './panel-shell';

/** Boshqaruv paneli indekslanmaydi (robots.txt ham yopiq) */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PanelLayout({ children }: { children: ReactNode }) {
  return <PanelShell>{children}</PanelShell>;
}
