'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api, ApiError, type AuthUser } from '@/lib/api';

const input = 'w-full rounded-md border border-border px-3 py-2.5 outline-none focus:border-accent-500';

export default function OpenClubPage() {
  const t = useTranslations('join');
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [regions, setRegions] = useState<string[]>([]);
  const [f, setF] = useState({ name: '', clubType: '', regionName: '', districtName: '', address: '', phoneNumber: '', tableCount: '' });
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    api.get<{ user: AuthUser }>('/auth/me').then((r) => setUser(r.user)).catch(() => setUser(null));
    api.get<string[]>('/players/regions').then((r) => setRegions(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const body: Record<string, unknown> = { name: f.name };
      for (const k of ['clubType', 'regionName', 'districtName', 'address', 'phoneNumber'] as const) if (f[k]) body[k] = f[k];
      if (f.tableCount) body.tableCount = Number(f.tableCount);
      await api.post('/clubs/request', body);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (user === undefined) return null;
  if (user === null) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="font-semibold">{t('needLogin')}</p>
        <Link href="/login" className="mt-4 inline-flex min-h-11 items-center rounded-md bg-accent-600 px-6 font-semibold text-white">Login</Link>
      </div>
    );
  }
  if (done) return <div className="mx-auto max-w-md px-4 py-16 text-center"><div className="rounded-card bg-win/10 p-6 font-semibold text-win">{t('openSuccess')}</div></div>;

  const L = ({ k, children }: { k: string; children: React.ReactNode }) => (
    <label className="block"><span className="mb-1 block text-sm font-semibold">{t(k)}</span>{children}</label>
  );
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="font-heading text-3xl font-extrabold uppercase tracking-tight">{t('openTitle')}</h1>
      <p className="mt-2 text-sm text-muted">{t('openIntro')}</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-card bg-surface-card p-6 shadow-card">
        <L k="clubName"><input required minLength={3} maxLength={120} value={f.name} onChange={(e) => set('name', e.target.value)} className={input} /></L>
        <L k="clubType"><input maxLength={80} value={f.clubType} onChange={(e) => set('clubType', e.target.value)} className={input} /></L>
        <div className="grid grid-cols-2 gap-3">
          <L k="region">
            <select value={f.regionName} onChange={(e) => set('regionName', e.target.value)} className={input}>
              <option value="">—</option>
              {regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </L>
          <L k="district"><input maxLength={80} value={f.districtName} onChange={(e) => set('districtName', e.target.value)} className={input} /></L>
        </div>
        <L k="address"><input maxLength={200} value={f.address} onChange={(e) => set('address', e.target.value)} className={input} /></L>
        <div className="grid grid-cols-2 gap-3">
          <L k="phone"><input type="tel" maxLength={20} value={f.phoneNumber} onChange={(e) => set('phoneNumber', e.target.value)} className={input} /></L>
          <L k="tableCount"><input type="number" min={0} max={200} value={f.tableCount} onChange={(e) => set('tableCount', e.target.value)} className={input} /></L>
        </div>
        {error && <p role="alert" className="rounded-md bg-accent-100 px-3 py-2 text-sm text-danger">{error}</p>}
        <button disabled={busy} className="min-h-11 w-full rounded-md bg-accent-600 font-semibold text-white disabled:opacity-60">{t('openSubmit')}</button>
      </form>
    </div>
  );
}
