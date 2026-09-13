'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api, ApiError } from '@/lib/api';

export default function ContactPage() {
  const t = useTranslations('contactPage');
  const locale = useLocale();
  const [form, setForm] = useState({ name: '', email: '', subject: '', body: '' });
  const [website, setWebsite] = useState(''); // honeypot — odam ko'rmaydi
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const input =
    'w-full rounded-md border border-border px-3 py-2.5 outline-none focus:border-accent-500';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/contact', {
        ...form,
        subject: form.subject || undefined,
        website: website || undefined,
        locale,
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="font-heading text-3xl font-extrabold uppercase tracking-tight">
        {t('title')}
      </h1>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        {sent ? (
          <div className="rounded-card bg-win/10 p-6 font-semibold text-win">
            {t('sent')}
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4 rounded-card bg-surface-card p-6 shadow-card">
            <input required minLength={2} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={t('name')} className={input} />
            <input type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} placeholder={t('email')} className={input} />
            <input value={form.subject} onChange={(e) => set('subject', e.target.value)} placeholder={t('subject')} className={input} />
            <textarea required minLength={10} rows={5} value={form.body} onChange={(e) => set('body', e.target.value)} placeholder={t('message')} className={input} />
            {/* Honeypot: botlarga qarshi, vizual yashirin */}
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute -left-[9999px] h-0 w-0 opacity-0"
            />
            {error && (
              <p className="rounded-md bg-accent-100 px-3 py-2 text-sm text-danger">{error}</p>
            )}
            <button type="submit" disabled={busy} className="rounded-md bg-accent-600 px-8 py-3 font-semibold text-white hover:bg-accent-500 disabled:opacity-60">
              {busy ? '...' : t('send')}
            </button>
          </form>
        )}

        <div className="rounded-card bg-navy-900 p-6 text-white">
          <h2 className="font-heading font-bold uppercase">{t('address')}</h2>
          <p className="mt-2 text-white/80">{t('addressText')}</p>
          <p className="mt-4 text-white/80">info@uztt.uz</p>
          <p className="mt-1 text-white/80">+998 71 000 00 00</p>
        </div>
      </div>
    </div>
  );
}
