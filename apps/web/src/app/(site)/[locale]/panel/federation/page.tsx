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

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const LOCALES = ['uz', 'ru', 'en'] as const;
type Locale = (typeof LOCALES)[number];

const STAFF_TYPES = [
  { value: 'EXECUTIVE', label: 'Rahbariyat' },
  { value: 'STAFF', label: 'Xodim' },
] as const;

const DOC_CATEGORIES = [
  { value: 'TECHNICAL', label: 'Texnik' },
  { value: 'MEDIA', label: 'Media' },
  { value: 'LEGAL', label: 'Huquqiy' },
] as const;

interface StaffTr {
  locale: string;
  fullName: string;
  position: string;
  bio?: string | null;
}
interface StaffRow {
  id: string;
  type: 'EXECUTIVE' | 'STAFF';
  photoUrl: string | null;
  email: string | null;
  phone: string | null;
  sortOrder: number;
  translations: StaffTr[];
}

interface DocTr {
  locale: string;
  title: string;
}
interface DocRow {
  id: string;
  category: 'TECHNICAL' | 'MEDIA' | 'LEGAL';
  fileUrl: string;
  fileSize: number | null;
  publishedAt: string;
  translations: DocTr[];
}

interface SponsorRow {
  id: string;
  name: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  tier: number;
  sortOrder: number;
}

type StaffForm = {
  type: 'EXECUTIVE' | 'STAFF';
  photoUrl: string;
  email: string;
  phone: string;
  sortOrder: number;
  tr: Record<Locale, { fullName: string; position: string; bio: string }>;
};

const emptyStaff = (): StaffForm => ({
  type: 'STAFF',
  photoUrl: '',
  email: '',
  phone: '',
  sortOrder: 0,
  tr: {
    uz: { fullName: '', position: '', bio: '' },
    ru: { fullName: '', position: '', bio: '' },
    en: { fullName: '', position: '', bio: '' },
  },
});

const emptyDoc = () => ({
  category: 'TECHNICAL' as DocRow['category'],
  fileUrl: '',
  fileSize: 0,
  mimeType: '',
  tr: { uz: '', ru: '', en: '' } as Record<Locale, string>,
});

const emptySponsor = () => ({
  name: '',
  logoUrl: '',
  websiteUrl: '',
  tier: 1,
  sortOrder: 0,
});

const trOf = <T extends { locale: string }>(rows: T[], locale: Locale) =>
  rows.find((t) => t.locale === locale);

/**
 * Federatsiya kontenti: rahbariyat/xodimlar, hujjatlar, homiylar.
 * Uch bo'lim bitta sahifada — hammasi `page.manage` huquqi ostida.
 */
