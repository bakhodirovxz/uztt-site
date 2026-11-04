'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

interface Entry {
  id: string;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'WAITLIST' | 'WITHDRAWN';
  source: string;
  statusReason: string | null;
  teamName: string | null;
  registeredAt: string;
  player: {
    id: string;
    firstName: string;
    lastName: string;
    region: string;
    rankingPoints: number;
  };
  partner: { id: string; firstName: string; lastName: string } | null;
  statusChangedBy: { firstName: string; lastName: string } | null;
}

interface PlayerOpt {
  id: string;
  firstName: string;
  lastName: string;
  gender: string;
}

const STATUS_LABEL: Record<Entry['status'], string> = {
  PENDING: "Ko'rib chiqilmoqda",
  CONFIRMED: 'Tasdiqlangan',
  REJECTED: 'Rad etilgan',
  WAITLIST: 'Navbatda',
  WITHDRAWN: 'Chetlatilgan',
};

const STATUS_CLASS: Record<Entry['status'], string> = {
  PENDING: 'bg-gold-100 text-gold-600',
  CONFIRMED: 'bg-win/15 text-win',
  REJECTED: 'bg-accent-100 text-danger',
  WAITLIST: 'bg-surface-raised text-muted',
  WITHDRAWN: 'bg-accent-100 text-danger',
};

/**
 * Kategoriya qatnashchilari: tasdiqlash, rad etish, navbatga qo'yish,
 * turnirdan chetlatish (sabab MAJBURIY) va qo'lda qatnashchi qo'shish.
 */
