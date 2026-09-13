'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { EventType } from '@/lib/groups';
import { CategoryEntries } from './category-entries';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  PageHeader,
  inputClass,
} from '@/components/panel/ui';

interface Level {
  code: string;
  name: string;
  description?: string | null;
  coefficient: number;
  rules: Array<{ key: string; points: number }>;
}

/** Reglament kalitlari uchun qisqa nomlar (panelda ko'rsatish uchun) */
const RULE_LABEL: Record<string, string> = {
  PARTICIPATION: 'Ishtirok',
  GROUP_ADVANCE: 'Guruhdan chiqish',
  WIN: "Har g'alaba",
  CHAMPION: 'Chempionlik',
};
interface Tournament {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  status: string;
  startDate: string;
  endDate: string;
  level: { code: string; name: string };
}
interface PlayerOpt {
  id: string;
  firstName: string;
  lastName: string;
  gender: string;
}
interface AdminMatch {
  id: string;
  stage: string;
  status: string;
  tableNumber: number | null;
  player1Name: string;
  player2Name: string;
  player1SetsWon: number;
  player2SetsWon: number;
  overlayToken: string;
  refereeCodeLocked: boolean;
}
interface AgeCategoryOpt {
  id: string;
  code: string;
  name: string;
}
interface TournamentCategoryRow {
  id: string;
  gender: 'MALE' | 'FEMALE' | null;
  eventType: EventType;
  registrationDeadline: string | null;
  ageCategory: { code: string; name: string };
  _count: { registrations: number };
}

const EVENT_LABEL: Record<EventType, string> = {
  SINGLES: 'yakka',
  DOUBLES: 'juftlik',
  MIXED_DOUBLES: 'aralash juftlik',
  TEAM: 'jamoaviy',
};

const STAGE_LABEL: Record<string, string> = {
  GROUP: 'Guruh bosqichi',
  ROUND_1: '1-bosqich',
  ROUND_OF_32: '1/16 final',
  ROUND_OF_16: '1/8 final',
  QUARTERFINAL: 'Chorak final',
  SEMIFINAL: 'Yarim final',
  FINAL: 'Final',
};

const STATUS_TONE: Record<string, 'live' | 'success' | 'neutral'> = {
  LIVE: 'live',
  FINISHED: 'success',
  SCHEDULED: 'neutral',
  UPCOMING: 'neutral',
};

