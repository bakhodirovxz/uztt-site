'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Ad {
  id: string;
  title: string;
  kind?: 'IMAGE' | 'VIDEO' | 'PROMO';
  imageUrl: string | null;
  videoUrl?: string | null;
  durationS: number;
  tables: string;
  enabled: boolean;
  sortOrder: number;
}

/**
 * OBS overlay reklamalari: stolda o'yin boshlanmagan bo'sh vaqtda navbatma-navbat
 * ko'rsatiladi. Rasm mavjud yuklash (sharp, webp) orqali olinadi.
 */
export default function OverlayAdsPage() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'IMAGE' | 'VIDEO' | 'PROMO'>('IMAGE');
  const [durationS, setDurationS] = useState(10);
  const [tables, setTables] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .get<Ad[]>('/showcase/ads/all')
      .then(setAds)
      .catch((e) => setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) }));
  }, []);
  useEffect(load, [load]);

  const fail = (e: unknown) =>
    setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });

  async function create() {
    if (!file || !title.trim()) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API_BASE}/api/uploads/${kind === 'IMAGE' ? 'image' : 'video'}`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      const asset = (await res.json()) as { url?: string; message?: string; durationS?: number | null };
      if (!res.ok || !asset.url) throw new Error(asset.message ?? 'Yuklash xatosi');
      await api.post('/showcase/ads', {
        title: title.trim(),
        kind,
        ...(kind === 'IMAGE' ? { imageUrl: asset.url } : { videoUrl: asset.url }),
        // rolik: haqiqiy davomiylik (ffprobe) bo'lsa o'shani, lekin tur chegarasidan oshmasin
        durationS: kind !== 'IMAGE' && asset.durationS ? Math.min(asset.durationS, kind === 'PROMO' ? 30 : 15) : durationS,
        tables: tables.replace(/\s/g, ''),
      });
      setFile(null);
      setTitle('');
      setTables('');
      setMsg({ ok: true, text: 'Reklama qo‘shildi' });
      load();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, body: Partial<Ad>) {
    try {
      await api.patch(`/showcase/ads/${id}`, body);
      load();
    } catch (e) {
      fail(e);
    }
  }

  async function remove(id: string) {
    if (!confirm('Reklama o‘chirilsinmi?')) return;
    try {
      await api.del(`/showcase/ads/${id}`);
      load();
    } catch (e) {
      fail(e);
    }
  }

  const input =
    'w-full rounded-md border border-border px-3 py-2 outline-none focus:border-accent-500';

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-extrabold uppercase">Overlay reklamalari</h1>
      <p className="text-muted">
        Stolda o‘yin boshlanmagan bo‘sh vaqtda OBS overlayida navbatma-navbat chiqadi.
        Tavsiya: 1920×1080 (16:9) rasm.
      </p>

      {msg && (
        <p
          role="status"
          className={`rounded-card px-4 py-3 ${msg.ok ? 'bg-surface-raised' : 'bg-accent-100 text-accent-500'}`}
        >
          {msg.text}
        </p>
      )}

      <div className="rounded-card bg-surface-card p-5 shadow-card">
        <h2 className="font-heading font-bold uppercase">Yangi reklama</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            className={input}
            placeholder="Nomi (masalan: Homiy logotipi)"
            value={title}
            maxLength={80}
            onChange={(e) => setTitle(e.target.value)}
          />
          <select
            className={input}
            value={kind}
            onChange={(e) => {
              const k = e.target.value as typeof kind;
              setKind(k);
              setFile(null);
              setDurationS(k === 'PROMO' ? 30 : 10);
            }}
          >
            <option value="IMAGE">Rasm reklama (8–10 s)</option>
            <option value="VIDEO">Qisqa rolik (8–10 s, ≤ 15 s)</option>
            <option value="PROMO">Promo rolik (≤ 30 s)</option>
          </select>
          <input
            type="file"
            key={kind}
            accept={kind === 'IMAGE' ? 'image/jpeg,image/png,image/webp,image/avif' : 'video/mp4,video/webm'}
            className={input}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <label className="text-sm text-muted">
            Ko‘rsatish vaqti (soniya)
            <input
              type="number"
              min={3}
              max={kind === 'PROMO' ? 30 : 15}
              className={input}
              value={durationS}
              onChange={(e) => setDurationS(Number(e.target.value))}
            />
          </label>
          <label className="text-sm text-muted">
            Stollar (masalan 1,2 — bo‘sh bo‘lsa hamma stol)
            <input
              className={input}
              value={tables}
              maxLength={47}
              onChange={(e) => setTables(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          disabled={busy || !file || !title.trim()}
          onClick={create}
          className="mt-4 rounded-md bg-accent-600 px-5 py-2.5 font-semibold text-white hover:bg-accent-500 disabled:opacity-40"
        >
          {busy ? 'Yuklanmoqda...' : 'Qo‘shish'}
        </button>
      </div>

      <div className="space-y-3">
        {ads.length === 0 && <p className="text-muted">Hozircha reklama yo‘q.</p>}
        {ads.map((a, i) => (
          <div
            key={a.id}
            className={`flex flex-wrap items-center gap-4 rounded-card bg-surface-card p-4 shadow-card ${a.enabled ? '' : 'opacity-50'}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {a.videoUrl ? (
              <video src={a.videoUrl} muted preload="metadata" className="h-20 w-36 rounded-md bg-black object-contain" />
            ) : (
              <img src={a.imageUrl ?? ''} alt="" className="h-20 w-36 rounded-md bg-black object-contain" />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{a.title}</div>
              <div className="text-sm text-muted">
                {a.kind === 'PROMO' ? 'PROMO · ' : a.kind === 'VIDEO' ? 'ROLIK · ' : ''}{a.durationS} s · {a.tables ? `stol ${a.tables}` : 'hamma stol'}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={a.enabled}
                onChange={(e) => patch(a.id, { enabled: e.target.checked })}
              />
              Yoqilgan
            </label>
            <div className="flex gap-1">
              <button
                type="button"
                aria-label="Yuqoriga"
                disabled={i === 0}
                className="rounded-md border border-border px-3 py-1.5 disabled:opacity-30"
                onClick={() => patch(a.id, { sortOrder: ads[i - 1].sortOrder - 1 })}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label="Pastga"
                disabled={i === ads.length - 1}
                className="rounded-md border border-border px-3 py-1.5 disabled:opacity-30"
                onClick={() => patch(a.id, { sortOrder: ads[i + 1].sortOrder + 1 })}
              >
                ↓
              </button>
              <button
                type="button"
                className="rounded-md border border-border px-3 py-1.5 text-accent-500"
                onClick={() => remove(a.id)}
              >
                O‘chirish
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
