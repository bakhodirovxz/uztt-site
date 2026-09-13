'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter } from '@/i18n/navigation';
import { api, type AuthUser } from '@/lib/api';

interface Channel {
  type: 'OVERLAY' | 'SCREEN';
  tableNumber: number;
  label: string | null;
  overlayPath: string;
  screenPath: string;
}

interface ChannelRow {
  id: string;
  type: 'OVERLAY' | 'SCREEN';
  tableNumber: number;
  email: string | null;
  path: string;
}

// Manzil sahifa umri davomida o'zgarmaydi — obuna kerak emas
const subscribeNoop = () => () => {};

export default function StreamPanelPage() {
  const router = useRouter();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [allChannels, setAllChannels] = useState<ChannelRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  // Server renderda manzil noma'lum — mijozda gidratsiyadan keyin to'ldiriladi
  const origin = useSyncExternalStore(
    subscribeNoop,
    () => window.location.origin,
    () => '',
  );

  useEffect(() => {
    api
      .get<{ user: AuthUser }>('/auth/me')
      .then(({ user }) => {
        if (!user.permissions.includes('stream.view')) throw new Error('forbidden');
        // Operatorga stol biriktirilmagan — u barcha havolalarni ko'radi
        return api
          .get<Channel>('/stream/me')
          .then(setChannel)
          .catch(() =>
            api.get<ChannelRow[]>('/stream/channels').then(setAllChannels),
          );
      })
      .catch((e) => {
        if (e instanceof Error && e.message === 'forbidden') {
          router.replace('/login');
        } else {
          setError(e instanceof Error ? e.message : String(e));
        }
      });
  }, [router]);

  async function copy(url: string) {
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(url);
    setTimeout(() => setCopied(null), 2000);
  }

  if (error) {
    return (
      <div className="space-y-6">
        <p className="rounded-card bg-accent-100 px-4 py-3 text-accent-500">{error}</p>
      </div>
    );
  }

  // Operator ko'rinishi: barcha stollarning jonli efir havolalari
  if (!channel && allChannels) {
    const tables = [...new Set(allChannels.map((c) => c.tableNumber))].sort(
      (a, b) => a - b,
    );
    return (
      <div className="space-y-6">
        <h1 className="font-heading text-2xl font-extrabold uppercase">
          Jonli efir havolalari
        </h1>
        <p className="mt-1 text-muted">
          Har stolning OBS overlayi va zal monitori uchun manzillar. Hakam ochko
          kiritishi bilan ikkalasi ham avtomatik yangilanadi.
        </p>

        {tables.length === 0 && (
          <p className="mt-6 text-muted">Hozircha kanal biriktirilmagan.</p>
        )}

        <div className="mt-6 space-y-3">
          {tables.map((n) => (
            <div key={n} className="rounded-card bg-surface-card p-5 shadow-card">
              <h2 className="font-heading font-bold uppercase">{n}-stol</h2>
              <div className="mt-3 space-y-2">
                {allChannels
                  .filter((c) => c.tableNumber === n)
                  .map((c) => {
                    const url = origin + c.path;
                    return (
                      <div key={c.id} className="flex flex-wrap items-center gap-2">
                        <span className="w-24 shrink-0 text-xs font-bold uppercase tracking-wider text-muted">
                          {c.type === 'OVERLAY' ? 'OBS' : 'Monitor'}
                        </span>
                        <code className="min-w-0 flex-1 overflow-x-auto rounded-md bg-surface-raised px-3 py-2 font-mono text-sm">
                          {url}
                        </code>
                        <button
                          type="button"
                          onClick={() => copy(url)}
                          className="rounded-md border border-border px-3 py-2 text-sm font-semibold hover:border-accent-500"
                        >
                          {copied === url ? 'Nusxalandi ✓' : 'Nusxalash'}
                        </button>
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md border border-border px-3 py-2 text-sm font-semibold hover:border-accent-500"
                        >
                          Ochish ↗
                        </a>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!channel) {
    return <div className="py-10 text-muted">Yuklanmoqda...</div>;
  }

  const isOverlay = channel.type === 'OVERLAY';
  const url = origin + (isOverlay ? channel.overlayPath : channel.screenPath);

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-extrabold uppercase">
        {isOverlay ? 'Translatsiya (OBS overlay)' : 'Zal monitori'}
      </h1>
      <p className="mt-1 text-muted">
        Sizga <span className="font-bold text-ink">{channel.tableNumber}-stol</span>{' '}
        biriktirilgan. Havola kun bo&apos;yi o&apos;zgarmaydi — stolda o&apos;yin
        almashsa, ekran o&apos;zi yangi o&apos;yinga o&apos;tadi.
      </p>

      <div className="mt-6 rounded-card bg-surface-card p-5 shadow-card">
        <div className="text-xs font-bold uppercase tracking-wider text-muted">
          {isOverlay ? 'OBS Browser Source manzili' : 'Monitor manzili'}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <code className="flex-1 overflow-x-auto rounded-md bg-surface-raised px-3 py-2.5 font-mono text-sm">
            {url}
          </code>
          <button
            type="button"
            onClick={() => copy(url)}
            className="rounded-md bg-accent-600 px-5 py-2.5 font-semibold text-white hover:bg-accent-500"
          >
            {copied === url ? 'Nusxalandi ✓' : 'Nusxalash'}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-border px-5 py-2.5 font-semibold hover:border-accent-500"
          >
            Ochish ↗
          </a>
        </div>
      </div>

      {isOverlay ? (
        <div className="mt-6 rounded-card bg-surface-card p-5 text-sm shadow-card">
          <h2 className="font-heading font-bold uppercase">OBS sozlash</h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-muted">
            <li>OBS → Sources → <span className="text-ink">+ Browser</span></li>
            <li>URL maydoniga yuqoridagi havolani qo&apos;ying</li>
            <li>Width 1920, Height 1080</li>
            <li>
              <span className="text-ink">Custom CSS</span>{' '}
              maydonini bo&apos;sh qoldiring — fon allaqachon shaffof
              (chroma-key kerak emas)
            </li>
            <li>Hakam ochko kiritishi bilan hisob avtomatik yangilanadi</li>
          </ol>
        </div>
      ) : (
        <div className="mt-6 rounded-card bg-surface-card p-5 text-sm shadow-card">
          <h2 className="font-heading font-bold uppercase">Monitorga chiqarish</h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-muted">
            <li>Havolani monitorga ulangan kompyuterda oching</li>
            <li>
              Brauzerni to&apos;liq ekranga o&apos;tkazing (<span className="text-ink">F11</span>)
            </li>
            <li>
              O&apos;yin tugagach ekran 15 soniyadan keyin keyingi o&apos;yinga
              o&apos;tadi
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