export default function AdminFederationPage() {
  const [tab, setTab] = useState<'staff' | 'documents' | 'sponsors'>('staff');
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [sponsors, setSponsors] = useState<SponsorRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Tahrirlanayotgan yozuv (null = forma yopiq, '' = yangi yozuv)
  const [staffEdit, setStaffEdit] = useState<string | null>(null);
  const [staffForm, setStaffForm] = useState<StaffForm>(emptyStaff());
  const [docEdit, setDocEdit] = useState<string | null>(null);
  const [docForm, setDocForm] = useState(emptyDoc());
  const [sponsorEdit, setSponsorEdit] = useState<string | null>(null);
  const [sponsorForm, setSponsorForm] = useState(emptySponsor());

  const load = useCallback(() => {
    api.get<StaffRow[]>('/federation/admin/staff').then(setStaff).catch(() => {});
    api.get<DocRow[]>('/federation/admin/documents').then(setDocs).catch(() => {});
    api.get<SponsorRow[]>('/federation/sponsors').then(setSponsors).catch(() => {});
  }, []);

  useEffect(load, [load]);

  function ok(m: string) {
    setMsg(m);
    setError(null);
    load();
  }
  function fail(e: unknown) {
    setError(e instanceof ApiError || e instanceof Error ? e.message : String(e));
    setMsg(null);
  }

  /** Rasm/hujjat yuklash — URL qaytaradi (sharp yoki magic-byte tekshiruvidan o'tadi) */
  async function upload(file: File, kind: 'image' | 'document') {
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API_BASE}/api/uploads/${kind}`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      const asset = (await res.json()) as {
        url?: string;
        size?: number;
        mimeType?: string;
        message?: string;
      };
      if (!res.ok || !asset.url) throw new Error(asset.message ?? 'Yuklash xatosi');
      return asset;
    } finally {
      setBusy(false);
    }
  }

  // ==================== XODIMLAR ====================

  function openStaff(row?: StaffRow) {
    if (!row) {
      setStaffForm(emptyStaff());
      setStaffEdit('');
      return;
    }
    const form = emptyStaff();
    form.type = row.type;
    form.photoUrl = row.photoUrl ?? '';
    form.email = row.email ?? '';
    form.phone = row.phone ?? '';
    form.sortOrder = row.sortOrder;
    for (const l of LOCALES) {
      const t = trOf(row.translations, l);
      form.tr[l] = {
        fullName: t?.fullName ?? '',
        position: t?.position ?? '',
        bio: t?.bio ?? '',
      };
    }
    setStaffForm(form);
    setStaffEdit(row.id);
  }

  async function saveStaff() {
    const translations = LOCALES.filter((l) => staffForm.tr[l].fullName).map((l) => ({
      locale: l,
      fullName: staffForm.tr[l].fullName,
      position: staffForm.tr[l].position,
      bio: staffForm.tr[l].bio || undefined,
    }));
    const body = {
      type: staffForm.type,
      photoUrl: staffForm.photoUrl || undefined,
      email: staffForm.email || undefined,
      phone: staffForm.phone || undefined,
      sortOrder: Number(staffForm.sortOrder) || 0,
      translations,
    };
    try {
      if (staffEdit) await api.put(`/federation/staff/${staffEdit}`, body);
      else await api.post('/federation/staff', body);
      setStaffEdit(null);
      ok(staffEdit ? 'Xodim yangilandi' : "Xodim qo'shildi");
    } catch (e) {
      fail(e);
    }
  }

  // ==================== HUJJATLAR ====================

  function openDoc(row?: DocRow) {
    if (!row) {
      setDocForm(emptyDoc());
      setDocEdit('');
      return;
    }
    setDocForm({
      category: row.category,
      fileUrl: row.fileUrl,
      fileSize: row.fileSize ?? 0,
      mimeType: '',
      tr: {
        uz: trOf(row.translations, 'uz')?.title ?? '',
        ru: trOf(row.translations, 'ru')?.title ?? '',
        en: trOf(row.translations, 'en')?.title ?? '',
      },
    });
    setDocEdit(row.id);
  }

  async function saveDoc() {
    const translations = LOCALES.filter((l) => docForm.tr[l]).map((l) => ({
      locale: l,
      title: docForm.tr[l],
    }));
    try {
      if (docEdit) {
        await api.put(`/federation/documents/${docEdit}`, {
          category: docForm.category,
          fileUrl: docForm.fileUrl,
          translations,
        });
      } else {
        await api.post('/federation/documents', {
          category: docForm.category,
          fileUrl: docForm.fileUrl,
          fileSize: docForm.fileSize || undefined,
          mimeType: docForm.mimeType || undefined,
          translations,
        });
      }
      setDocEdit(null);
      ok(docEdit ? 'Hujjat yangilandi' : "Hujjat qo'shildi");
    } catch (e) {
      fail(e);
    }
  }

  // ==================== HOMIYLAR ====================

  function openSponsor(row?: SponsorRow) {
    if (!row) {
      setSponsorForm(emptySponsor());
      setSponsorEdit('');
      return;
    }
    setSponsorForm({
      name: row.name,
      logoUrl: row.logoUrl ?? '',
      websiteUrl: row.websiteUrl ?? '',
      tier: row.tier,
      sortOrder: row.sortOrder,
    });
    setSponsorEdit(row.id);
  }

  async function saveSponsor() {
    const body = {
      name: sponsorForm.name,
      logoUrl: sponsorForm.logoUrl || undefined,
      websiteUrl: sponsorForm.websiteUrl || undefined,
      tier: Number(sponsorForm.tier) || 1,
      sortOrder: Number(sponsorForm.sortOrder) || 0,
    };
    try {
      if (sponsorEdit) await api.put(`/federation/sponsors/${sponsorEdit}`, body);
      else await api.post('/federation/sponsors', body);
      setSponsorEdit(null);
      ok(sponsorEdit ? 'Homiy yangilandi' : "Homiy qo'shildi");
    } catch (e) {
      fail(e);
    }
  }

  async function remove(path: string, label: string) {
    try {
      await api.del(path);
      ok(`${label} o‘chirildi`);
    } catch (e) {
      fail(e);
    }
  }

  const TABS = [
    { key: 'staff' as const, label: `Xodimlar (${staff.length})` },
    { key: 'documents' as const, label: `Hujjatlar (${docs.length})` },
    { key: 'sponsors' as const, label: `Homiylar (${sponsors.length})` },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Federatsiya"
        description="Rahbariyat va xodimlar, rasmiy hujjatlar, homiylar — /federatsiya sahifasining manbasi."
      />

      {msg && <Alert kind="success">{msg}</Alert>}
      {error && <Alert kind="danger">{error}</Alert>}

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`min-h-9 rounded-full px-4 text-sm font-semibold transition-colors ${
              tab === t.key
                ? 'bg-navy-900 text-accent-500'
                : 'text-muted hover:bg-surface-raised hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ==================== XODIMLAR ==================== */}
      {tab === 'staff' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              variant={staffEdit === null ? 'primary' : 'ghost'}
              onClick={() => (staffEdit === null ? openStaff() : setStaffEdit(null))}
            >
              {staffEdit === null ? '+ Yangi xodim' : 'Yopish'}
            </Button>
          </div>

          {staffEdit !== null && (
            <Card title={staffEdit ? 'Xodimni tahrirlash' : 'Yangi xodim'}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Turi" required>
                  <select
                    value={staffForm.type}
                    onChange={(e) =>
                      setStaffForm({
                        ...staffForm,
                        type: e.target.value as StaffForm['type'],
                      })
                    }
                    className={inputClass}
                  >
                    {STAFF_TYPES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Tartib raqami" hint="Kichik raqam yuqorida turadi">
                  <input
                    type="number"
                    value={staffForm.sortOrder}
                    onChange={(e) =>
                      setStaffForm({ ...staffForm, sortOrder: Number(e.target.value) })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Email">
                  <input
                    value={staffForm.email}
                    onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Telefon">
                  <input
                    value={staffForm.phone}
                    onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field
                label="Surat"
                hint="JPEG/PNG/WebP — webp'ga o'giriladi"
                className="mt-4"
              >
                <div className="flex flex-wrap items-center gap-3">
                  {staffForm.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`${API_BASE}${staffForm.photoUrl}`}
                      alt=""
                      className="h-14 w-14 rounded-full object-cover"
                    />
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={busy}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        const a = await upload(f, 'image');
                        setStaffForm((s) => ({ ...s, photoUrl: a.url! }));
                      } catch (err) {
                        fail(err);
                      }
                    }}
                    className="text-sm"
                  />
                </div>
              </Field>

              <div className="mt-4 space-y-4">
                {LOCALES.map((l) => (
                  <div key={l} className="rounded-md border border-border p-4">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
                      {l.toUpperCase()}
                      {l === 'uz' && <span className="ml-1 text-accent-400">*</span>}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="F.I.Sh." required={l === 'uz'}>
                        <input
                          value={staffForm.tr[l].fullName}
                          onChange={(e) =>
                            setStaffForm({
                              ...staffForm,
                              tr: {
                                ...staffForm.tr,
                                [l]: { ...staffForm.tr[l], fullName: e.target.value },
                              },
                            })
                          }
                          className={inputClass}
                        />
                      </Field>
                      <Field label="Lavozimi" required={l === 'uz'}>
                        <input
                          value={staffForm.tr[l].position}
                          onChange={(e) =>
                            setStaffForm({
                              ...staffForm,
                              tr: {
                                ...staffForm.tr,
                                [l]: { ...staffForm.tr[l], position: e.target.value },
                              },
                            })
                          }
                          className={inputClass}
                        />
                      </Field>
                    </div>
                    <Field label="Qisqacha ma'lumot" className="mt-3">
                      <textarea
                        rows={2}
                        value={staffForm.tr[l].bio}
                        onChange={(e) =>
                          setStaffForm({
                            ...staffForm,
                            tr: {
                              ...staffForm.tr,
                              [l]: { ...staffForm.tr[l], bio: e.target.value },
                            },
                          })
                        }
                        className={inputClass}
                      />
                    </Field>
                  </div>
                ))}
              </div>

              <div className="mt-5 border-t border-border pt-4">
                <Button
                  variant="primary"
                  disabled={!staffForm.tr.uz.fullName || !staffForm.tr.uz.position}
                  onClick={saveStaff}
                >
                  {staffEdit ? 'Saqlash' : "Qo'shish"}
                </Button>
              </div>
            </Card>
          )}

          {staff.length === 0 ? (
            <EmptyState
              title="Xodim qo'shilmagan"
              hint="Rahbariyat va apparat xodimlari /federatsiya sahifasida shu ro'yxatdan chiqadi."
            />
          ) : (
            <div className="space-y-2">
              {staff.map((s) => {
                const t = trOf(s.translations, 'uz');
                return (
                  <Row key={s.id}>
                    {s.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`${API_BASE}${s.photoUrl}`}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-raised text-xs text-muted">
                        —
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold">{t?.fullName ?? '—'}</span>
                      <span className="ml-2 text-sm text-muted">{t?.position}</span>
                    </div>
                    <Badge tone={s.type === 'EXECUTIVE' ? 'court' : 'neutral'}>
                      {s.type === 'EXECUTIVE' ? 'Rahbariyat' : 'Xodim'}
                    </Badge>
                    <span className="text-xs text-muted">
                      {s.translations.length}/3 til
                    </span>
                    <Button size="sm" onClick={() => openStaff(s)}>
                      Tahrirlash
                    </Button>
                    <ConfirmButton
                      onConfirm={() =>
                        remove(`/federation/staff/${s.id}`, t?.fullName ?? 'Xodim')
                      }
                    />
                  </Row>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================== HUJJATLAR ==================== */}
      {tab === 'documents' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              variant={docEdit === null ? 'primary' : 'ghost'}
              onClick={() => (docEdit === null ? openDoc() : setDocEdit(null))}
            >
              {docEdit === null ? '+ Yangi hujjat' : 'Yopish'}
            </Button>
          </div>

          {docEdit !== null && (
            <Card title={docEdit ? 'Hujjatni tahrirlash' : 'Yangi hujjat'}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Bo'lim" required>
                  <select
                    value={docForm.category}
                    onChange={(e) =>
                      setDocForm({
                        ...docForm,
                        category: e.target.value as DocRow['category'],
                      })
                    }
                    className={inputClass}
                  >
                    {DOC_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Fayl" hint="PDF, DOCX yoki XLSX (25 MB gacha)" required>
                  <input
                    type="file"
                    accept=".pdf,.docx,.xlsx"
                    disabled={busy}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        const a = await upload(f, 'document');
                        setDocForm((d) => ({
                          ...d,
                          fileUrl: a.url!,
                          fileSize: a.size ?? 0,
                          mimeType: a.mimeType ?? '',
                        }));
                      } catch (err) {
                        fail(err);
                      }
                    }}
                    className="text-sm"
                  />
                </Field>
              </div>

              {docForm.fileUrl && (
                <p className="mt-2 text-xs text-muted">
                  Fayl:{' '}
                  <a
                    href={`${API_BASE}${docForm.fileUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-500 underline"
                  >
                    {docForm.fileUrl.split('/').pop()}
                  </a>
                </p>
              )}

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {LOCALES.map((l) => (
                  <Field key={l} label={`Sarlavha (${l})`} required={l === 'uz'}>
                    <input
                      value={docForm.tr[l]}
                      onChange={(e) =>
                        setDocForm({
                          ...docForm,
                          tr: { ...docForm.tr, [l]: e.target.value },
                        })
                      }
                      className={inputClass}
                    />
                  </Field>
                ))}
              </div>

              <div className="mt-5 border-t border-border pt-4">
                <Button
                  variant="primary"
                  disabled={!docForm.fileUrl || !docForm.tr.uz}
                  onClick={saveDoc}
                >
                  {docEdit ? 'Saqlash' : "Qo'shish"}
                </Button>
              </div>
            </Card>
          )}

          {docs.length === 0 ? (
            <EmptyState
              title="Hujjat yo'q"
              hint="Nizom, qoidalar va boshqa rasmiy hujjatlar shu yerdan yuklanadi."
            />
          ) : (
            <div className="space-y-2">
              {docs.map((d) => (
                <Row key={d.id}>
                  <div className="min-w-0 flex-1">
                    <a
                      href={`${API_BASE}${d.fileUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold hover:text-accent-500"
                    >
                      {trOf(d.translations, 'uz')?.title ?? d.fileUrl}
                    </a>
                    <p className="text-xs text-muted">
                      {d.fileSize ? `${Math.round(d.fileSize / 1024)} KB` : ''}{' '}
                      {new Date(d.publishedAt).toLocaleDateString('uz-UZ')}
                    </p>
                  </div>
                  <Badge>
                    {DOC_CATEGORIES.find((c) => c.value === d.category)?.label}
                  </Badge>
                  <Button size="sm" onClick={() => openDoc(d)}>
                    Tahrirlash
                  </Button>
                  <ConfirmButton
                    onConfirm={() =>
                      remove(`/federation/documents/${d.id}`, 'Hujjat')
                    }
                  />
                </Row>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== HOMIYLAR ==================== */}
      {tab === 'sponsors' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              variant={sponsorEdit === null ? 'primary' : 'ghost'}
              onClick={() =>
                sponsorEdit === null ? openSponsor() : setSponsorEdit(null)
              }
            >
              {sponsorEdit === null ? '+ Yangi homiy' : 'Yopish'}
            </Button>
          </div>

          {sponsorEdit !== null && (
            <Card title={sponsorEdit ? 'Homiyni tahrirlash' : 'Yangi homiy'}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nomi" required>
                  <input
                    value={sponsorForm.name}
                    onChange={(e) =>
                      setSponsorForm({ ...sponsorForm, name: e.target.value })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Sayti" hint="https:// bilan">
                  <input
                    value={sponsorForm.websiteUrl}
                    onChange={(e) =>
                      setSponsorForm({ ...sponsorForm, websiteUrl: e.target.value })
                    }
                    placeholder="https://example.uz"
                    className={inputClass}
                  />
                </Field>
                <Field label="Daraja" hint="1 = bosh homiy">
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={sponsorForm.tier}
                    onChange={(e) =>
                      setSponsorForm({ ...sponsorForm, tier: Number(e.target.value) })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Tartib raqami">
                  <input
                    type="number"
                    value={sponsorForm.sortOrder}
                    onChange={(e) =>
                      setSponsorForm({
                        ...sponsorForm,
                        sortOrder: Number(e.target.value),
                      })
                    }
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field label="Logotip" className="mt-4">
                <div className="flex flex-wrap items-center gap-3">
                  {sponsorForm.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`${API_BASE}${sponsorForm.logoUrl}`}
                      alt=""
                      className="h-10 w-auto"
                    />
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={busy}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        const a = await upload(f, 'image');
                        setSponsorForm((s) => ({ ...s, logoUrl: a.url! }));
                      } catch (err) {
                        fail(err);
                      }
                    }}
                    className="text-sm"
                  />
                </div>
              </Field>

              <div className="mt-5 border-t border-border pt-4">
                <Button variant="primary" disabled={!sponsorForm.name} onClick={saveSponsor}>
                  {sponsorEdit ? 'Saqlash' : "Qo'shish"}
                </Button>
              </div>
            </Card>
          )}

          {sponsors.length === 0 ? (
            <EmptyState title="Homiy yo'q" hint="Bosh sahifadagi homiylar lentasi shu ro'yxatdan quriladi." />
          ) : (
            <div className="space-y-2">
              {sponsors.map((s) => (
                <Row key={s.id}>
                  {s.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`${API_BASE}${s.logoUrl}`} alt="" className="h-8 w-auto" />
                  ) : (
                    <span className="text-xs text-muted">logo yo'q</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold">{s.name}</span>
                    {s.websiteUrl && (
                      <span className="ml-2 text-xs text-muted">{s.websiteUrl}</span>
                    )}
                  </div>
                  <Badge tone={s.tier === 1 ? 'warn' : 'neutral'}>
                    {s.tier === 1 ? 'Bosh homiy' : `${s.tier}-daraja`}
                  </Badge>
                  <Button size="sm" onClick={() => openSponsor(s)}>
                    Tahrirlash
                  </Button>
                  <ConfirmButton
                    onConfirm={() => remove(`/federation/sponsors/${s.id}`, s.name)}
                  />
                </Row>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
