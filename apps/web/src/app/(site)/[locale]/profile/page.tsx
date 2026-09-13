'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import { groupLabel, type EventType } from '@/lib/groups';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface MyPlayer {
  id: string;
  firstName: string;
  lastName: string;
  gender: 'MALE' | 'FEMALE';
  status: string;
  licenseNumber: string | null;
  region: string;
  club: string | null;
  rankingPoints: number;
  declaredCategories: Array<{ ageCategory: { code: string; name: string } }>;
  registrations: Array<{
    id: string;
    status: string;
    statusReason: string | null;
    teamName: string | null;
    partner: { firstName: string; lastName: string } | null;
    category: {
      gender: 'MALE' | 'FEMALE' | null;
      eventType: EventType;
      ageCategory: { code: string; name: string };
      tournament: { slug: string; name: string; startDate: string };
    };
  }>;
  documents: Array<{ id: string; type: string; createdAt: string }>;
}

interface EligibleCat {
  id: string;
  code: string;
  name?: string;
  gender: 'MALE' | 'FEMALE' | null;
  eventType: EventType;
  isDefault: boolean;
}

interface TournamentRow {
  id: string;
  name: string;
  status: string;
}

interface PlayerRow {
  id: string;
  firstName: string;
  lastName: string;
  gender: 'MALE' | 'FEMALE';
}

