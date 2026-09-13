'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';

interface AgeCategory {
  id: string;
  code: string;
  name: string;
  maxAge: number | null;
}

export default function SignupPage() {
  const t = useTranslations('signup');
  const tl = useTranslations('login');
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    gender: 'MALE',
    birthDate: '',
    region: '',
    club: '',
  });
  const [ageCategories, setAgeCategories] = useState<AgeCategory[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    api
      .get<AgeCategory[]>('/draws/age-categories')
      .then(setAgeCategories)
      .catch(() => setAgeCategories([]));
  }, []);

  // Tug'ilgan sanadan yoshga muvofiq toifalar (server ham qayta tekshiradi)
  const eligible = useMemo(() => {
    if (!form.birthDate) return [];
    const age = new Date().getFullYear() - new Date(form.birthDate).getFullYear();
    return ageCategories.filter((c) => c.maxAge === null || age <= c.maxAge);
  }, [form.birthDate, ageCategories]);

  // Sana o'zgarsa — endi mos kelmaydigan tanlovlar o'z-o'zidan tushib qoladi
  // (holatni effektda tozalash o'rniga render paytida hisoblaymiz)
  const selected = useMemo(
    () => chosen.filter((c) => eligible.some((e) => e.code === c)),
    [chosen, eligible],
  );

  function toggleCategory(code: string) {
    setChosen((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/registration/signup', {
        ...form,
        club: form.club || undefined,
        ageCategoryCodes: selected.length > 0 ? selected : undefined,
      });
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
        <div className="rounded-card bg-win/10 p-6 text-win">
          <p className="font-semibold">{t('success')}</p>
        </div>
        <Link
          href="/login"
          className="mt-6 inline-flex min-h-11 items-center rounded-md bg-accent-600 px-6 font-semibold text-white"
        >
          {tl('title')}
        </Link>
      </div>
    );
  }

  const input =
    'w-full rounded-md border border-border px-3 py-2.5 outline-none focus:border-accent-500';

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="font-heading text-3xl font-extrabold uppercase tracking-tight">
        {t('title')}
      </h1>

      <form
        onSubmit={onSubmit}
        className="mt-8 space-y-4 rounded-card bg-surface-card p-6 shadow-card"
      >
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">{t('firstName')}</span>
            <input required value={form.firstName} onChange={(e) => set('firstName', e.target.value)} className={input} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">{t('lastName')}</span>
            <input required value={form.lastName} onChange={(e) => set('lastName', e.target.value)} className={input} />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold">{tl('email')}</span>
          <input type="email" required autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={input} />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold">{tl('password')}</span>
          <input type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={(e) => set('password', e.target.value)} className={input} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">{t('gender')}</span>
            <select value={form.gender} onChange={(e) => set('gender', e.target.value)} className={input}>
              <option value="MALE">{t('male')}</option>
              <option value="FEMALE">{t('female')}</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">{t('birthDate')}</span>
            <input type="date" required value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} className={input} />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">{t('region')}</span>
            <input required value={form.region} onChange={(e) => set('region', e.target.value)} className={input} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">{t('club')}</span>
            <input value={form.club} onChange={(e) => set('club', e.target.value)} className={input} />
          </label>
        </div>

        {/* Ishtirok etmoqchi bo'lgan yosh toifalari */}
        <div>
          <span className="mb-1 block text-sm font-semibold">{t('ageCategories')}</span>
          <p className="mb-2 text-xs text-muted">{t('ageCategoriesHint')}</p>
          {!form.birthDate ? (
            <p className="rounded-md border border-dashed border-border px-3 py-2.5 text-sm text-muted">
              {t('ageCategoriesNeedDate')}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {eligible.map((c) => {
                const active = selected.includes(c.code);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCategory(c.code)}
                    aria-pressed={active}
                    className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                      active
                        ? 'border-accent-500 bg-accent-600 text-white'
                        : 'border-border text-muted hover:border-accent-500 hover:text-ink'
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {error && (
          <p className="rounded-md bg-accent-100 px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <button type="submit" disabled={busy} className="w-full rounded-md bg-accent-600 py-3 font-semibold text-white hover:bg-accent-500 disabled:opacity-60">
          {busy ? '...' : t('submit')}
        </button>

        <p className="text-center text-sm text-muted">
          {t('haveAccount')}{' '}
          <Link href="/login" className="inline-block min-h-8 py-1 font-semibold text-accent-400">
            {tl('title')}
          </Link>
        </p>
      </form>
    </div>
  );
}