export function CategoryEntries({
  categoryId,
  title,
  players,
  onChanged,
}: {
  categoryId: string;
  title: string;
  players: PlayerOpt[];
  onChanged?: () => void;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addPlayerId, setAddPlayerId] = useState('');
  const [addTeamName, setAddTeamName] = useState('');
  const [reasonFor, setReasonFor] = useState<{
    id: string;
    status: 'REJECTED' | 'WITHDRAWN';
  } | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(() => {
    api
      .get<Entry[]>(`/draws/registrations/${categoryId}`)
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [categoryId]);

  useEffect(load, [load]);

  async function setStatus(
    id: string,
    status: Entry['status'],
    reasonText?: string,
  ) {
    setError(null);
    try {
      await api.post(`/draws/registrations/${id}/status`, {
        status,
        reason: reasonText,
      });
      setReasonFor(null);
      setReason('');
      load();
      onChanged?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }

  const [plan, setPlan] = useState<{ firstRound: Array<{ n: number; a: string | null; b: string | null }>; status: string; finished: boolean; lot: boolean } | null>(null);
  const loadPlan = useCallback(() => {
    api
      .get<{ status: string; allMatchesFinished?: boolean; groups?: Array<{ lotAtBoundary?: boolean }>; bracketPlan?: { firstRound: Array<{ n: number; a: string | null; b: string | null }> } }>(`/groups/category/${categoryId}?t=${Date.now()}`)
      .then((v) => setPlan(v.bracketPlan ? { firstRound: v.bracketPlan.firstRound, status: v.status, finished: !!v.allMatchesFinished, lot: !!v.groups?.some((g) => g.lotAtBoundary) } : null))
      .catch(() => setPlan(null));
  }, [categoryId]);
  useEffect(loadPlan, [loadPlan]);
  const [drawing, setDrawing] = useState(false);
  const [drawMsg, setDrawMsg] = useState<string | null>(null);
  async function autoDraw() {
    setError(null);
    setDrawMsg(null);
    setDrawing(true);
    try {
      const r = await api.post<{ format: 'BRACKET' | 'GROUPS'; players: number; groupCount: number; advancing: number }>(
        `/groups/category/${categoryId}/auto`,
        {},
      );
      setDrawMsg(
        r.format === 'GROUPS'
          ? `Qura o'tkazildi: ${r.players} o'yinchi ${r.groupCount} ta guruhga bo'lindi (har guruhdan ${r.advancing} tadan setkaga chiqadi). O'yinlar va hakamlar avtomatik yaratildi.`
          : `Qura o'tkazildi: ${r.players} o'yinchi uchun setka yaratildi. O'yinlar va hakamlar avtomatik yaratildi.`,
      );
      loadPlan();
      onChanged?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setDrawing(false);
    }
  }

  /** Guruh bosqichi tugagach setkani yaratadi. acceptLot: chegaradagi tenglik jereb bilan hal qilingani tasdiqlanadi (4.2.4) */
  async function advance(acceptLot: boolean) {
    setError(null);
    setDrawMsg(null);
    setDrawing(true);
    try {
      await api.post(`/groups/category/${categoryId}/advance${acceptLot ? '?acceptLot=1' : ''}`, {});
      setDrawMsg("Setka yaratildi: o'yinlar va stollar pastdagi ro'yxatda.");
      loadPlan();
      onChanged?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setDrawing(false);
    }
  }

  async function addParticipant() {
    if (!addPlayerId) return;
    setError(null);
    try {
      await api.post(`/registration/categories/${categoryId}/participants`, {
        playerId: addPlayerId,
        teamName: addTeamName || undefined,
      });
      setAddPlayerId('');
      setAddTeamName('');
      load();
      onChanged?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }

  const btn =
    'rounded-md px-2.5 py-1 text-xs font-semibold border border-border hover:border-accent-500';

  return (
    <div className="mt-4 rounded-card bg-surface-card p-5 shadow-card">
      <h2 className="font-heading font-bold">Qatnashchilar — {title}</h2>

      {error && (
        <p className="mt-2 rounded-md bg-accent-100 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md bg-surface-raised px-3 py-3">
        <button
          type="button"
          disabled={drawing || entries.filter((x) => x.status === 'CONFIRMED').length < 2}
          onClick={autoDraw}
          className="rounded-md bg-accent-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {drawing ? 'Qura o‘tkazilmoqda…' : 'Qurani avtomatik o‘tkazish'}
        </button>
        <span className="text-xs text-muted">
          Tasdiqlanganlar: {entries.filter((x) => x.status === 'CONFIRMED').length} ta. Tizim reyting bo‘yicha guruhlarga bo‘ladi, o‘yinlar va hakamlarni o‘zi yaratadi.
        </span>
      </div>
      {plan && plan.status !== 'ADVANCED' && (
        <div className="mt-3 rounded-md border border-border px-3 py-3">
          <div className="text-sm font-bold">Setka rejasi (guruh natijalariga ko‘ra)</div>
          <div className="mt-1 text-xs text-muted">A1 — A guruhi 1-o‘rin egasi. Guruhlar tugagach juftliklar shu reja bo‘yicha o‘yinchilar bilan to‘ladi.</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {plan.firstRound.map((r) => (
              <div key={r.n} className="flex items-center justify-between rounded-md bg-surface-raised px-3 py-2 text-sm font-bold">
                <span>{r.a ?? 'BYE'}</span>
                <span className="text-xs font-semibold text-muted">vs</span>
                <span>{r.b ?? 'BYE'}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={drawing || !plan.finished || plan.lot}
              onClick={() => advance(false)}
              className="rounded-md bg-accent-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              Setkaga o‘tkazish
            </button>
            {plan.finished && plan.lot && (
              <button
                type="button"
                disabled={drawing}
                onClick={() => advance(true)}
                className="rounded-md border border-accent-600 px-4 py-2 text-sm font-bold text-accent-700 disabled:opacity-50"
              >
                Jereb natijasini tasdiqlab o‘tkazish
              </button>
            )}
            <span className="text-xs text-muted">
              {!plan.finished
                ? 'Guruh o‘yinlari tugagach ochiladi.'
                : plan.lot
                  ? 'Chiqish chegarasidagi tenglikni jereb hal qildi: guruh jadvalini tekshirib, bosh hakam tasdiqlaydi.'
                  : 'Guruhlar tugadi: g‘oliblar setka rejasi bo‘yicha joylashadi.'}
            </span>
          </div>
        </div>
      )}
      {drawMsg && (
        <p className="mt-2 rounded-md bg-win/15 px-3 py-2 text-sm text-win">{drawMsg}</p>
      )}

      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Hozircha ariza yo&apos;q</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {entries.map((e) => (
            <li key={e.id} className="rounded-md bg-surface-raised px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {e.player.lastName} {e.player.firstName}
                  <span className="ml-2 text-xs font-normal text-muted">
                    {e.player.region} · {e.player.rankingPoints} ball
                    {e.partner &&
                      ` · sherik: ${e.partner.lastName} ${e.partner.firstName}`}
                    {e.teamName && ` · ${e.teamName}`}
                  </span>
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_CLASS[e.status]}`}
                >
                  {STATUS_LABEL[e.status]}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <button type="button" className={btn} onClick={() => setStatus(e.id, 'CONFIRMED')}>
                  Tasdiqlash
                </button>
                <button type="button" className={btn} onClick={() => setStatus(e.id, 'WAITLIST')}>
                  Navbatga
                </button>
                <button
                  type="button"
                  className={btn}
                  onClick={() => setReasonFor({ id: e.id, status: 'REJECTED' })}
                >
                  Rad etish
                </button>
                <button
                  type="button"
                  className={`${btn} text-accent-400`}
                  onClick={() => setReasonFor({ id: e.id, status: 'WITHDRAWN' })}
                >
                  Turnirdan chetlatish
                </button>
              </div>

              {/* Sabab MAJBURIY — server ham bo'sh sababni qabul qilmaydi */}
              {reasonFor?.id === e.id && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    autoFocus
                    value={reason}
                    onChange={(ev) => setReason(ev.target.value)}
                    placeholder={
                      reasonFor.status === 'WITHDRAWN'
                        ? 'Chetlatish sababi (majburiy)'
                        : 'Rad etish sababi (majburiy)'
                    }
                    className="min-w-[240px] flex-1 rounded-md border border-border px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={!reason.trim()}
                    onClick={() => setStatus(e.id, reasonFor.status, reason)}
                    className="rounded-md bg-accent-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Saqlash
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReasonFor(null);
                      setReason('');
                    }}
                    className="rounded-md border border-border px-4 py-2 text-sm font-semibold"
                  >
                    Bekor
                  </button>
                </div>
              )}

              {e.statusReason && (
                <p className="mt-1.5 text-xs text-muted">
                  Sabab: {e.statusReason}
                  {e.statusChangedBy &&
                    ` — ${e.statusChangedBy.firstName} ${e.statusChangedBy.lastName}`}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Qo'lda qatnashchi qo'shish */}
      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
        <select
          value={addPlayerId}
          onChange={(e) => setAddPlayerId(e.target.value)}
          className="min-w-[200px] flex-1 rounded-md border border-border px-2 py-2"
        >
          <option value="">O&apos;yinchi tanlang…</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.lastName} {p.firstName}
            </option>
          ))}
        </select>
        <input
          value={addTeamName}
          onChange={(e) => setAddTeamName(e.target.value)}
          placeholder="Jamoa nomi (jamoaviy uchun)"
          className="rounded-md border border-border px-3 py-2"
        />
        <button
          type="button"
          onClick={addParticipant}
          disabled={!addPlayerId}
          className="rounded-md bg-navy-900 px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          Qatnashchi qo&apos;shish
        </button>
      </div>
    </div>
  );
}
