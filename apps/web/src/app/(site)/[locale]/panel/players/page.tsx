'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { CategoryEntries } from '../tournaments/category-entries';
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmButton,
  EmptyState,
  Field,
  PageHeader,
  Row,
  inputClass,
} from '@/components/panel/ui';

interface PendingPlayer {
  id: string;
  firstName: string;
  lastName: string;
  gender: string;
  birthDate: string | null;
  region: string;
  club: string | null;
  documents: Array<{ id: string; type: string }>;
}
interface TournamentRow {
  id: string;
  name: string;
}
interface CategoryRow {
  id: string;
  gender: string | null;
  eventType: string;
  ageCategory: { code: string; name: string };
  _count: { registrations: number };
}
interface PlayerRow {
  id: string;
  firstName: string;
  lastName: string;
  gender: string;
  rankingPoints: number;
}
interface PointsLogRow {
  id: string;
  delta: number;
  reason: string;
  note: string | null;
  createdAt: string;
  createdBy: { firstName: string; lastName: string } | null;
}
interface SnapshotRow {
  id: string;
  label: string;
  takenAt: string;
  isAuto: boolean;
  entryCount: number;
}

const EVENT_LABEL: Record<string, string> = {
  SINGLES: 'yakka',
  DOUBLES: 'juftlik',
  MIXED_DOUBLES: 'aralash juftlik',
  TEAM: 'jamoaviy',
};

const REASON_LABEL: Record<string, string> = {
  MATCH_WIN: "O'yin g'alabasi",
  UNDO: 'Bekor qilingan',
  ADJUSTMENT: "Qo'lda tuzatish",
};

