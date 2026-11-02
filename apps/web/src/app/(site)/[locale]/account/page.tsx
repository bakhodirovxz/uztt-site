'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { api, ApiError, type AuthUser } from '@/lib/api';

const input = 'w-full rounded-md border border-border px-3 py-2.5 outline-none focus:border-accent-500';

/** Hisob xavfsizligi: parolni almashtirish. Boshlang'ich parol berilgan foydalanuvchi shu yerga yo'naltiriladi. */
export default function AccountPage() {
  const t = useTranslations('account');
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<{ user: AuthUser }>('/auth/me').then((r) => setUser(r.user)).catch(() => router.replace('/login'));
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== again) return setError(t('mismatch'));
    setBusy(true);
    try {
      await api.post('/auth/change-password', { currentPassword: cur, newPassword: next });
      setDone(true);
      setUser((u) => (u ? { ...u, mustChangePassword: false } : u));
      setTimeout(() => {
        router.push(user && user.permissions.length > 0 ? '/panel' : '/profile');
        router.refresh();
      }, 1200);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="font-heading text-3xl font-extrabold uppercase tracking-tight">{t('title')}</h1>
      <p className="mt-1 text-sm text-muted">{user.email}</p>
      {user.mustChangePassword && (
        <p role="alert" className="mt-4 rounded-md bg-gold-100 px-4 py-3 text-sm font-semibold text-gold-600">{t('required')}</p>
      )}
      <form onSubmit={submit} className="mt-6 space-y-4 rounded-card bg-surface-card p-6 shadow-card">
        <label className="block"><span className="mb-1 block text-sm font-semibold">{t('current')}</span>
          <input required type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} className={input} /></label>
        <label className="block"><span className="mb-1 block text-sm font-semibold">{t('new')}</span>
          <input required type="password" autoComplete="new-password" minLength={10} maxLength={128} value={next} onChange={(e) => setNext(e.target.value)} className={input} /></label>
        <label className="block"><span className="mb-1 block text-sm font-semibold">{t('again')}</span>
          <input required type="password" autoComplete="new-password" minLength={10} maxLength={128} value={again} onChange={(e) => setAgain(e.target.value)} className={input} /></label>
        {error && <p role="alert" className="rounded-md bg-accent-100 px-3 py-2 text-sm text-danger">{error}</p>}
        {done && <p role="status" className="rounded-md bg-win/10 px-3 py-2 text-sm font-semibold text-win">{t('saved')}</p>}
        <button disabled={busy || done} className="min-h-11 w-full rounded-md bg-accent-600 font-semibold text-white disabled:opacity-60">{t('submit')}</button>
        <p className="text-xs text-muted">{t('hint')}</p>
      </form>
    </div>
  );
}
