'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Alert, Button, Card, EmptyState, PageHeader, inputClass } from '@/components/panel/ui';

interface Tournament { id: string; name: string }
interface Ref { userId: string; name: string; region: string | null; category: string | null; available: boolean; load: number }
interface M {
  id: string; stage: string; tableNumber: number | null; scheduledAt: string | null; status: string;
  refereeUserId: string | null; assistantUserId: string | null;
  player1: { firstName: string; lastName: string } | null; player2: { firstName: string; lastName: string } | null;
}
interface Result { assigned: number; unassigned: number; dryRun: boolean; results: Array<{ matchId: string; reason?: string }> }

const nm = (p: M['player1']) => (p ? `${p.firstName[0]}. ${p.lastName}` : '—');

/** Hakamlarni avtomatik tayinlash va qo'lda almashtirish (referee.assign) */
export default function RefereesPanelPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tid, setTid] = useState('');
  const [data, setData] = useState<{ matches: M[]; referees: Ref[] } | null>(null);
  const [msg, setMsg] = useState<{ kind: 'success' | 'danger' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<Tournament[] | { rows: Tournament[] }>('/tournaments')
      .then((r) => setTournaments(Array.isArray(r) ? r : r.rows ?? []))
      .catch(() => setTournaments([]));
  }, []);

  const load = useCallback(async () => {
    if (!tid) { setData(null); return; }
    try { setData(await api.get(`/tournaments/${tid}/referee-overview`)); }
    catch (e) { setMsg({ kind: 'danger', text: e instanceof ApiError ? e.message : 'Yuklab bo‘lmadi' }); }
  }, [tid]);
  useEffect(() => { load(); }, [load]);

  async function run(dryRun: boolean, onlyUnassigned: boolean) {
    setBusy(true); setMsg(null);
    try {
      const r = await api.post<Result>(`/tournaments/${tid}/assign-referees`, { dryRun, onlyUnassigned });
      const warn = r.unassigned ? ` · tayinlanmadi: ${r.unassigned} (hakam yetishmaydi yoki vaqt to‘qnashuvi)` : '';
      setMsg({ kind: r.unassigned ? 'info' : 'success', text: `${dryRun ? 'Ko‘rib chiqish: ' : ''}tayinlandi: ${r.assigned}${warn}` });
      if (!dryRun) await load();
    } catch (e) {
      setMsg({ kind: 'danger', text: e instanceof ApiError ? e.message : 'Xatolik' });
    } finally { setBusy(false); }
  }

  async function setManual(m: M, patch: { refereeUserId?: string | null; assistantUserId?: string | null }) {
    setMsg(null);
    try {
      await api.put(`/matches/${m.id}/referees`, { refereeUserId: m.refereeUserId, assistantUserId: m.assistantUserId, ...patch });
      await load();
    } catch (e) {
      setMsg({ kind: 'danger', text: e instanceof ApiError ? e.message : 'Xatolik' });
    }
  }

  const refName = (id: string | null) => data?.referees.find((r) => r.userId === id)?.name ?? '';
  const options = (data?.referees ?? []).filter((r) => r.available);

  return (
    <div className="space-y-5">
      <PageHeader title="Hakamlarni tayinlash" description="Qoidalar: ishtirokchi o‘z o‘yinida hakam bo‘lmaydi, bir vaqtda ikki o‘yinda emas, final/yarim finalga yuqori toifa, yuklama teng taqsimlanadi, o‘z hududidagi o‘yinchilarga qo‘yilmaslikka harakat qilinadi." />
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <select value={tid} onChange={(e) => setTid(e.target.value)} className={`${inputClass} !w-72`} aria-label="Musobaqa">
            <option value="">Musobaqani tanlang</option>
            {tournaments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <Button disabled={!tid || busy} onClick={() => run(true, true)}>Oldindan ko‘rish</Button>
          <Button variant="primary" disabled={!tid || busy} onClick={() => run(false, true)}>Bo‘shlariga tayinlash</Button>
          <Button variant="danger" disabled={!tid || busy} onClick={() => run(false, false)}>Hammasini qayta tayinlash</Button>
        </div>
        {msg && <div className="mt-3"><Alert kind={msg.kind}>{msg.text}</Alert></div>}
      </Card>

      {data && (
        <>
          <Card title="Hakamlar yuklamasi">
            {data.referees.length === 0 ? <EmptyState title="Tasdiqlangan hakamlar yo‘q" hint="Avval «Arizalar» bo‘limida hakam arizalarini tasdiqlang." /> : (
              <div className="flex flex-wrap gap-2 text-sm">
                {data.referees.map((r) => (
                  <span key={r.userId} className={`rounded-full border border-border px-3 py-1 ${r.available ? '' : 'opacity-50'}`}>
                    {r.name}{r.region ? ` (${r.region})` : ''} — <b>{r.load}</b>
                  </span>
                ))}
              </div>
            )}
          </Card>
          <Card title={`O‘yinlar (${data.matches.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-xs uppercase text-muted"><th className="py-2 pr-3">Vaqt</th><th className="pr-3">Stol</th><th className="pr-3">O‘yin</th><th className="pr-3">Hakam</th><th>Yordamchi</th></tr></thead>
                <tbody>
                  {data.matches.map((m) => {
                    const done = m.status === 'FINISHED';
                    return (
                      <tr key={m.id} className="border-b border-border/60 align-middle">
                        <td className="py-1.5 pr-3 whitespace-nowrap">{m.scheduledAt ? new Date(m.scheduledAt).toLocaleString('uz', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                        <td className="pr-3">{m.tableNumber ?? '—'}</td>
                        <td className="pr-3">{nm(m.player1)} – {nm(m.player2)}</td>
                        {(['refereeUserId', 'assistantUserId'] as const).map((f) => (
                          <td key={f} className="pr-3">
                            <select disabled={done} value={m[f] ?? ''} aria-label={f === 'refereeUserId' ? 'Hakam' : 'Yordamchi'}
                              onChange={(e) => setManual(m, { [f]: e.target.value || null })} className={`${inputClass} !py-1.5`}>
                              <option value="">—</option>
                              {m[f] && !options.some((o) => o.userId === m[f]) && <option value={m[f]!}>{refName(m[f])}</option>}
                              {options.map((o) => <option key={o.userId} value={o.userId}>{o.name}</option>)}
                            </select>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