function catLabel(c: CategoryRow) {
  const g = c.gender === 'MALE' ? 'Erkaklar' : c.gender === 'FEMALE' ? 'Ayollar' : '';
  return `${c.ageCategory.code} ${g} ${EVENT_LABEL[c.eventType] ?? ''}`
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * O'yinchilar boshqaruvi: tasdiqlash navbati → turnir arizalari va qura →
 * reyting ballini tuzatish (har o'zgarish izohi bilan yoziladi).
 */
export default function AdminPlayersPage() {
  const [pending, setPending] = useState<PendingPlayer[]>([]);
  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [selectedT, setSelectedT] = useState('');
  const [catsData, setCatsData] = useState<{
    tournamentId: string;
    list: CategoryRow[];
  } | null>(null);
  const [catByT, setCatByT] = useState<{ tournamentId: string; id: string } | null>(
    null,
  );
  const [allPlayers, setAllPlayers] = useState<PlayerRow[]>([]);
  const [pointsForm, setPointsForm] = useState({ playerId: '', delta: '', note: '' });
  const [logData, setLogData] = useState<{
    playerId: string;
    rows: PointsLogRow[];
  } | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPending = useCallback(() => {
    api.get<PendingPlayer[]>('/registration/pending').then(setPending).catch(() => {});
  }, []);
  const loadPlayers = useCallback(() => {
    api
      .get<{ rows: PlayerRow[] }>('/players?pageSize=500')
      .then((r) => setAllPlayers(r.rows))
      .catch(() => {});
  }, []);
  const loadSnapshots = useCallback(() => {
    api
      .get<SnapshotRow[]>('/rankings/snapshots')
      .then(setSnapshots)
      .catch(() => setSnapshots([]));
  }, []);

  useEffect(() => {
    loadPending();
    loadPlayers();
    loadSnapshots();
    api.get<TournamentRow[]>('/tournaments').then(setTournaments).catch(() => {});
  }, [loadPending, loadPlayers, loadSnapshots]);

  useEffect(() => {
    if (!selectedT) return;
    api
      .get<CategoryRow[]>(`/draws/categories/${selectedT}`)
      .then((rows) => setCatsData({ tournamentId: selectedT, list: rows }))
      .catch(() => setCatsData({ tournamentId: selectedT, list: [] }));
  }, [selectedT]);

  // Ro'yxat qaysi turnirga tegishli ekani saqlanadi — almashganda render
  // paytida chetlab o'tiladi, holatni effektda tozalash shart emas
  const categories =
    selectedT && catsData?.tournamentId === selectedT ? catsData.list : [];
  const selectedCat = catByT?.tournamentId === selectedT ? catByT.id : '';

  const loadLog = useCallback((playerId: string) => {
    if (!playerId) return;
    api
      .get<PointsLogRow[]>(`/rankings/players/${playerId}/log`)
      .then((rows) => setLogData({ playerId, rows }))
      .catch(() => setLogData({ playerId, rows: [] }));
  }, []);

  useEffect(() => {
    loadLog(pointsForm.playerId);
  }, [pointsForm.playerId, loadLog]);

  const pointsLog =
    pointsForm.playerId && logData?.playerId === pointsForm.playerId
      ? logData.rows
      : [];

  function fail(e: unknown) {
    setError(e instanceof ApiError ? e.message : String(e));
  }

  async function verify(p: PendingPlayer) {
    setError(null);
    try {
      const r = await api.post<{ licenseNumber: string }>(
        `/registration/players/${p.id}/verify`,
      );
      setMsg(
        `${p.lastName} ${p.firstName} tasdiqlandi — litsenziya ${r.licenseNumber}`,
      );
      loadPending();
      loadPlayers();
    } catch (e) {
      fail(e);
    }
  }

  async function generateDraw() {
    setError(null);
    setMsg(null);
    try {
      await api.post('/draws/generate', { tournamentCategoryId: selectedCat });
      setMsg('Qura o‘tkazildi — setka musobaqa sahifasida ko‘rinadi');
    } catch (e) {
      fail(e);
    }
  }

  async function adjustPoints() {
    setError(null);
    setMsg(null);
    try {
      const res = await api.post<{ rankingPoints: number; lastName: string }>(
        `/rankings/players/${pointsForm.playerId}/adjust`,
        { delta: Number(pointsForm.delta), note: pointsForm.note },
      );
      setMsg(`${res.lastName}: yangi ball ${res.rankingPoints}`);
      setPointsForm({ ...pointsForm, delta: '', note: '' });
      loadPlayers();
      loadLog(pointsForm.playerId);
    } catch (e) {
      fail(e);
    }
  }

  async function takeSnapshot() {
    setError(null);
    setMsg(null);
    try {
      const s = await api.post<{ label: string }>('/rankings/snapshots', {
        label: snapshotLabel.trim() || undefined,
      });
      setMsg(`Kesim olindi: ${s.label}`);
      setSnapshotLabel('');
      loadSnapshots();
    } catch (e) {
      fail(e);
    }
  }

  async function removeSnapshot(s: SnapshotRow) {
    setError(null);
    try {
      await api.del(`/rankings/snapshots/${s.id}`);
      setMsg(`${s.label} kesimi o‘chirildi`);
      loadSnapshots();
    } catch (e) {
      fail(e);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="O‘yinchilar"
        description="Yangi arizalarni tasdiqlang, turnir guruhlariga qura o‘tkazing va reyting ballini tuzating."
      />

      {msg && <Alert kind="success">{msg}</Alert>}
      {error && <Alert kind="danger">{error}</Alert>}

      {/* 1 — tasdiqlash navbati */}
      <section>
        <div className="flex items-center gap-3">
          <span className="eyebrow">Tasdiqlash navbati</span>
          {pending.length > 0 && <Badge tone="warn">{pending.length}</Badge>}
        </div>

        <div className="mt-3 space-y-2">
          {pending.length === 0 ? (
            <EmptyState
              title="Navbat bo‘sh"
              hint="Yangi o‘yinchi ro‘yxatdan o‘tganda arizasi shu yerda paydo bo‘ladi."
            />
          ) : (
            pending.map((p) => (
              <Row key={p.id}>
                <div className="min-w-0 flex-1">
                  <span className="font-semibold">
                    {p.lastName} {p.firstName}
                  </span>
                  <span className="ml-2 text-sm text-muted">
                    {p.gender === 'MALE' ? 'Erkak' : 'Ayol'} ·{' '}
                    {p.birthDate
                      ? new Date(p.birthDate).toLocaleDateString('uz-UZ')
                      : 'sana yo‘q'}{' '}
                    · {p.region}
                    {p.club ? ` · ${p.club}` : ''}
                  </span>
                </div>
                <Badge tone={p.documents.length > 0 ? 'court' : 'neutral'}>
                  {p.documents.length > 0
                    ? `${p.documents.length} ta hujjat`
                    : 'hujjat yo‘q'}
                </Badge>
                <Button variant="primary" size="sm" onClick={() => verify(p)}>
                  Tasdiqlash
                </Button>
              </Row>
            ))
          )}
        </div>
      </section>

      {/* 2 — turnir arizalari va qura */}
      <section>
        <span className="eyebrow">Turnir arizalari va qura</span>
        <Card className="mt-3">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Musobaqa">
              <select
                value={selectedT}
                onChange={(e) => setSelectedT(e.target.value)}
                className={inputClass}
              >
                <option value="">Tanlanmagan</option>
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Guruh">
              <select
                value={selectedCat}
                onChange={(e) =>
                  setCatByT({ tournamentId: selectedT, id: e.target.value })
                }
                disabled={categories.length === 0}
                className={`${inputClass} disabled:opacity-50`}
              >
                <option value="">Tanlanmagan</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {catLabel(c)} ({c._count.registrations} ariza)
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex items-end">
              <Button
                variant="primary"
                disabled={!selectedCat}
                onClick={generateDraw}
              >
                Qura o‘tkazish
              </Button>
            </div>
          </div>
        </Card>

        {selectedCat && (
          <CategoryEntries
            categoryId={selectedCat}
            title={
              categories.find((c) => c.id === selectedCat)
                ? catLabel(categories.find((c) => c.id === selectedCat)!)
                : ''
            }
            players={allPlayers}
          />
        )}
      </section>

      {/* 3 — reyting ballini tuzatish */}
      <section>
        <span className="eyebrow">Reyting ballini tuzatish</span>
        <Card
          className="mt-3"
          description="Har o‘zgarish sababi va muallifi bilan tarixda saqlanadi."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="O‘yinchi">
              <select
                value={pointsForm.playerId}
                onChange={(e) =>
                  setPointsForm({ ...pointsForm, playerId: e.target.value })
                }
                className={inputClass}
              >
                <option value="">Tanlanmagan</option>
                {allPlayers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.lastName} {p.firstName} ({p.rankingPoints})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="O‘zgarish" hint="Masalan −50 yoki 120">
              <input
                type="number"
                value={pointsForm.delta}
                onChange={(e) =>
                  setPointsForm({ ...pointsForm, delta: e.target.value })
                }
                className={inputClass}
              />
            </Field>
            <Field label="Sabab" required className="lg:col-span-2">
              <input
                value={pointsForm.note}
                onChange={(e) =>
                  setPointsForm({ ...pointsForm, note: e.target.value })
                }
                placeholder="Xato kiritilgan ball tuzatildi"
                className={inputClass}
              />
            </Field>
          </div>
          <div className="mt-4">
            <Button
              variant="primary"
              disabled={
                !pointsForm.playerId || !pointsForm.delta || !pointsForm.note.trim()
              }
              onClick={adjustPoints}
            >
              Saqlash
            </Button>
          </div>

          {pointsLog.length > 0 && (
            <ul className="mt-5 space-y-1.5 border-t border-border pt-4 text-sm">
              {pointsLog.map((l) => (
                <li key={l.id} className="flex flex-wrap items-baseline gap-2">
                  <span
                    className={`w-14 font-bold tabular-nums ${
                      l.delta >= 0 ? 'text-win' : 'text-accent-400'
                    }`}
                  >
                    {l.delta >= 0 ? '+' : ''}
                    {l.delta}
                  </span>
                  <span className="text-muted">
                    {REASON_LABEL[l.reason] ?? l.reason}
                  </span>
                  {l.note && <span className="text-muted">· {l.note}</span>}
                  {l.createdBy && (
                    <span className="text-muted">
                      · {l.createdBy.lastName} {l.createdBy.firstName}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-muted">
                    {new Date(l.createdAt).toLocaleString('uz-UZ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* 4 — reyting kesimlari (▲▼ shu kesimlarga nisbatan hisoblanadi) */}
      <section>
        <span className="eyebrow">Reyting kesimlari</span>
        <Card
          className="mt-3"
          description="Har dushanba 03:00 da avtomatik olinadi. ▲▼ ko‘rsatkichi oxirgi kesimga nisbatan hisoblanadi — shuning uchun kesimni musobaqa BOSHLANISHIDAN OLDIN oling. Musobaqadan keyin olinsa, taqqoslash bazasi qolmaydi va jadvalda harakat ko‘rinmaydi."
        >
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Yorliq" hint="Bo‘sh qolsa joriy ISO hafta (2026-W33)">
              <input
                value={snapshotLabel}
                onChange={(e) => setSnapshotLabel(e.target.value)}
                placeholder="2026-W33"
                className={`${inputClass} sm:w-52`}
              />
            </Field>
            <Button variant="primary" onClick={takeSnapshot}>
              Kesim olish
            </Button>
          </div>

          {snapshots.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              Hali kesim olinmagan — birinchi kesimdan keyin ▲▼ ko‘rina boshlaydi.
            </p>
          ) : (
            <ul className="mt-5 space-y-1.5 border-t border-border pt-4 text-sm">
              {snapshots.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3">
                  <span className="font-heading font-bold">{s.label}</span>
                  <Badge tone={s.isAuto ? 'court' : 'neutral'}>
                    {s.isAuto ? 'avtomatik' : 'qo‘lda'}
                  </Badge>
                  <span className="text-muted">{s.entryCount} o‘yinchi</span>
                  <span className="ml-auto text-xs text-muted">
                    {new Date(s.takenAt).toLocaleString('uz-UZ')}
                  </span>
                  <ConfirmButton onConfirm={() => removeSnapshot(s)} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
