'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type AuthUser } from '@/lib/api';
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmButton,
  EmptyState,
  Field,
  PageHeader,
  inputClass,
} from '@/components/panel/ui';

interface UserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: 'ACTIVE' | 'BLOCKED' | 'PENDING';
  createdAt: string;
  roles: string[];
  roleNames: string[];
}

interface RoleRow {
  id: string;
  code: string;
  name: string;
}

/**
 * Root paneli: foydalanuvchi ochish, rol biriktirish, bloklash, parol tiklash.
 * Rollar har qatorda emas — faqat "Rollar" ochilganda ko'rsatiladi (shovqin kam).
 */
/** Tasodifiy kuchli parol (kriptografik): 18 belgi, harf/raqam/maxsus — boshqaruvchi siyosatiga mos */
function generatePassword(): string {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '!@#$%*-_+='];
  const all = sets.join('');
  const rnd = (n: number) => {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] % n;
  };
  const chars = sets.map((s) => s[rnd(s.length)]);
  while (chars.length < 18) chars.push(all[rnd(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [query, setQuery] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canManageRoles, setCanManageRoles] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    roleCodes: [] as string[],
  });
  const [openRow, setOpenRow] = useState<{
    id: string;
    mode: 'roles' | 'password';
  } | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const load = useCallback((q = '') => {
    api
      .get<UserRow[]>(`/users${q ? `?query=${encodeURIComponent(q)}` : ''}`)
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    api
      .get<{ user: AuthUser }>('/auth/me')
      .then(({ user }) => {
        setCanManageRoles(user.permissions.includes('role.manage'));
        load();
        api.get<RoleRow[]>('/roles').then(setRoles).catch(() => {});
      })
      .catch(() => undefined);
  }, [load]);

  function fail(e: unknown) {
    setError(e instanceof ApiError ? e.message : String(e));
  }

  async function createUser() {
    setError(null);
    setMsg(null);
    try {
      await api.post('/users', {
        ...form,
        roleCodes: form.roleCodes.length ? form.roleCodes : undefined,
      });
      setMsg(`${form.email} yaratildi`);
      setForm({ email: '', password: '', firstName: '', lastName: '', roleCodes: [] });
      setFormOpen(false);
      load(query);
    } catch (e) {
      fail(e);
    }
  }

  async function setStatus(u: UserRow, status: UserRow['status']) {
    setError(null);
    try {
      await api.patch(`/users/${u.id}`, { status });
      setMsg(
        status === 'BLOCKED'
          ? `${u.email} bloklandi — endi tizimga kira olmaydi`
          : `${u.email} faollashtirildi`,
      );
      load(query);
    } catch (e) {
      fail(e);
    }
  }

  async function toggleRole(u: UserRow, code: string) {
    setError(null);
    const has = u.roles.includes(code);
    try {
      await api.post(has ? '/roles/unassign' : '/roles/assign', {
        email: u.email,
        roleCode: code,
      });
      load(query);
    } catch (e) {
      fail(e);
    }
  }

  async function resetPassword(u: UserRow) {
    setError(null);
    setMsg(null);
    try {
      await api.post(`/users/${u.id}/password`, { password: newPassword });
      setMsg(`${u.email} paroli yangilandi — barcha sessiyalari bekor qilindi`);
      setOpenRow(null);
      setNewPassword('');
    } catch (e) {
      fail(e);
    }
  }

  async function removeUser(u: UserRow) {
    setError(null);
    try {
      await api.del(`/users/${u.id}`);
      setMsg(`${u.email} o‘chirildi`);
      load(query);
    } catch (e) {
      fail(e);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Foydalanuvchilar"
        description="Hisob ochish, rol biriktirish, bloklash va parolni tiklash."
        action={
          <Button
            variant={formOpen ? 'ghost' : 'primary'}
            onClick={() => setFormOpen((v) => !v)}
          >
            {formOpen ? 'Yopish' : '+ Yangi foydalanuvchi'}
          </Button>
        }
      />

      {msg && <Alert kind="success">{msg}</Alert>}
      {error && <Alert kind="danger">{error}</Alert>}

      {formOpen && (
        <Card title="Yangi foydalanuvchi">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" required>
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="ism@uztt.uz"
                className={inputClass}
              />
            </Field>
            <Field label="Parol" hint="O'yinchi: ≥10 belgi. Boshqaruvchi (admin, hakam...): ≥14 belgi + maxsus belgi. Hisob birinchi kirishda parolni almashtiradi." required>
              <input
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Ism" required>
              <input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Familiya" required>
              <input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="mt-4">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
              Rollar
            </span>
            <div className="flex flex-wrap gap-2">
              {roles.map((r) => {
                const active = form.roleCodes.includes(r.code);
                return (
                  <button
                    key={r.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setForm({
                        ...form,
                        roleCodes: active
                          ? form.roleCodes.filter((c) => c !== r.code)
                          : [...form.roleCodes, r.code],
                      })
                    }
                    className={`min-h-9 rounded-full border px-3.5 text-xs font-semibold transition-colors ${
                      active
                        ? 'border-court-500 bg-court-100 text-accent-500'
                        : 'border-border text-muted hover:border-court-500'
                    }`}
                  >
                    {r.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 border-t border-border pt-4">
            <Button
              variant="primary"
              disabled={
                !form.email ||
                form.password.length < 10 ||
                !form.firstName ||
                !form.lastName
              }
              onClick={createUser}
            >
              Yaratish
            </Button>
          </div>
        </Card>
      )}

      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load(query)}
          placeholder="Email yoki ism bo‘yicha qidirish"
          aria-label="Foydalanuvchilarni qidirish"
          className={`${inputClass} sm:max-w-sm`}
        />
        <Button onClick={() => load(query)}>Qidirish</Button>
      </div>

      {users.length === 0 ? (
        <EmptyState title="Foydalanuvchi topilmadi" hint="Qidiruvni o‘zgartiring." />
      ) : (
        <div className="space-y-2">
          {users.map((u) => {
            const rowOpen = openRow?.id === u.id ? openRow.mode : null;
            return (
              <div
                key={u.id}
                className="rounded-md border border-border bg-surface-card px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold">
                      {u.lastName} {u.firstName}
                    </span>
                    <span className="ml-2 text-sm text-muted">{u.email}</span>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {u.roleNames.length === 0 ? (
                        <span className="text-xs text-muted">Rolsiz</span>
                      ) : (
                        u.roleNames.map((r) => (
                          <span
                            key={r}
                            className="rounded-full bg-surface-raised px-2 py-0.5 text-[11px] font-bold text-muted"
                          >
                            {r}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  <Badge tone={u.status === 'ACTIVE' ? 'success' : 'live'}>
                    {u.status === 'ACTIVE' ? 'Faol' : 'Bloklangan'}
                  </Badge>

                  {canManageRoles && (
                    <Button
                      size="sm"
                      onClick={() =>
                        setOpenRow(
                          rowOpen === 'roles' ? null : { id: u.id, mode: 'roles' },
                        )
                      }
                    >
                      Rollar
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => {
                      setOpenRow(
                        rowOpen === 'password' ? null : { id: u.id, mode: 'password' },
                      );
                      setNewPassword('');
                    }}
                  >
                    Parol
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      setStatus(u, u.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE')
                    }
                  >
                    {u.status === 'ACTIVE' ? 'Bloklash' : 'Faollashtirish'}
                  </Button>
                  <ConfirmButton onConfirm={() => removeUser(u)} />
                </div>

                {rowOpen === 'roles' && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                    {roles.map((r) => {
                      const has = u.roles.includes(r.code);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          aria-pressed={has}
                          onClick={() => toggleRole(u, r.code)}
                          className={`min-h-9 rounded-full border px-3.5 text-xs font-semibold transition-colors ${
                            has
                              ? 'border-court-500 bg-court-100 text-accent-500'
                              : 'border-border text-muted hover:border-court-500'
                          }`}
                        >
                          {r.name}
                        </button>
                      );
                    })}
                  </div>
                )}

                {rowOpen === 'password' && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                    <input
                      autoFocus
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Vaqtinchalik parol (boshqaruvchi: ≥14 belgi + maxsus belgi)"
                      aria-label="Yangi parol"
                      className={`${inputClass} sm:max-w-xs`}
                    />
                    <Button
                      variant="secondary"
                      onClick={() => setNewPassword(generatePassword())}
                    >
                      Kuchli parol yaratish
                    </Button>
                    <Button
                      variant="primary"
                      disabled={newPassword.length < 10}
                      onClick={() => resetPassword(u)}
                    >
                      Saqlash
                    </Button>
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
