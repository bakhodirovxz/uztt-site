'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { api, ApiError, type AuthUser } from '@/lib/api';
import { subscribeToMatch, type MatchPayload } from '@/lib/socket';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function RefereePage() {
  const t = useTranslations('referee');
  const tc = useTranslations('common');
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [matches, setMatches] = useState<MatchPayload[]>([]);
  const [selected, setSelected] = useState<MatchPayload | null>(null);

  useEffect(() => {
    api
      .get<{ user: AuthUser }>('/auth/me')
      .then(({ user }) => {
        if (!user.permissions.includes('match.score')) throw new Error();
        setAuthorized(true);
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  const loadMatches = useCallback(() => {
    api
      .get<MatchPayload[]>('/matches/referee/list')
      .then(setMatches)
      .catch(() => setMatches([]));
  }, []);

  useEffect(() => {
    if (authorized) loadMatches();
  }, [authorized, loadMatches]);

  if (!authorized) {
    return <div className="p-8 text-muted">{tc('loading')}</div>;
  }

  if (selected) {
    return (
      <ScoreScreen
        match={selected}
        onBack={() => {
          setSelected(null);
          loadMatches();
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-heading text-3xl font-extrabold uppercase tracking-tight">
        {t('title')}
      </h1>
      <p className="mt-1 text-muted">{t('chooseTable')}</p>
      {matches.length === 0 ? (
        <p className="mt-6 text-muted">{t('noMatches')}</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {matches.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelected(m)}
              className="rounded-card bg-surface-card p-5 text-left shadow-card transition-shadow hover:shadow-card-hover"
            >
              <div className="font-heading text-2xl font-extrabold">
                {m.tableNumber ? `#${m.tableNumber}` : '—'}
              </div>
              <div className="mt-1 text-sm text-muted">
                {m.status === 'LIVE' ? (
                  <span className="font-bold text-live">LIVE</span>
                ) : m.scheduledAt ? (
                  // Vaqt belgilanmagan bo'lsa "hozir" deb ko'rsatish chalg'itardi
                  new Date(m.scheduledAt).toLocaleTimeString('uz-UZ', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                ) : (
                  '—'
                )}
              </div>
              {/* Ismlar tasdiqlashdan keyin ko'rinadi (legacy UX) */}
              {m.refereeVerified && (
                <div className="mt-2 text-sm font-medium">
                  {m.player1Name} — {m.player2Name}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      <RefereeProfileCard />
    </div>
  );
}

// ==================== HAKAM PROFILI VA STATISTIKASI ====================

interface RefereeProfile {
  certification: string | null;
  region: string | null;
  since: number | null;
  bio: string | null;
}
interface RefereeStats {
  matches: number;
  finished: number;
  cards: number;
  disqualifications: number;
}

/** O'z profili: statistika ko'rinib turadi, tahrirlash ochilganda formaga aylanadi */
function RefereeProfileCard() {
  const t = useTranslations('referee');
  const [stats, setStats] = useState<RefereeStats | null>(null);
  const [form, setForm] = useState<RefereeProfile>({
    certification: '',
    region: '',
    since: null,
    bio: '',
  });
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    api
      .get<{ profile: RefereeProfile | null; stats: RefereeStats }>('/referee/me')
      .then((res) => {
        setStats(res.stats);
        if (res.profile) setForm(res.profile);
      })
      .catch(() => undefined);
  }, []);

  useEffect(load, [load]);

  async function save() {
    await api
      .put('/referee/me', {
        certification: form.certification || undefined,
        region: form.region || undefined,
        since: form.since ? Number(form.since) : undefined,
        bio: form.bio || undefined,
      })
      .catch(() => undefined);
    setEditing(false);
    setSaved(true);
    load();
  }

  const input =
    'w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent-500';

  return (
    <section className="mt-10 rounded-card border border-border bg-surface-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-bold uppercase">
          {t('profileTitle')}
        </h2>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="inline-flex min-h-9 items-center rounded-md border border-border px-3.5 text-sm font-semibold hover:border-accent-500"
        >
          {editing ? t('profileCancel') : t('profileEdit')}
        </button>
      </div>

      {stats && (
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              [t('statMatches'), stats.matches],
              [t('statFinished'), stats.finished],
              [t('statCards'), stats.cards],
              [t('statDq'), stats.disqualifications],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-md bg-surface-raised px-3 py-2.5">
              <dt className="text-xs uppercase tracking-wider text-muted">
                {label}
              </dt>
              <dd className="font-heading text-xl font-extrabold tabular-nums">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {editing ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs uppercase tracking-wider text-muted">
              {t('certification')}
            </span>
            <input
              value={form.certification ?? ''}
              onChange={(e) => setForm({ ...form, certification: e.target.value })}
              className={input}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs uppercase tracking-wider text-muted">
              {t('regionLabel')}
            </span>
            <input
              value={form.region ?? ''}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
              className={input}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs uppercase tracking-wider text-muted">
              {t('since')}
            </span>
            <input
              type="number"
              value={form.since ?? ''}
              onChange={(e) =>
                setForm({ ...form, since: Number(e.target.value) || null })
              }
              className={input}
            />
          </label>
          <div className="sm:col-span-3">
            <button
              type="button"
              onClick={save}
              className="inline-flex min-h-10 items-center rounded-md bg-accent-600 px-5 font-semibold text-white hover:bg-accent-500"
            >
              {t('profileSave')}
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">
          {[form.certification, form.region, form.since]
            .filter(Boolean)
            .join(' · ') || t('profileEmpty')}
          {saved && <span className="ml-2 text-win">✓</span>}
        </p>
      )}
    </section>
  );
}

// ==================== KOD TASDIQLASH + HISOB EKRANI ====================

function ScoreScreen({
  match: initial,
  onBack,
}: {
  match: MatchPayload;
  onBack: () => void;
}) {
  const t = useTranslations('referee');
  const [match, setMatch] = useState(initial);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dqOpen, setDqOpen] = useState(false);

  useEffect(() => {
    return subscribeToMatch(initial.id, (p) => {
      setMatch((prev) => (p.seq >= prev.seq ? p : prev));
    });
  }, [initial.id]);

  async function act(path: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.post<MatchPayload>(
        `/matches/${match.id}${path}`,
        body,
      );
      setMatch((prev) => (updated.seq >= prev.seq ? updated : prev));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  // --- Kod ekrani ---
  if (!match.refereeVerified) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center">
        <button type="button" onClick={onBack} className="text-sm text-muted hover:text-accent-400">
          ← {t('back')}
        </button>
        <h2 className="mt-4 font-heading text-2xl font-extrabold uppercase">
          {t('enterCode')}
        </h2>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          className="mt-6 w-full rounded-md border border-border bg-surface-card px-4 py-4 text-center font-heading text-3xl font-extrabold tracking-[0.4em] outline-none focus:border-accent-500"
          placeholder="······"
        />
        {error && <p className="mt-3 text-sm text-accent-400">{error}</p>}
        <button
          type="button"
          disabled={code.length !== 6 || busy}
          onClick={() => act('/verify', { code })}
          className="mt-5 w-full rounded-md bg-accent-600 py-3.5 font-semibold text-white hover:bg-accent-500 disabled:opacity-50"
        >
          {t('verify')}
        </button>
      </div>
    );
  }

  const finished = match.status === 'FINISHED';

  // --- Hisob ekrani ---
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="text-sm text-muted hover:text-accent-400">
          ← {t('back')}
        </button>
        <span className="text-sm text-muted">
          Best of {match.bestOf} · #{match.tableNumber ?? '—'}
        </span>
      </div>

      {error && (
        <p className="mt-3 rounded-md bg-accent-100 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4">
        {([1, 2] as const).map((slot) => {
          const name = slot === 1 ? match.player1Name : match.player2Name;
          const current = slot === 1 ? match.currentSetP1 : match.currentSetP2;
          const setsWon =
            slot === 1 ? match.player1SetsWon : match.player2SetsWon;
          const cards = match.cards.filter((c) => c.player === slot);
          return (
            <div
              key={slot}
              className="rounded-card bg-surface-card p-5 text-center shadow-card"
            >
              <div className="min-h-12 font-heading text-lg font-bold">
                {name}
                <div className="mt-1 flex justify-center gap-1">
                  {cards.map((c, i) => (
                    <span
                      key={i}
                      className={`inline-block h-4 w-3 rounded-[2px] ${
                        c.type === 'YELLOW' ? 'bg-gold-500' : 'bg-live'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="my-3 font-heading text-7xl font-extrabold tabular-nums">
                {current}
              </div>
              <div className="text-sm text-muted">
                {t('point')}lar seti: {setsWon}
              </div>
              <button
                type="button"
                disabled={busy || finished}
                onClick={() => act('/point', { player: slot })}
                className="mt-4 w-full rounded-md bg-accent-600 py-6 font-heading text-3xl font-extrabold text-white hover:bg-accent-500 active:scale-[0.98] disabled:opacity-40"
              >
                +1
              </button>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={busy || finished}
                  onClick={() => act('/card', { player: slot, cardType: 'YELLOW' })}
                  className="flex-1 rounded-md bg-gold-500 py-2 text-sm font-semibold text-navy-900 disabled:opacity-40"
                >
                  {t('yellowCard')}
                </button>
                <button
                  type="button"
                  disabled={busy || finished}
                  onClick={() => act('/card', { player: slot, cardType: 'RED' })}
                  className="flex-1 rounded-md bg-live py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {t('redCard')}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Setlar tarixi */}
      {match.sets.length > 0 && (
        <div className="mt-4 text-center text-sm text-muted">
          {match.sets.map((s) => `${s.p1Points}-${s.p2Points}`).join(' · ')}
        </div>
      )}

      {finished && match.winnerInfo && (
        <div className="mt-5 rounded-card bg-navy-900 p-5 text-center text-white">
          <div className="text-sm uppercase tracking-wider text-white/60">
            {t('matchFinished')}
          </div>
          <div className="mt-1 font-heading text-2xl font-extrabold">
            {match.winnerInfo.name} (+{match.winnerInfo.pointsAwarded})
          </div>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => act('/undo')}
          className="flex-1 rounded-md border border-border bg-surface-card py-3 font-semibold hover:border-accent-500"
        >
          ↩ {t('undo')}
        </button>
        <button
          type="button"
          disabled={busy || finished}
          onClick={() => setDqOpen(true)}
          className="flex-1 rounded-md border border-live py-3 font-semibold text-live hover:bg-live hover:text-white disabled:opacity-40"
        >
          {t('disqualify')}
        </button>
      </div>

      {dqOpen && (
        <DisqualifyDialog
          match={match}
          onClose={() => setDqOpen(false)}
          onDone={(m) => {
            setDqOpen(false);
            setMatch((prev) => (m.seq >= prev.seq ? m : prev));
          }}
        />
      )}
    </div>
  );
}

// ==================== DISKVALIFIKATSIYA DIALOGI ====================

function DisqualifyDialog({
  match,
  onClose,
  onDone,
}: {
  match: MatchPayload;
  onClose: () => void;
  onDone: (m: MatchPayload) => void;
}) {
  const t = useTranslations('referee');
  const [player, setPlayer] = useState<1 | 2>(1);
  const [reason, setReason] = useState('');
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function toggleRecord() {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = () => {
        setAudioBlob(new Blob(chunksRef.current, { type: 'audio/webm' }));
        stream.getTracks().forEach((tr) => tr.stop());
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch {
      setError('Mikrofonga ruxsat berilmadi');
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('player', String(player));
      if (reason) form.append('reason', reason);
      if (audioBlob) form.append('audio', audioBlob, 'reason.webm');
      const res = await fetch(`${API_BASE}/api/matches/${match.id}/disqualify`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      const data = (await res.json()) as MatchPayload & { message?: string };
      if (!res.ok) throw new Error(data.message ?? 'Xatolik');
      onDone(data);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-950/70 p-4">
      <div className="w-full max-w-md rounded-card bg-surface-card p-6 shadow-card-hover">
        <h3 className="font-heading text-xl font-extrabold uppercase">
          {t('disqualify')}
        </h3>

        <div className="mt-4 flex gap-2">
          {([1, 2] as const).map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => setPlayer(slot)}
              className={`flex-1 rounded-md border px-3 py-2.5 text-sm font-semibold ${
                player === slot
                  ? 'border-live bg-live text-white'
                  : 'border-border'
              }`}
            >
              {slot === 1 ? match.player1Name : match.player2Name}
            </button>
          ))}
        </div>

        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('dqReason')}
          rows={3}
          className="mt-4 w-full rounded-md border border-border px-3 py-2.5 outline-none focus:border-accent-500"
        />

        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={toggleRecord}
            className={`rounded-md px-4 py-2.5 text-sm font-semibold ${
              recording
                ? 'animate-pulse bg-live text-white'
                : 'border border-border'
            }`}
          >
            {recording ? `■ ${t('dqStop')}` : `● ${t('dqRecord')}`}
          </button>
          {audioBlob && !recording && (
            <audio controls src={URL.createObjectURL(audioBlob)} className="h-9 flex-1" />
          )}
        </div>

        {error && <p className="mt-3 text-sm text-accent-400">{error}</p>}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md border border-border py-2.5 font-semibold"
          >
            {t('dqCancel')}
          </button>
          <button
            type="button"
            disabled={busy || (!reason && !audioBlob)}
            onClick={submit}
            className="flex-1 rounded-md bg-live py-2.5 font-semibold text-white disabled:opacity-50"
          >
            {t('dqSubmit')}
          </button>
        </div>
      </div>
    </div>
  );
}
