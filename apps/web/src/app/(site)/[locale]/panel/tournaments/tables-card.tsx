'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Button, Field, inputClass } from '@/components/panel/ui';

/** Scoreboard'dagi stollar soni (COURTS, standart 10) bilan bir xil */
const MAX_TABLES = 10;

/** Stol soni va asosiy stollar: yangi musobaqa formasi va tanlangan musobaqa uchun */
export function TablesPicker({
  count,
  main,
  onChange,
}: {
  count: string;
  main: number[];
  onChange: (count: string, main: number[]) => void;
}) {
  const n = Math.min(Number(count) || 0, MAX_TABLES);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Stollar soni" hint={`Ko‘pi bilan ${MAX_TABLES} ta`}>
        <input
          type="number"
          min={1}
          max={MAX_TABLES}
          value={count}
          onChange={(e) => {
            const next = Math.min(Number(e.target.value) || 0, MAX_TABLES);
            onChange(e.target.value, main.filter((t) => t <= next));
          }}
          className={inputClass}
        />
      </Field>
      <Field label="Asosiy stollar" hint="Final, yarim final va reytingi baland o‘yinlar shu yerga tushadi">
        <div className="flex min-h-10 flex-wrap items-center gap-3">
          {n === 0 && <span className="text-sm text-muted">Avval stollar sonini kiriting</span>}
          {Array.from({ length: n }, (_, i) => i + 1).map((t) => (
            <label key={t} className="flex items-center gap-1.5 text-sm font-semibold">
              <input
                type="checkbox"
                checked={main.includes(t)}
                onChange={(e) =>
                  onChange(count, e.target.checked ? [...main, t].sort((a, b) => a - b) : main.filter((x) => x !== t))
                }
              />
              {t}
            </label>
          ))}
        </div>
      </Field>
    </div>
  );
}

/** Tanlangan musobaqa: stol sozlamasini saqlash va o'yinlarga taqsimlash */
export function TablesCard({
  tournament,
  onChanged,
  onMessage,
  onError,
}: {
  tournament: { id: string; tableCount?: number | null; mainTables?: number[] };
  onChanged: () => void;
  onMessage: (msg: string) => void;
  onError: (e: unknown) => void;
}) {
  const [count, setCount] = useState(tournament.tableCount ? String(tournament.tableCount) : '');
  const [main, setMain] = useState<number[]>(tournament.mainTables ?? []);
  const [busy, setBusy] = useState(false);

  async function run(all: boolean) {
    if (all && !window.confirm('Boshlanmagan hamma o‘yinning stoli qaytadan belgilanadi, qo‘lda qo‘yilganlari ham. Davom etasizmi?')) return;
    setBusy(true);
    try {
      await api.put(`/tournaments/${tournament.id}`, { tableCount: Number(count), mainTables: main });
      const { assigned } = await api.post<{ assigned: number }>(`/tournaments/${tournament.id}/assign-tables`, { all });
      onMessage(assigned ? `${assigned} ta o‘yinga stol belgilandi` : 'Sozlama saqlandi. Stol kutayotgan o‘yin yo‘q');
      onChanged();
    } catch (e) {
      onError(e instanceof ApiError ? e : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-border bg-surface-card p-4">
      <h3 className="font-heading text-sm font-bold uppercase">Stollar</h3>
      <div className="mt-3">
        <TablesPicker
          count={count}
          main={main}
          onChange={(c, m) => {
            setCount(c);
            setMain(m);
          }}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" disabled={busy || !Number(count)} onClick={() => run(false)}>
          Saqlash va stolsizlarni taqsimlash
        </Button>
        <Button size="sm" variant="ghost" disabled={busy || !Number(count)} onClick={() => run(true)}>
          Hammasini qayta taqsimlash
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted">
        Qura tashlanganda stollar o‘zi belgilanadi. Har o‘yinning stolini pastdagi ro‘yxatda o‘zgartirish mumkin.
      </p>
    </div>
  );
}
