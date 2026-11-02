'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * O'yinchi rasmini yuklash (o'yinchining o'zi, uning murabbiyi yoki administrator).
 * Server rasmni tekshiradi va qayta kodlaydi; brauzerda faqat tur/hajm oldindan tekshiriladi.
 */
export function PhotoUploader({ playerId, onDone, compact = false }: { playerId: string; onDone?: (url: string) => void; compact?: boolean }) {
  const t = useTranslations('photoUpload');
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return setMsg({ ok: false, text: t('type') });
    if (file.size > 5 * 1024 * 1024) return setMsg({ ok: false, text: t('size') });
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_BASE}/api/players/${playerId}/photo`, { method: 'POST', credentials: 'include', body: fd });
      const body = (await res.json().catch(() => ({}))) as { photoUrl?: string; message?: string | string[] };
      if (!res.ok || !body.photoUrl) throw new Error(Array.isArray(body.message) ? body.message.join(', ') : (body.message ?? t('failed')));
      setMsg({ ok: true, text: t('done') });
      onDone?.(body.photoUrl);
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : t('failed') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? 'flex flex-wrap items-center gap-2' : 'mt-4 rounded-card bg-surface-card p-4 shadow-card'}>
      {!compact && <p className="mb-2 text-sm font-semibold">{t('title')}</p>}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onFile} aria-label={t('choose')} />
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className="min-h-9 rounded-md border border-border bg-surface-raised px-3 text-sm font-semibold hover:border-accent-500 disabled:opacity-50"
      >
        {busy ? t('uploading') : t('choose')}
      </button>
      {!compact && <p className="mt-1 text-xs text-muted">{t('hint')}</p>}
      {msg && (
        <p role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-win' : 'text-danger'}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
