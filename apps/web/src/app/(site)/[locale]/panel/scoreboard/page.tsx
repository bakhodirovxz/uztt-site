'use client';

import { useSyncExternalStore } from 'react';

const subscribeNoop = () => () => {};
const COURTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * Tayyor scoreboard dizayni (planshet, TV, overlay) saytning ichida, shu manzilda ishlaydi.
 * Havolalar to'g'ridan-to'g'ri ochiladi: planshetda IP:3000/control?court=1 ni oching.
 */
export default function ScoreboardPanelPage() {
  const origin = useSyncExternalStore(subscribeNoop, () => window.location.origin, () => '');
  const link = (path: string, label: string) => (
    <a
      href={path}
      target="_blank"
      rel="noreferrer"
      className="rounded-md border border-border bg-surface-card px-3 py-2 text-sm font-semibold hover:border-accent-500"
    >
      {label} ↗
    </a>
  );
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-extrabold">Scoreboard — planshet, TV va overlay</h1>
        <p className="mt-1 text-sm text-muted">
          Hakam planshetda <b>{origin || 'sayt manzili'}/control?court=STOL</b> ni ochadi. O‘yin ro‘yxati saytdagi
          musobaqadan avtomatik keladi (o‘yinga stol raqami belgilangan bo‘lsa, faqat o‘sha stolda chiqadi). O‘yin tugagach
          natija o‘zi saytga yoziladi: guruh jadvali, setka va reyting yangilanadi.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Zal ekrani (TV) va umumiy</h2>
        <div className="flex flex-wrap gap-2">
          {link('/tv', 'TV — barcha faol stollar')}
          {link('/tv?clear=1', 'TV (fonsiz, videokeyer uchun)')}
          {link('/admin', 'Scoreboard admin (reklama, sozlama, reyting)')}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Stol bo‘yicha</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted">
                <th className="py-2 pr-4">Stol</th>
                <th className="py-2 pr-4">Hakam planshet</th>
                <th className="py-2">OBS overlay</th>
              </tr>
            </thead>
            <tbody>
              {COURTS.map((n) => (
                <tr key={n} className="border-t border-border">
                  <td className="py-2 pr-4 font-bold">{n}-stol</td>
                  <td className="py-2 pr-4">{link(`/control?court=${n}`, 'Planshet')}</td>
                  <td className="py-2">{link(`/overlay?court=${n}`, 'Overlay')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
