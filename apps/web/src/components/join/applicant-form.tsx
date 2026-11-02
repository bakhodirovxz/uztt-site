'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';

const CATS = ['INTERNATIONAL', 'NATIONAL', 'FIRST', 'SECOND', 'THIRD'] as const;
const input = 'w-full rounded-md border border-border px-3 py-2.5 outline-none focus:border-accent-500';

/** Yorliqli maydon. Modul darajasida: render ichida yaratilsa har harfda input qayta o'rnatilib fokus yo'qolardi. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block"><span className="mb-1 block text-sm font-semibold">{label}</span>{children}</label>
  );
}

interface ClubOpt { id: string; name: string }

/** Hakam yoki murabbiy bo'lib ro'yxatdan o'tish. Rol berilmaydi — administrator tasdiqlaydi. */
export function ApplicantForm({ kind }: { kind: 'referee' | 'coach' }) {
  const t = useTranslations('join');
  const [f, setF] = useState({
    email: '', password: '', firstName: '', lastName: '', phone: '', region: '',
    category: '', certification: '', since: '', bio: '', licenseNumber: '', clubId: '',
  });
  const [regions, setRegions] = useState<string[]>([]);
  const [clubQ, setClubQ] = useState('');
  const [clubHits, setClubs] = useState<ClubOpt[]>([]);
  // Qisqa so'rovda ro'yxat ko'rsatilmaydi (effect ichida tozalash o'rniga hosila qiymat)
  const clubs = kind === 'coach' && clubQ.trim().length >= 2 ? clubHits : [];
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    api.get<string[]>('/players/regions').then((r) => setRegions(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (kind !== 'coach' || clubQ.trim().length < 2) return;
    const id = setTimeout(() => {
      api.get<{ rows: ClubOpt[] }>(`/clubs?q=${encodeURIComponent(clubQ.trim())}`).then((r) => setClubs(r.rows ?? [])).catch(() => setClubs([]));
    }, 300);
    return () => clearTimeout(id);
  }, [clubQ, kind]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const body: Record<string, unknown> = {
        email: f.email, password: f.password, firstName: f.firstName, lastName: f.lastName,
        phone: f.phone || undefined, region: f.region || undefined, bio: f.bio || undefined,
      };
      if (kind === 'referee') {
        body.category = f.category || undefined;
        body.certification = f.certification || undefined;
        body.since = f.since ? Number(f.since) : undefined;
      } else {
        body.clubId = f.clubId || undefined;
        body.licenseNumber = f.licenseNumber || undefined;
      }
      await api.post(`/applications/${kind}`, body);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="rounded-card bg-win/10 p-6 font-semibold text-win">{t('success')}</div>
        <Link href="/login" className="mt-6 inline-flex min-h-11 items-center rounded-md bg-accent-600 px-6 font-semibold text-white">{t('ok')}</Link>
      </div>
    );
  }


  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="font-heading text-3xl font-extrabold uppercase tracking-tight">{kind === 'referee' ? t('refTitle') : t('coachTitle')}</h1>
      <p className="mt-2 text-sm text-muted">{t('intro')}</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-card bg-surface-card p-6 shadow-card">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('firstName')}><input required minLength={2} maxLength={60} value={f.firstName} onChange={(e) => set('firstName', e.target.value)} className={input} /></Field>
          <Field label={t('lastName')}><input required minLength={2} maxLength={60} value={f.lastName} onChange={(e) => set('lastName', e.target.value)} className={input} /></Field>
        </div>
        <Field label={t('email')}><input required type="email" autoComplete="email" maxLength={254} value={f.email} onChange={(e) => set('email', e.target.value)} className={input} /></Field>
        <Field label={t('password')}><input required type="password" autoComplete="new-password" minLength={10} maxLength={128} value={f.password} onChange={(e) => set('password', e.target.value)} className={input} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('phone')}><input type="tel" maxLength={20} value={f.phone} onChange={(e) => set('phone', e.target.value)} className={input} /></Field>
          <Field label={t('region')}>
            <select value={f.region} onChange={(e) => set('region', e.target.value)} className={input}>
              <option value="">—</option>
              {regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
        </div>

        {kind === 'referee' ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('category')}>
                <select value={f.category} onChange={(e) => set('category', e.target.value)} className={input}>
                  <option value="">{t('catNone')}</option>
                  {CATS.map((c) => <option key={c} value={c}>{t(`cat_${c}`)}</option>)}
                </select>
              </Field>
              <Field label={t('since')}><input type="number" min={1950} max={2100} value={f.since} onChange={(e) => set('since', e.target.value)} className={input} /></Field>
            </div>
            <Field label={t('certification')}><input maxLength={120} value={f.certification} onChange={(e) => set('certification', e.target.value)} className={input} /></Field>
          </>
        ) : (
          <>
            <Field label={t('licenseNumber')}><input maxLength={60} value={f.licenseNumber} onChange={(e) => set('licenseNumber', e.target.value)} className={input} /></Field>
            <Field label={t('club')}>
              <input placeholder={t('clubSearch')} value={clubQ} onChange={(e) => { setClubQ(e.target.value); set('clubId', ''); }} className={input} />
              {clubs.length > 0 && (
                <select size={Math.min(5, clubs.length + 1)} value={f.clubId} onChange={(e) => set('clubId', e.target.value)} className={`${input} mt-1`}>
                  <option value="">{t('clubNone')}</option>
                  {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </Field>
          </>
        )}

        <Field label={t('bio')}><textarea rows={3} maxLength={1000} value={f.bio} onChange={(e) => set('bio', e.target.value)} className={input} /></Field>
        {error && <p role="alert" className="rounded-md bg-accent-100 px-3 py-2 text-sm text-danger">{error}</p>}
        <button type="submit" disabled={busy} className="min-h-11 w-full rounded-md bg-accent-600 font-semibold text-white disabled:opacity-60">{t('submit')}</button>
      </form>
    </div>
  );
}
