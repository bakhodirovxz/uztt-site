'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useRouter } from '@/i18n/navigation';
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

interface Translation {
  locale: string;
  title: string;
  slug?: string;
  excerpt?: string;
  body: string;
}
interface Article {
  id: string;
  status: 'DRAFT' | 'PUBLISHED';
  category: string | null;
  isFeatured: boolean;
  tournamentId: string | null;
  translations: Translation[];
}
interface TournamentOption {
  id: string;
  name: string;
  startDate: string;
}

const LOCALES = ['uz', 'ru', 'en'] as const;
const LOCALE_LABEL: Record<string, string> = {
  uz: "O'zbekcha",
  ru: 'Ruscha',
  en: 'Inglizcha',
};
const emptyForm = () =>
  LOCALES.map((l) => ({ locale: l, title: '', excerpt: '', body: '' }));

/**
 * Yangiliklar CRUD: ro'yxat asosiy ekran, forma faqat kerak bo'lganda ochiladi.
 * Har til alohida tab, to'ldirilgani belgilanadi — nima qolgani ko'rinib turadi.
 */
export default function AdminNewsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Article[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Article | null>(null);
  const [form, setForm] = useState<Translation[]>(emptyForm());
  const [category, setCategory] = useState('');
  const [tournamentId, setTournamentId] = useState('');
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [preview, setPreview] = useState(false);
  const [tab, setTab] = useState<string>('uz');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .get<Article[]>('/news/admin/all')
      .then(setItems)
      .catch((e) => {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          router.replace('/login');
        }
      });
  }, [router]);

  useEffect(load, [load]);

  useEffect(() => {
    api
      .get<TournamentOption[]>('/tournaments')
      .then(setTournaments)
      .catch(() => setTournaments([]));
  }, []);

  function openForm(a: Article | null) {
    setEditing(a);
    setCategory(a?.category ?? '');
    setTournamentId(a?.tournamentId ?? '');
    setPreview(false);
    setForm(
      LOCALES.map(
        (l) =>
          a?.translations.find((t) => t.locale === l) ?? {
            locale: l,
            title: '',
            excerpt: '',
            body: '',
          },
      ),
    );
    setTab('uz');
    setError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setForm(emptyForm());
    setCategory('');
    setTournamentId('');
    setPreview(false);
    setError(null);
  }

  async function save(status: 'DRAFT' | 'PUBLISHED') {
    setBusy(true);
    setError(null);
    try {
      const translations = form.filter((t) => t.title && t.body);
      if (translations.length === 0) {
        throw new Error('Kamida bitta tilda sarlavha va matn to‘ldirilsin');
      }
      const payload = {
        category: category || undefined,
        tournamentId: tournamentId || undefined,
        status,
        translations,
      };
      if (editing) await api.put(`/news/${editing.id}`, payload);
      else await api.post('/news', payload);
      setMsg(
        status === 'PUBLISHED'
          ? 'Yangilik nashr qilindi'
          : 'Qoralama saqlandi',
      );
      closeForm();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await api.del(`/news/${id}`).catch(() => undefined);
    setMsg('Yangilik o‘chirildi');
    load();
  }

  const current = form.find((f) => f.locale === tab)!;
  const setCurrent = (patch: Partial<Translation>) =>
    setForm((prev) => prev.map((f) => (f.locale === tab ? { ...f, ...patch } : f)));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((a) =>
      a.translations.some((t) => t.title.toLowerCase().includes(q)),
    );
  }, [items, query]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Yangiliklar"
        description="Uch tilda yozing — to‘ldirilgan tillar nashr qilinadi, qolgani o‘tkazib yuboriladi."
        action={
          !formOpen && (
            <Button variant="primary" onClick={() => openForm(null)}>
              + Yangi yangilik
            </Button>
          )
        }
      />

      {msg && <Alert kind="success">{msg}</Alert>}

      {formOpen && (
        <Card
          title={editing ? 'Yangilikni tahrirlash' : 'Yangi yangilik'}
          description="Har til uchun alohida sarlavha va matn"
        >
          {/* Til tablari — to'ldirilgani nuqta bilan belgilanadi */}
          <div className="flex flex-wrap items-center gap-2">
            {LOCALES.map((l) => {
              const filled = form.find((f) => f.locale === l);
              const done = !!(filled?.title && filled?.body);
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

            <Field
              label={`Qisqa matn — ${LOCALE_LABEL[tab]}`}
              hint="Ro‘yxatlarda va ijtimoiy tarmoqlarda ko‘rinadi"
            >
              <input
                value={current.excerpt ?? ''}
                onChange={(e) => setCurrent({ excerpt: e.target.value })}
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
                // Nashrdagi tipografiya bilan bir xil — nima chiqishi shu yerda ko'rinadi
                <div className="prose-uztt min-h-40 rounded-md border border-border bg-surface-raised px-3 py-2.5">
                  <ReactMarkdown>{current.body || '_Matn bo‘sh_'}</ReactMarkdown>
                </div>
              ) : (
                <textarea
                  value={current.body}
                  onChange={(e) => setCurrent({ body: e.target.value })}
                  rows={8}
                  className={inputClass}
                />
              )}
              <span className="mt-1 block text-xs text-muted">
                Markdown qo‘llab-quvvatlanadi: ## sarlavha, **qalin**, - ro‘yxat
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Kategoriya" hint="Masalan: musobaqa, reyting, yangilik">
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field
                label="Musobaqa"
                hint="Tanlansa, yangilik o‘sha musobaqa sahifasida ham chiqadi"
              >
                <select
                  value={tournamentId}
                  onChange={(e) => setTournamentId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">— bog‘lanmagan —</option>
                  {tournaments.map((tr) => (
                    <option key={tr.id} value={tr.id}>
                      {tr.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          {error && (
            <div className="mt-4">
              <Alert kind="danger">{error}</Alert>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
            <Button variant="primary" disabled={busy} onClick={() => save('PUBLISHED')}>
              {busy ? 'Saqlanmoqda…' : 'Nashr qilish'}
            </Button>
            <Button disabled={busy} onClick={() => save('DRAFT')}>
              Qoralama sifatida saqlash
            </Button>
            <Button variant="ghost" onClick={closeForm} className="ml-auto">
              Bekor qilish
            </Button>
          </div>
        </Card>
      )}

      {/* Ro'yxat */}
      {items.length > 4 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Sarlavha bo‘yicha qidirish"
          aria-label="Yangiliklarni qidirish"
          className={`${inputClass} sm:max-w-sm`}
        />
      )}

      {filtered.length === 0 ? (
        <EmptyState
          title={query ? 'Hech narsa topilmadi' : 'Hozircha yangilik yo‘q'}
          hint={
            query
              ? 'Boshqa so‘z bilan qidirib ko‘ring.'
              : 'Birinchi yangilikni yozing — u bosh sahifada darhol ko‘rinadi.'
          }
          action={
            !query && (
              <Button variant="primary" onClick={() => openForm(null)}>
                + Yangi yangilik
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => {
            const uz =
              a.translations.find((t) => t.locale === 'uz') ?? a.translations[0];
            return (
              <Row key={a.id}>
                <Badge tone={a.status === 'PUBLISHED' ? 'success' : 'neutral'}>
                  {a.status === 'PUBLISHED' ? 'Nashrda' : 'Qoralama'}
                </Badge>
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {uz?.title}
                </span>
                <span className="text-xs uppercase text-muted">
                  {a.translations.map((t) => t.locale).join(' · ')}
                </span>
                <Button size="sm" onClick={() => openForm(a)}>
                  Tahrirlash
                </Button>
                <ConfirmButton onConfirm={() => remove(a.id)} />
              </Row>
            );
          })}
        </div>
      )}
    </div>
  );
}
