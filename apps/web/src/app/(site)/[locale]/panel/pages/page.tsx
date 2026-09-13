'use client';

import { useCallback, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
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

const LOCALES = ['uz', 'ru', 'en'] as const;
type Locale = (typeof LOCALES)[number];
const LOCALE_LABEL: Record<Locale, string> = {
  uz: "O'zbekcha",
  ru: 'Ruscha',
  en: 'Inglizcha',
};

interface PageTr {
  locale: string;
  title: string;
  body: string;
}
interface PageRow {
  id: string;
  key: string;
  isSystem: boolean;
  showInFooter: boolean;
  sortOrder: number;
  updatedAt: string;
  translations: PageTr[];
}

const emptyForm = () => ({
  key: '',
  showInFooter: true,
  sortOrder: 0,
  tr: {
    uz: { title: '', body: '' },
    ru: { title: '', body: '' },
    en: { title: '', body: '' },
  } as Record<Locale, { title: string; body: string }>,
});

/**
 * Statik sahifalar (maxfiylik siyosati, foydalanish shartlari...).
 * Matn markdown'da — nashrdagi ko'rinishini shu yerda tekshirish mumkin.
 */
export default function AdminPagesPage() {
  const [rows, setRows] = useState<PageRow[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [tab, setTab] = useState<Locale>('uz');
  const [preview, setPreview] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<PageRow[]>('/pages/admin/all')
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  useEffect(load, [load]);

  function fail(e: unknown) {
    setError(e instanceof ApiError || e instanceof Error ? e.message : String(e));
    setMsg(null);
  }

  function open(row?: PageRow) {
    const f = emptyForm();
    if (row) {
      f.key = row.key;
      f.showInFooter = row.showInFooter;
      f.sortOrder = row.sortOrder;
      for (const l of LOCALES) {
        const t = row.translations.find((x) => x.locale === l);
        f.tr[l] = { title: t?.title ?? '', body: t?.body ?? '' };
      }
    }
    setForm(f);
    setTab('uz');
    setPreview(false);
    setError(null);
    setEditing(row?.id ?? '');
  }

  async function save() {
    const translations = LOCALES.filter(
      (l) => form.tr[l].title && form.tr[l].body,
    ).map((l) => ({ locale: l, title: form.tr[l].title, body: form.tr[l].body }));
    if (translations.length === 0) {
      setError("Kamida bitta tilda sarlavha va matn to'ldirilsin");
      return;
    }
    try {
      if (editing) {
        await api.put(`/pages/${editing}`, {
          showInFooter: form.showInFooter,
          sortOrder: Number(form.sortOrder) || 0,
          translations,
        });
      } else {
        await api.post('/pages', {
          key: form.key,
          showInFooter: form.showInFooter,
          sortOrder: Number(form.sortOrder) || 0,
          translations,
        });
      }
      setMsg(editing ? 'Sahifa yangilandi' : 'Sahifa yaratildi');
      setError(null);
      setEditing(null);
      load();
    } catch (e) {
      fail(e);
    }
  }

  async function remove(row: PageRow) {
    try {
      await api.del(`/pages/${row.id}`);
      setMsg(`${row.key} o‘chirildi`);
      setError(null);
      load();
    } catch (e) {
      fail(e);
    }
  }

  const current = form.tr[tab];
  const setCurrent = (patch: Partial<{ title: string; body: string }>) =>
    setForm((f) => ({ ...f, tr: { ...f.tr, [tab]: { ...f.tr[tab], ...patch } } }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Statik sahifalar"
        description="Maxfiylik siyosati, foydalanish shartlari va boshqa doimiy matnlar. Footer havolalari shu ro‘yxatdan quriladi."
        action={
          editing === null && (
            <Button variant="primary" onClick={() => open()}>
              + Yangi sahifa
            </Button>
          )
        }
      />

      {msg && <Alert kind="success">{msg}</Alert>}
      {error && <Alert kind="danger">{error}</Alert>}

      {editing !== null && (
        <Card title={editing ? 'Sahifani tahrirlash' : 'Yangi sahifa'}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Kalit"
              hint="URL: /sahifa/<kalit>. Mavjud sahifada o‘zgarmaydi."
              required
            >
              <input
                value={form.key}
                disabled={!!editing}
                onChange={(e) => setForm({ ...form, key: e.target.value })}
                placeholder="privacy"
                className={`${inputClass} disabled:opacity-60`}
              />
            </Field>
            <Field label="Tartib raqami">
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm({ ...form, sortOrder: Number(e.target.value) })
                }
                className={inputClass}
              />
            </Field>
            <label className="flex items-end gap-2 pb-2.5">
              <input
                type="checkbox"
                checked={form.showInFooter}
                onChange={(e) =>
                  setForm({ ...form, showInFooter: e.target.checked })
                }
                className="size-4"
              />
              <span className="text-sm">Footerda ko‘rsatilsin</span>
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {LOCALES.map((l) => {
              const done = !!(form.tr[l].title && form.tr[l].body);
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => setTab(l)}
                  className={`inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors ${
                    tab === l
                      ? 'bg-accent-500 text-white'
                      : 'bg-surface-raised text-muted hover:text-ink'
                  }`}
                >
                  {LOCALE_LABEL[l]}
                  <span
                    aria-hidden
                    className={`size-1.5 rounded-full ${done ? 'bg-win' : 'bg-muted/40'}`}
                  />
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-4">
            <Field label={`Sarlavha — ${LOCALE_LABEL[tab]}`} required>
              <input
                value={current.title}
                onChange={(e) => setCurrent({ title: e.target.value })}
                className={inputClass}
              />
            </Field>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">
                  Matn — {LOCALE_LABEL[tab]}
                  <span className="ml-1 text-accent-400">*</span>
                </span>
                <Button size="sm" onClick={() => setPreview((v) => !v)}>
                  {preview ? 'Tahrirlash' : "Ko'rinishi"}
                </Button>
              </div>
              {preview ? (
                <div className="prose-uztt min-h-60 rounded-md border border-border bg-surface-raised px-3 py-2.5">
                  <ReactMarkdown>{current.body || '_Matn bo‘sh_'}</ReactMarkdown>
                </div>
              ) : (
                <textarea
                  value={current.body}
                  onChange={(e) => setCurrent({ body: e.target.value })}
                  rows={14}
                  className={`${inputClass} font-mono text-[13px]`}
                />
              )}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
            <Button
              variant="primary"
              disabled={!editing && !form.key}
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

      {rows.length === 0 ? (
        <EmptyState
          title="Sahifa yo‘q"
          hint="Maxfiylik siyosati va foydalanish shartlari seed bilan keladi; qo‘shimchasini shu yerda yarating."
        />
      ) : (
        <div className="space-y-2">
          {rows.map((p) => (
            <Row key={p.id}>
              <code className="text-xs text-accent-500">/{p.key}</code>
              <span className="min-w-0 flex-1 truncate font-semibold">
                {p.translations.find((t) => t.locale === 'uz')?.title ?? '—'}
              </span>
              {p.isSystem && <Badge tone="court">tizim</Badge>}
              {!p.showInFooter && <Badge>footerda yo‘q</Badge>}
              <span className="text-xs uppercase text-muted">
                {p.translations.map((t) => t.locale).join(' · ')}
              </span>
              <Button size="sm" onClick={() => open(p)}>
                Tahrirlash
              </Button>
              {!p.isSystem && <ConfirmButton onConfirm={() => remove(p)} />}
            </Row>
          ))}
        </div>
      )}
    </div>
  );
}
