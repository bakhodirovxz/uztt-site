'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { api, ApiError, type AuthUser } from '@/lib/api';

export default function LoginPage() {
  const t = useTranslations('login');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post<{ user: AuthUser }>('/auth/login', { email, password });
      router.push('/panel');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? t('failed') : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <h1 className="font-heading text-3xl font-extrabold uppercase tracking-tight">
        {t('title')}
      </h1>

      <form
        onSubmit={onSubmit}
        className="mt-8 space-y-5 rounded-card bg-surface-card p-6 shadow-card"
      >
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">{t('email')}</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border px-3 py-2.5 outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">{t('password')}</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-border px-3 py-2.5 outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
          />
        </label>

        {error && (
          <p className="rounded-md bg-accent-100 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-accent-600 py-3 font-semibold text-white transition-colors hover:bg-accent-500 disabled:opacity-60"
        >
          {busy ? t('submitting') : t('submit')}
        </button>
      </form>
    </div>
  );
}