export default function ProfilePage() {
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const tg = useTranslations('groups');
  const router = useRouter();

  const [player, setPlayer] = useState<MyPlayer | null>(null);
  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [selectedT, setSelectedT] = useState('');
  // Kategoriyalar qaysi turnirga tegishli ekani saqlanadi — turnir almashganda
  // ro'yxatni effektda tozalash o'rniga render paytida chetlab o'tamiz
  const [catsData, setCatsData] = useState<{
    tournamentId: string;
    list: EligibleCat[];
  } | null>(null);
  const [selectedCat, setSelectedCat] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [teamName, setTeamName] = useState('');
  const [allPlayers, setAllPlayers] = useState<PlayerRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Hujjat formasi
  const [docType, setDocType] = useState('PASSPORT');
  const [docNumber, setDocNumber] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);

  const load = useCallback(() => {
    api
      .get<MyPlayer>('/registration/me')
      .then(setPlayer)
      .catch(() => router.replace('/login'));
    api
      .get<TournamentRow[]>('/tournaments')
      .then((ts) => setTournaments(ts.filter((x) => x.status !== 'FINISHED')))
      .catch(() => {});
    api
      .get<{ rows: PlayerRow[] }>('/players?pageSize=500')
      .then((r) => setAllPlayers(r.rows))
      .catch(() => setAllPlayers([]));
  }, [router]);

  useEffect(load, [load]);

  // Turnir tanlanganda muvofiq kategoriyalarni yuklaymiz
  useEffect(() => {
    if (!selectedT) return;
    api
      .get<{ eligible: EligibleCat[] }>(
        `/registration/tournaments/${selectedT}/eligible-categories`,
      )
      .then(({ eligible }) => {
        setCatsData({ tournamentId: selectedT, list: eligible });
        setSelectedCat(eligible.find((c) => c.isDefault)?.id ?? '');
        setPartnerId('');
        setTeamName('');
      })
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : String(e)),
      );
  }, [selectedT]);

  const cats =
    catsData?.tournamentId === selectedT && selectedT ? catsData.list : [];
  const currentCat = cats.find((c) => c.id === selectedCat) ?? null;
  const needsPartner =
    currentCat?.eventType === 'DOUBLES' ||
    currentCat?.eventType === 'MIXED_DOUBLES';
  const needsTeam = currentCat?.eventType === 'TEAM';

  // Juftlikda — bir xil jins, aralash juftlikda — qarama-qarshi jins
  const partnerOptions = allPlayers.filter((p) => {
    if (!player || p.id === player.id) return false;
    if (currentCat?.eventType === 'MIXED_DOUBLES') return p.gender !== player.gender;
    if (currentCat?.eventType === 'DOUBLES') return p.gender === player.gender;
    return false;
  });

  // Guruh almashsa sherik/jamoa maydonlari tozalanadi
  function chooseCat(id: string) {
    setSelectedCat(id);
    setPartnerId('');
    setTeamName('');
  }

  async function register() {
    setError(null);
    setMsg(null);
    try {
      await api.post(`/registration/tournaments/${selectedT}/register`, {
        categoryId: selectedCat || undefined,
        partnerPlayerId: needsPartner ? partnerId || undefined : undefined,
        teamName: needsTeam ? teamName || undefined : undefined,
      });
      setMsg(t('registered'));
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }

  async function uploadDoc(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    try {
      const form = new FormData();
      form.append('type', docType);
      if (docNumber) form.append('documentNumber', docNumber);
      if (docFile) form.append('file', docFile);
      const res = await fetch(`${API_BASE}/api/registration/documents`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      if (!res.ok) {
        const d = (await res.json()) as { message?: string };
        throw new Error(d.message ?? 'Xatolik');
      }
      setMsg(t('docUploaded'));
      setDocNumber('');
      setDocFile(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (!player) {
    return <div className="mx-auto max-w-4xl px-4 py-16 text-muted">{tc('loading')}</div>;
  }

  const input =
    'w-full rounded-md border border-border px-3 py-2.5 outline-none focus:border-accent-500';

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex flex-wrap items-center gap-4">
        <div className="grid size-16 place-items-center rounded-full bg-navy-800 font-heading text-xl font-extrabold text-white">
          {player.firstName[0]}
          {player.lastName[0]}
        </div>
        <div>
          <h1 className="font-heading text-3xl font-extrabold uppercase tracking-tight">
            {player.firstName} {player.lastName}
          </h1>
          <p className="text-sm text-muted">
            {player.region}
            {player.club ? ` · ${player.club}` : ''}
            {player.licenseNumber ? ` · ${t('license')}: ${player.licenseNumber}` : ''}
          </p>
        </div>
        <span
          className={`ml-auto rounded-full px-3 py-1 text-xs font-bold ${
            player.status === 'ACTIVE'
              ? 'bg-win/15 text-win'
              : 'bg-gold-100 text-gold-600'
          }`}
        >
          {t(`status_${player.status}`)}
        </span>
      </div>

      {msg && <p className="mt-4 rounded-md bg-win/10 px-3 py-2 text-sm font-semibold text-win">{msg}</p>}
      {error && <p className="mt-4 rounded-md bg-accent-100 px-3 py-2 text-sm text-danger">{error}</p>}

      {/* Tasdiqlanmaguncha turnirda ishtirok etib bo'lmaydi */}
      {player.status !== 'ACTIVE' && (
        <p className="mt-4 rounded-card border border-gold-500/40 bg-gold-100 px-4 py-3 text-sm font-semibold text-gold-600">
          {t('pendingNotice')}
        </p>
      )}

      {/* O'yinchi tanlagan yosh toifalari */}
      {player.declaredCategories.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">{t('myAgeCategories')}:</span>
          {player.declaredCategories.map((d) => (
            <span
              key={d.ageCategory.code}
              className="rounded-full bg-navy-800 px-3 py-1 text-xs font-bold text-white"
            >
              {d.ageCategory.name}
            </span>
          ))}
        </div>
      )}

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {/* Turnirga yozilish */}
        <div className="rounded-card bg-surface-card p-5 shadow-card">
          <h2 className="font-heading font-bold uppercase">{t('registerTournament')}</h2>
          <select value={selectedT} onChange={(e) => setSelectedT(e.target.value)} className={`mt-3 ${input}`}>
            <option value="">—</option>
            {tournaments.map((tr) => (
              <option key={tr.id} value={tr.id}>{tr.name}</option>
            ))}
          </select>

          {selectedT && cats.length === 0 && (
            <p className="mt-3 rounded-md border border-dashed border-border px-3 py-2.5 text-sm text-muted">
              {t('noEligibleGroups')}
            </p>
          )}

          {cats.length > 0 && (
            <>
              <p className="mt-3 text-sm text-muted">{t('chooseCategory')}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {cats.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => chooseCat(c.id)}
                    className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${
                      selectedCat === c.id
                        ? 'border-accent-600 bg-accent-600 text-white'
                        : 'border-border'
                    }`}
                  >
                    {c.code} · {groupLabel(c.eventType, c.gender, tg)}
                    {c.isDefault && (
                      <span className="ml-1 text-xs opacity-75">({t('default')})</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Juftlik uchun sherik */}
              {needsPartner && (
                <label className="mt-3 block">
                  <span className="mb-1 block text-sm font-semibold">{t('partner')}</span>
                  <select
                    value={partnerId}
                    onChange={(e) => setPartnerId(e.target.value)}
                    className={input}
                  >
                    <option value="">—</option>
                    {partnerOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.lastName} {p.firstName}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {/* Jamoaviy uchun jamoa nomi */}
              {needsTeam && (
                <label className="mt-3 block">
                  <span className="mb-1 block text-sm font-semibold">{t('teamName')}</span>
                  <input
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    className={input}
                  />
                </label>
              )}

              <button
                type="button"
                onClick={register}
                disabled={
                  player.status !== 'ACTIVE' ||
                  (needsPartner && !partnerId) ||
                  (needsTeam && !teamName.trim())
                }
                className="mt-4 rounded-md bg-accent-600 px-6 py-2.5 font-semibold text-white hover:bg-accent-500 disabled:opacity-50"
              >
                {t('register')}
              </button>
            </>
          )}
        </div>

        {/* Hujjatlar */}
        <div className="rounded-card bg-surface-card p-5 shadow-card">
          <h2 className="font-heading font-bold uppercase">{t('documents')}</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {player.documents.map((d) => (
              <li key={d.id} className="flex items-center gap-2">
                <span className="text-win">✓</span> {t(`docType_${d.type}`)}
                <span className="text-xs text-muted">
                  {new Date(d.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
          <form onSubmit={uploadDoc} className="mt-3 space-y-2">
            <select value={docType} onChange={(e) => setDocType(e.target.value)} className={input}>
              {['PASSPORT', 'ID_CARD', 'BIRTH_CERTIFICATE'].map((tp) => (
                <option key={tp} value={tp}>{t(`docType_${tp}`)}</option>
              ))}
            </select>
            <input value={docNumber} onChange={(e) => setDocNumber(e.target.value)} placeholder={t('docNumber')} className={input} />
            <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
            <button type="submit" disabled={!docNumber && !docFile} className="rounded-md bg-navy-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {t('docUpload')}
            </button>
          </form>
        </div>
      </div>

      {/* Registratsiyalar */}
      <h2 className="mt-10 font-heading text-xl font-bold uppercase tracking-wide">
        {t('myRegistrations')}
      </h2>
      <div className="mt-4 space-y-2">
        {player.registrations.map((r) => (
          <div key={r.id} className="rounded-card bg-surface-card px-4 py-3 shadow-card">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded bg-navy-800 px-2 py-0.5 text-xs font-bold text-white">
                {r.category.ageCategory.code}
              </span>
              <span className="rounded bg-surface-raised px-2 py-0.5 text-xs font-semibold text-muted">
                {groupLabel(r.category.eventType, r.category.gender, tg)}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">
                {r.category.tournament.name}
                {r.partner && (
                  <span className="ml-2 text-sm text-muted">
                    · {r.partner.lastName} {r.partner.firstName}
                  </span>
                )}
                {r.teamName && (
                  <span className="ml-2 text-sm text-muted">· {r.teamName}</span>
                )}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  r.status === 'CONFIRMED'
                    ? 'bg-win/15 text-win'
                    : r.status === 'REJECTED' || r.status === 'WITHDRAWN'
                      ? 'bg-accent-100 text-danger'
                      : 'bg-gold-100 text-gold-600'
                }`}
              >
                {t(`regStatus_${r.status}`)}
              </span>
            </div>
            {r.statusReason && (
              <p className="mt-2 text-sm text-muted">
                {t('statusReason')}: {r.statusReason}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
