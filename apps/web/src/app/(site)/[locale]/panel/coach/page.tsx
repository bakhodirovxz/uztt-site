'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { api, ApiError, type AuthUser } from '@/lib/api';

interface CoachPlayer {
  id: string;
  firstName: string;
  lastName: string;
  gender: string;
  birthDate: string | null;
  region: string;
  rankingPoints: number;
  status: string;
  licenseNumber: string | null;
}
interface CoachProfile {
  id: string;
  club: string | null;
  licenseNumber: string | null;
  bio: string | null;
  players: CoachPlayer[];
}
interface TournamentRow {
  id: string;
  name: string;
  status: string;
}
interface EligibleCat {
  id: string;
  code: string;
  isDefault: boolean;
}

export default function CoachPanelPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<CoachProfile | null>(null);
  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [license, setLicense] = useState('');
  const [club, setClub] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Turnirga yozish holati
  const [regPlayer, setRegPlayer] = useState('');
  const [regTournament, setRegTournament] = useState('');
  // Kategoriyalar qaysi o'quvchi+turnir juftligiga tegishli ekani saqlanadi
  const [catsData, setCatsData] = useState<{
    key: string;
    list: EligibleCat[];
  } | null>(null);
  const [regCat, setRegCat] = useState('');

  const load = useCallback(() => {
    api
      .get<CoachProfile>('/coach/me')
      .then((p) => {
        setProfile(p);
        setClub(p.club ?? '');
      })
      .catch(() => router.replace('/login'));
    api
      .get<TournamentRow[]>('/tournaments')
      .then((ts) => setTournaments(ts.filter((t) => t.status !== 'FINISHED')))
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    api
      .get<{ user: AuthUser }>('/auth/me')
      .then(({ user }) => {
        if (!user.permissions.includes('coach.players.manage')) throw new Error();
        load();
      })
      .catch(() => router.replace('/login'));
  }, [router, load]);

  // O'quvchi + turnir tanlanganda muvofiq kategoriyalar
  const catsKey = regPlayer && regTournament ? `${regTournament}/${regPlayer}` : '';

  useEffect(() => {
    if (!regPlayer || !regTournament) return;
    api
      .get<{ eligible: EligibleCat[] }>(
        `/coach/tournaments/${regTournament}/eligible/${regPlayer}`,
      )
      .then(({ eligible }) => {
        setCatsData({ key: `${regTournament}/${regPlayer}`, list: eligible });
        setRegCat(eligible.find((c) => c.isDefault)?.id ?? '');
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : String(e)));
  }, [regPlayer, regTournament]);

  const cats = catsKey && catsData?.key === catsKey ? catsData.list : [];

  async function act(fn: () => Promise<unknown>, okMsg: string) {
    setError(null);
    setMsg(null);
    try {
      await fn();
      setMsg(okMsg);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }

  if (!profile) {
    return <div className="py-10 text-muted">Yuklanmoqda...</div>;
  }

  const input =
    'rounded-md border border-border px-3 py-2 outline-none focus:border-accent-500';

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-extrabold uppercase">Murabbiy paneli</h1>
      {msg && <p className="mt-3 rounded-md bg-win/10 px-3 py-2 text-sm font-semibold text-win">{msg}</p>}
      {error && <p className="mt-3 rounded-md bg-accent-100 px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Profil + o'quvchi qo'shish */}
        <div>
          <div className="rounded-card bg-surface-card p-5 shadow-card">
            <h2 className="font-heading font-bold">Profil</h2>
            <div className="mt-3 flex gap-2">
              <input
                value={club}
                onChange={(e) => setClub(e.target.value)}
                placeholder="Klub"
                className={`flex-1 ${input}`}
              />
              <button
                type="button"
                onClick={() => act(() => api.put('/coach/me', { club: club || undefined }), 'Profil saqlandi')}
                className="rounded-md bg-navy-900 px-4 py-2 font-semibold text-white"
              >
                Saqlash
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-card bg-surface-card p-5 shadow-card">
            <h2 className="font-heading font-bold">O'quvchi qo'shish</h2>
            <p className="mt-1 text-sm text-muted">
              O'yinchining litsenziya raqamini kiriting (masalan UZ-1001)
            </p>
            <div className="mt-3 flex gap-2">
              <input
                value={license}
                onChange={(e) => setLicense(e.target.value.toUpperCase())}
                placeholder="UZ-____"
                className={`flex-1 font-mono ${input}`}
              />
              <button
                type="button"
                disabled={license.length < 3}
                onClick={() =>
                  act(() => api.post('/coach/players', { licenseNumber: license }), "O'quvchi qo'shildi").then(() => setLicense(''))
                }
                className="rounded-md bg-accent-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
              >
                Qo'shish
              </button>
            </div>
          </div>

          {/* Turnirga yozish */}
          <div className="mt-4 rounded-card bg-surface-card p-5 shadow-card">
            <h2 className="font-heading font-bold">O'quvchini turnirga yozish</h2>
            <div className="mt-3 space-y-2">
              <select value={regPlayer} onChange={(e) => setRegPlayer(e.target.value)} className={`w-full ${input}`}>
                <option value="">O'quvchi...</option>
                {profile.players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName} ({p.licenseNumber})
                  </option>
                ))}
              </select>
              <select value={regTournament} onChange={(e) => setRegTournament(e.target.value)} className={`w-full ${input}`}>
                <option value="">Turnir...</option>
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {cats.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {cats.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setRegCat(c.id)}
                      className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${
                        regCat === c.id
                          ? 'border-accent-600 bg-accent-600 text-white'
                          : 'border-border'
                      }`}
                    >
                      {c.code}
                      {c.isDefault && <span className="ml-1 text-xs opacity-75">(o'z guruhi)</span>}
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                disabled={!regPlayer || !regTournament}
                onClick={() =>
                  act(
                    () =>
                      api.post(`/coach/tournaments/${regTournament}/register`, {
                        playerId: regPlayer,
                        categoryId: regCat || undefined,
                      }),
                    'Turnirga yozildi',
                  )
                }
                className="rounded-md bg-accent-600 px-6 py-2 font-semibold text-white disabled:opacity-50"
              >
                Yozish
              </button>
            </div>
          </div>
        </div>

        {/* O'quvchilar ro'yxati */}
        <div>
          <h2 className="font-heading font-bold uppercase">
            Mening o'quvchilarim ({profile.players.length})
          </h2>
          <div className="mt-3 space-y-2">
            {profile.players.length === 0 && (
              <p className="text-sm text-muted">Hozircha o'quvchi qo'shilmagan</p>
            )}
            {profile.players.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-card bg-surface-card px-4 py-3 shadow-card">
                <div className="min-w-0 flex-1">
                  <span className="font-semibold">{p.firstName} {p.lastName}</span>
                  <span className="ml-2 text-xs text-muted">
                    {p.gender === 'MALE' ? '♂' : '♀'} · {p.region} · {p.rankingPoints} ball
                  </span>
                </div>
                <span className="font-mono text-xs text-muted">{p.licenseNumber}</span>
                <button
                  type="button"
                  onClick={() => act(() => api.del(`/coach/players/${p.id}`), "O'chirildi")}
                  className="text-sm font-semibold text-live"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