function catTitle(c: TournamentCategoryRow) {
  const g = c.gender === 'MALE' ? 'Erkaklar' : c.gender === 'FEMALE' ? 'Ayollar' : '';
  return `${c.ageCategory.code} ${g} ${EVENT_LABEL[c.eventType]}`
    .replace(/\s+/g, ' ')
    .trim();
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('uz-UZ');

/**
 * Musobaqa boshqaruvi uchta qadamdan iborat:
 * 1) musobaqa tanlash/yaratish → 2) guruh ochish va arizalar → 3) o'yinlar.
 */
export default function AdminTournamentsPage() {
  const [levels, setLevels] = useState<Level[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [players, setPlayers] = useState<PlayerOpt[]>([]);
  const [selected, setSelected] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<AdminMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [newTournamentOpen, setNewTournamentOpen] = useState(false);
  const [tForm, setTForm] = useState({
    name: '',
    levelCode: 'NATIONAL',
    city: '',
    startDate: '',
    endDate: '',
  });

  const [newMatchOpen, setNewMatchOpen] = useState(false);
  const [mForm, setMForm] = useState({
    stage: 'ROUND_1',
    tableNumber: '',
    player1Id: '',
    player2Id: '',
  });
  // Hakam kodi faqat yaratilgan payt ko'rsatiladi (bazada hash saqlanadi)
  const [newCode, setNewCode] = useState<{ matchId: string; code: string } | null>(null);

  const [ageCategories, setAgeCategories] = useState<AgeCategoryOpt[]>([]);
  const [tCategories, setTCategories] = useState<TournamentCategoryRow[]>([]);
  const [catForm, setCatForm] = useState({
    ageCategoryCode: 'SENIOR',
    gender: 'MALE',
    eventType: 'SINGLES' as EventType,
    deadline: '',
  });
  const [openCat, setOpenCat] = useState<TournamentCategoryRow | null>(null);

  const loadAll = useCallback(() => {
    api.get<Tournament[]>('/tournaments').then(setTournaments).catch(() => {});
    api.get<Level[]>('/tournaments/levels').then(setLevels).catch(() => {});
    api
      .get<{ rows: PlayerOpt[] }>('/players?pageSize=500')
      .then((r) => setPlayers(r.rows))
      .catch(() => {});
    api.get<AgeCategoryOpt[]>('/draws/age-categories').then(setAgeCategories).catch(() => {});
  }, []);

  useEffect(loadAll, [loadAll]);

  const loadCategories = useCallback((tournamentId: string) => {
    api
      .get<TournamentCategoryRow[]>(`/draws/categories/${tournamentId}`)
      .then(setTCategories)
      .catch(() => setTCategories([]));
  }, []);

  const loadMatches = useCallback((tournamentId: string) => {
    api
      .get<AdminMatch[]>(`/matches?tournamentId=${tournamentId}`)
      .then(setMatches)
      .catch(() => setMatches([]));
  }, []);

  const selectedLevel = levels.find((l) => l.code === tForm.levelCode);

  function fail(e: unknown) {
    setError(e instanceof ApiError ? e.message : String(e));
  }

  function selectTournament(t: Tournament) {
    setSelected(t);
    setOpenCat(null);
    setNewCode(null);
    setNewMatchOpen(false);
    loadMatches(t.id);
    loadCategories(t.id);
  }

  async function createTournament() {
    setError(null);
    try {
      await api.post('/tournaments', {
        name: tForm.name,
        levelCode: tForm.levelCode,
        city: tForm.city || undefined,
        startDate: tForm.startDate,
        endDate: tForm.endDate,
      });
      setMsg(`"${tForm.name}" yaratildi — endi guruhlarni oching`);
      setTForm({ name: '', levelCode: 'NATIONAL', city: '', startDate: '', endDate: '' });
      setNewTournamentOpen(false);
      loadAll();
    } catch (e) {
      fail(e);
    }
  }

  async function addCategory() {
    if (!selected) return;
    setError(null);
    try {
      const mixed =
        catForm.eventType === 'MIXED_DOUBLES' || catForm.eventType === 'TEAM';
      await api.post('/draws/categories', {
        tournamentId: selected.id,
        ageCategoryCode: catForm.ageCategoryCode,
        gender: mixed ? undefined : catForm.gender,
        eventType: catForm.eventType,
        registrationDeadline: catForm.deadline || undefined,
      });
      setMsg('Guruh ochildi — o‘yinchilar profilidan yozila oladi');
      loadCategories(selected.id);
    } catch (e) {
      fail(e);
    }
  }

  async function createMatch() {
    if (!selected) return;
    setError(null);
    try {
      const created = await api.post<AdminMatch & { refereeCode: string }>('/matches', {
        tournamentId: selected.id,
        stage: mForm.stage,
        tableNumber: mForm.tableNumber ? Number(mForm.tableNumber) : undefined,
        player1Id: mForm.player1Id || undefined,
        player2Id: mForm.player2Id || undefined,
      });
      setNewCode({ matchId: created.id, code: created.refereeCode });
      setNewMatchOpen(false);
      loadMatches(selected.id);
    } catch (e) {
      fail(e);
    }
  }

  async function regenerate(matchId: string) {
    const { refereeCode } = await api.post<{ refereeCode: string }>(
      `/matches/${matchId}/regenerate-code`,
    );
    setNewCode({ matchId, code: refereeCode });
  }

  const mixedGroup =
    catForm.eventType === 'MIXED_DOUBLES' || catForm.eventType === 'TEAM';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Musobaqalar"
        description="Musobaqa oching, guruhlarini belgilang, arizalarni ko‘rib chiqing va o‘yinlar jadvalini tuzing."
        action={
          <Button
            variant={newTournamentOpen ? 'ghost' : 'primary'}
            onClick={() => setNewTournamentOpen((v) => !v)}
          >
            {newTournamentOpen ? 'Yopish' : '+ Yangi musobaqa'}
          </Button>
        }
      />

      {msg && <Alert kind="success">{msg}</Alert>}
      {error && <Alert kind="danger">{error}</Alert>}

      {newTournamentOpen && (
        <Card title="Yangi musobaqa">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nomi" required className="sm:col-span-2">
              <input
                value={tForm.name}
                onChange={(e) => setTForm({ ...tForm, name: e.target.value })}
                placeholder="Respublika chempionati 2026"
                className={inputClass}
              />
            </Field>
            <Field
              label="Daraja (reglament)"
              hint="Musobaqa aynan shu daraja reglamenti bo‘yicha ball beradi"
              required
            >
              <select
                value={tForm.levelCode}
                onChange={(e) => setTForm({ ...tForm, levelCode: e.target.value })}
                className={inputClass}
              >
                {levels.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Shahar">
              <input
                value={tForm.city}
                onChange={(e) => setTForm({ ...tForm, city: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Boshlanish sanasi" required>
              <input
                type="date"
                value={tForm.startDate}
                onChange={(e) => setTForm({ ...tForm, startDate: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Tugash sanasi" required>
              <input
                type="date"
                value={tForm.endDate}
                onChange={(e) => setTForm({ ...tForm, endDate: e.target.value })}
                className={inputClass}
              />
            </Field>
          </div>
          <div className="mt-5 border-t border-border pt-4">
            <Button
              variant="primary"
              disabled={!tForm.name || !tForm.startDate || !tForm.endDate}
              onClick={createTournament}
            >
              Musobaqani yaratish
            </Button>
          </div>

          {/* Tanlangan daraja reglamenti — musobaqa aynan shu bo'yicha ball beradi */}
          {selectedLevel && (
            <div className="mt-4 rounded-md border border-border bg-surface-raised p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">
                  {selectedLevel.name} reglamenti
                </span>
                {selectedLevel.rules.length > 0 && (
                  <span className="text-xs text-muted">
                    Chempion yo‘lidagi maksimal yig‘indi:{' '}
                    <span className="font-heading font-bold text-ink">
                      {selectedLevel.rules.reduce((s, r) => s + r.points, 0)}
                    </span>
                  </span>
                )}
              </div>
              {selectedLevel.rules.length === 0 ? (
                <p className="mt-2 text-sm text-accent-400">
                  Bu darajada reglament kiritilmagan — ballar eski usulda
                  (bosqich balli × {selectedLevel.coefficient}) hisoblanadi.
                  Darajalar bo‘limida to‘ldiring.
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedLevel.rules.map((r) => (
                    <span
                      key={r.key}
                      className="rounded bg-surface-card px-2 py-1 text-xs"
                    >
                      <span className="text-muted">
                        {RULE_LABEL[r.key] ?? r.key}:
                      </span>{' '}
                      <span className="font-heading font-bold tabular-nums">
                        {r.points}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* 1-qadam: musobaqani tanlash */}
        <div>
          <span className="eyebrow">1 · Musobaqa</span>
          <div className="mt-3 space-y-2">
            {tournaments.length === 0 && (
              <EmptyState
                title="Musobaqa yo‘q"
                hint="Yuqoridagi tugma bilan birinchi musobaqani oching."
              />
            )}
            {tournaments.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTournament(t)}
                className={`w-full rounded-md border px-4 py-3 text-left transition-colors ${
                  selected?.id === t.id
                    ? 'border-court-500 bg-court-100'
                    : 'border-border bg-surface-card hover:border-border-strong'
                }`}
              >
                <div className="font-semibold">{t.name}</div>
                <div className="mt-0.5 text-xs text-muted">
                  {t.level.name} · {fmtDate(t.startDate)}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 2-3-qadam: guruhlar, arizalar, o'yinlar */}
        <div className="min-w-0 space-y-6">
          {!selected ? (
            <EmptyState
              title="Musobaqani tanlang"
              hint="Chapdagi ro‘yxatdan musobaqani tanlasangiz, guruhlari va o‘yinlari shu yerda ochiladi."
            />
          ) : (
            <>
              <Card
                title={`2 · Guruhlar — ${selected.name}`}
                description="O‘yinchilar faqat shu yerda ochilgan guruhlarga yozila oladi; yosh va jins avtomatik tekshiriladi."
              >
                {tCategories.length === 0 ? (
                  <p className="text-sm text-muted">
                    Hali guruh ochilmagan — quyida birinchisini qo‘shing.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {tCategories.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() =>
                          setOpenCat((prev) => (prev?.id === c.id ? null : c))
                        }
                        className={`min-h-9 rounded-full px-3.5 text-xs font-semibold transition-colors ${
                          openCat?.id === c.id
                            ? 'bg-accent-500 text-white'
                            : 'bg-surface-raised text-muted hover:text-ink'
                        }`}
                      >
                        {catTitle(c)} · {c._count.registrations} ariza
                        {c.registrationDeadline &&
                          ` · ${fmtDate(c.registrationDeadline)} gacha`}
                      </button>
                    ))}
                  </div>
                )}

                <div className="mt-5 grid gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Yosh toifasi">
                    <select
                      value={catForm.ageCategoryCode}
                      onChange={(e) =>
                        setCatForm({ ...catForm, ageCategoryCode: e.target.value })
                      }
                      className={inputClass}
                    >
                      {ageCategories.map((a) => (
                        <option key={a.code} value={a.code}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Guruh">
                    <select
                      value={catForm.eventType}
                      onChange={(e) =>
                        setCatForm({ ...catForm, eventType: e.target.value as EventType })
                      }
                      className={inputClass}
                    >
                      <option value="SINGLES">Yakka</option>
                      <option value="DOUBLES">Juftlik</option>
                      <option value="MIXED_DOUBLES">Aralash juftlik</option>
                      <option value="TEAM">Jamoaviy</option>
                    </select>
                  </Field>
                  <Field
                    label="Jins"
                    hint={mixedGroup ? 'Aralash guruhda talab qilinmaydi' : undefined}
                  >
                    <select
                      value={catForm.gender}
                      onChange={(e) => setCatForm({ ...catForm, gender: e.target.value })}
                      disabled={mixedGroup}
                      className={`${inputClass} disabled:opacity-50`}
                    >
                      <option value="MALE">Erkaklar</option>
                      <option value="FEMALE">Ayollar</option>
                    </select>
                  </Field>
                  <Field label="Ariza muddati" hint="Ixtiyoriy">
                    <input
                      type="date"
                      value={catForm.deadline}
                      onChange={(e) => setCatForm({ ...catForm, deadline: e.target.value })}
                      className={inputClass}
                    />
                  </Field>
                </div>
                <div className="mt-4">
                  <Button onClick={addCategory}>Guruh ochish</Button>
                </div>
              </Card>

              {openCat && (
                <CategoryEntries
                  categoryId={openCat.id}
                  title={catTitle(openCat)}
                  players={players}
                  onChanged={() => loadCategories(selected.id)}
                />
              )}

              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="eyebrow">3 · O‘yinlar</span>
                  <Button
                    variant={newMatchOpen ? 'ghost' : 'secondary'}
                    size="sm"
                    onClick={() => setNewMatchOpen((v) => !v)}
                  >
                    {newMatchOpen ? 'Yopish' : "+ O'yin qo'shish"}
                  </Button>
                </div>

                {newMatchOpen && (
                  <Card className="mt-3">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Bosqich">
                        <select
                          value={mForm.stage}
                          onChange={(e) => setMForm({ ...mForm, stage: e.target.value })}
                          className={inputClass}
                        >
                          {Object.entries(STAGE_LABEL).map(([code, label]) => (
                            <option key={code} value={code}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Stol raqami" hint="Overlay va monitor shu raqamga bog‘lanadi">
                        <input
                          inputMode="numeric"
                          value={mForm.tableNumber}
                          onChange={(e) =>
                            setMForm({ ...mForm, tableNumber: e.target.value })
                          }
                          className={inputClass}
                        />
                      </Field>
                      <Field label="1-o‘yinchi">
                        <select
                          value={mForm.player1Id}
                          onChange={(e) => setMForm({ ...mForm, player1Id: e.target.value })}
                          className={inputClass}
                        >
                          <option value="">Tanlanmagan</option>
                          {players.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.lastName} {p.firstName}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="2-o‘yinchi">
                        <select
                          value={mForm.player2Id}
                          onChange={(e) => setMForm({ ...mForm, player2Id: e.target.value })}
                          className={inputClass}
                        >
                          <option value="">Tanlanmagan</option>
                          {players.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.lastName} {p.firstName}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <div className="mt-5 border-t border-border pt-4">
                      <Button variant="primary" onClick={createMatch}>
                        O‘yin yaratish
                      </Button>
                    </div>
                  </Card>
                )}

                {/* Hakam kodi — faqat shu daqiqada ko'rinadi */}
                {newCode && (
                  <div className="mt-3 rounded-card border border-gold-500/50 bg-gold-100 p-4">
                    <div className="text-sm font-semibold text-gold-500">
                      Hakam kodi — faqat hozir ko‘rsatiladi, hakamga yetkazing
                    </div>
                    <div className="mt-1 font-heading text-3xl font-extrabold tracking-[0.3em] text-gold-500">
                      {newCode.code}
                    </div>
                  </div>
                )}

                <div className="mt-3 space-y-2">
                  {matches.length === 0 && (
                    <EmptyState
                      title="O‘yin yo‘q"
                      hint="Qura yarating yoki qo‘lda o‘yin qo‘shing."
                    />
                  )}
                  {matches.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-md border border-border bg-surface-card px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-muted">
                          {m.tableNumber ? `${m.tableNumber}-stol` : 'Stolsiz'} ·{' '}
                          {STAGE_LABEL[m.stage] ?? m.stage}
                        </span>
                        <span className="ml-auto">
                          <Badge tone={STATUS_TONE[m.status] ?? 'neutral'}>
                            {m.status === 'LIVE'
                              ? 'Jonli'
                              : m.status === 'FINISHED'
                                ? 'Yakunlandi'
                                : 'Kutilmoqda'}
                          </Badge>
                        </span>
                      </div>
                      <div className="mt-1 font-medium">
                        {m.player1Name}{' '}
                        <span className="font-extrabold tabular-nums">
                          {m.player1SetsWon}:{m.player2SetsWon}
                        </span>{' '}
                        {m.player2Name}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                        <a
                          href={`/overlay/${m.overlayToken}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-accent-500 underline-offset-2 hover:underline"
                        >
                          OBS overlay havolasi ↗
                        </a>
                        <button
                          type="button"
                          onClick={() => regenerate(m.id)}
                          className="font-semibold text-muted hover:text-ink"
                        >
                          Hakam kodini yangilash
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
