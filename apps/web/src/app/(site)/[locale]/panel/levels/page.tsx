'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
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

interface RuleKey {
  key: string;
  label: string;
}
interface Rule {
  key: string;
  label: string;
  points: number;
}
interface Level {
  id: string;
  code: string;
  name: string;
  description: string | null;
  coefficient: number;
  sortOrder: number;
  tournamentCount: number;
  rules: Rule[];
}

/** Yangi daraja uchun boshlang'ich reglament — nolga to'ldirilgan barcha kalitlar */
const emptyForm = (keys: RuleKey[]) => ({
  code: '',
  name: '',
  description: '',
  sortOrder: 0,
  points: Object.fromEntries(keys.map((k) => [k.key, 0])) as Record<string, number>,
});

/**
 * Musobaqa darajalari = reglament.
 * To'rtta qiymat: ishtirok, guruhdan chiqish, har bir g'alaba, chempionlik.
 * Musobaqa ochilganda daraja tanlanadi va hakam o'yinni yakunlaganda
 * ballar aynan shu jadval bo'yicha avtomatik beriladi.
 */
export default function AdminLevelsPage() {
  const [levels, setLevels] = useState<Level[]>([]);
  const [ruleKeys, setRuleKeys] = useState<RuleKey[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm([]));
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<Level[]>('/levels').then(setLevels).catch(() => setLevels([]));
  }, []);

  useEffect(() => {
    load();
    api
      .get<RuleKey[]>('/levels/rule-keys')
      .then((keys) => {
        setRuleKeys(keys);
        setForm(emptyForm(keys));
      })
      .catch(() => setRuleKeys([]));
  }, [load]);

  function fail(e: unknown) {
    setError(e instanceof ApiError || e instanceof Error ? e.message : String(e));
    setMsg(null);
  }

  function open(level?: Level) {
    const f = emptyForm(ruleKeys);
    if (level) {
      f.code = level.code;
      f.name = level.name;
      f.description = level.description ?? '';
      f.sortOrder = level.sortOrder;
      for (const r of level.rules) f.points[r.key] = r.points;
    }
    setForm(f);
    setEditing(level?.code ?? '');
    setError(null);
  }

  async function save() {
    const rules = ruleKeys.map((k) => ({
      key: k.key,
      points: Number(form.points[k.key]) || 0,
    }));
    try {
      if (editing) {
        await api.put(`/levels/${editing}`, {
          name: form.name,
          description: form.description || undefined,
          sortOrder: Number(form.sortOrder) || 0,
          rules,
        });
      } else {
        await api.post('/levels', {
          code: form.code.toUpperCase(),
          name: form.name,
          description: form.description || undefined,
          sortOrder: Number(form.sortOrder) || 0,
          rules,
        });
      }
      setMsg(editing ? 'Daraja yangilandi' : 'Daraja qo‘shildi');
      setError(null);
      setEditing(null);
      load();
    } catch (e) {
      fail(e);
    }
  }

  async function remove(level: Level) {
    try {
      await api.del(`/levels/${level.code}`);
      setMsg(`${level.name} o‘chirildi`);
      setError(null);
      load();
    } catch (e) {
      fail(e);
    }
  }

  const total = ruleKeys.reduce(
    (sum, k) => sum + (Number(form.points[k.key]) || 0),
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Musobaqa darajalari"
        description="Har daraja — reglament: ishtirok, guruhdan chiqish, har bir g‘alaba va chempionlik uchun necha ball berilishi. Musobaqa ochilganda daraja tanlanadi; hakam o‘yinni yakunlashi bilan ballar avtomatik qo‘shiladi va reyting yangilanadi."
        action={
          editing === null && (
            <Button variant="primary" onClick={() => open()}>
              + Yangi daraja
            </Button>
          )
        }
      />

      {msg && <Alert kind="success">{msg}</Alert>}
      {error && <Alert kind="danger">{error}</Alert>}

      {editing !== null && (
        <Card
          title={editing ? `Daraja: ${editing}` : 'Yangi daraja'}
          description="Reglamentdagi qiymatlar shu darajadagi barcha musobaqalarga qo‘llanadi."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label="Kod"
              hint="Masalan NATIONAL. Yaratilgandan keyin o‘zgarmaydi."
              required
            >
              <input
                value={form.code}
                disabled={!!editing}
                onChange={(e) =>
                  setForm({ ...form, code: e.target.value.toUpperCase() })
                }
                placeholder="NATIONAL"
                className={`${inputClass} font-mono disabled:opacity-60`}
              />
            </Field>
            <Field label="Nomi" required className="lg:col-span-2">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Respublika chempionati"
                className={inputClass}
              />
            </Field>
            <Field label="Tartib raqami" hint="Ro‘yxatdagi joyi">
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm({ ...form, sortOrder: Number(e.target.value) })
                }
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Izoh" className="mt-4">
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Eng yuqori daraja — milliy chempionat va kubok"
              className={inputClass}
            />
          </Field>

          <div className="mt-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="eyebrow">Ball reglamenti</span>
              <span className="text-xs text-muted">
                Chempion yo‘lidagi maksimal yig‘indi:{' '}
                <span className="font-heading font-bold text-ink">{total}</span> ball
              </span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ruleKeys.map((k) => (
                <Field key={k.key} label={k.label}>
                  <input
                    type="number"
                    min={0}
                    value={form.points[k.key] ?? 0}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        points: { ...form.points, [k.key]: Number(e.target.value) },
                      })
                    }
                    className={`${inputClass} tabular-nums`}
                  />
                </Field>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">
              <b>Ishtirok</b> — o‘yinchi musobaqadagi birinchi o‘yinini
              o‘ynaganda bir marta. <b>Har bir g‘alaba</b> — guruhda ham,
              setkada ham har yutuq uchun. <b>Chempionlik</b> — final g‘olibiga
              g‘alaba ballidan tashqari. <b>Guruhdan chiqish</b> — setka
              tuzilganda guruh bosqichini o‘tganlarga. Ballar hakam o‘yinni
              yakunlashi bilan avtomatik qo‘shiladi.
            </p>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
            <Button
              variant="primary"
              disabled={!form.name || (!editing && !form.code)}
              onClick={save}
            >
              Saqlash
            </Button>
            <Button variant="ghost" onClick={() => setEditing(null)} className="ml-auto">
              Bekor qilish
            </Button>
          </div>
        </Card>
      )}

      {levels.length === 0 ? (
        <EmptyState
          title="Daraja yo‘q"
          hint="Musobaqa ochish uchun kamida bitta daraja kerak."
          action={
            <Button variant="primary" onClick={() => open()}>
              + Yangi daraja
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {levels.map((level) => {
            const champion = level.rules.find((r) => r.key === 'CHAMPION');
            return (
              <div
                key={level.id}
                className="rounded-card border border-border bg-surface-card p-4"
              >
                <Row className="border-0 bg-transparent p-0">
                  <code className="text-xs text-accent-500">{level.code}</code>
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold">{level.name}</span>
                    {level.description && (
                      <span className="ml-2 text-sm text-muted">
                        {level.description}
                      </span>
                    )}
                  </div>
                  {champion && (
                    <Badge tone="warn">Chempion: {champion.points}</Badge>
                  )}
                  <Badge>{level.tournamentCount} musobaqa</Badge>
                  <Button size="sm" onClick={() => open(level)}>
                    Tahrirlash
                  </Button>
                  {level.tournamentCount === 0 && (
                    <ConfirmButton onConfirm={() => remove(level)} />
                  )}
                </Row>

                {level.rules.length === 0 ? (
                  <p className="mt-3 text-sm text-accent-400">
                    Reglament kiritilmagan — ballar eski usulda (bosqich balli ×{' '}
                    {level.coefficient}) hisoblanadi.
                  </p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                    {level.rules.map((r) => (
                      <span
                        key={r.key}
                        className="rounded-md bg-surface-raised px-2.5 py-1 text-xs"
                      >
                        <span className="text-muted">{r.label}:</span>{' '}
                        <span className="font-heading font-bold tabular-nums">
                          {r.points}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
