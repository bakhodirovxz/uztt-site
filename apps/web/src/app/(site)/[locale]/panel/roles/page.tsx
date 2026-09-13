'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { api, ApiError, type AuthUser } from '@/lib/api';

interface RoleRow {
  id: string;
  code: string;
  name: string;
  isSystem: boolean;
  userCount: number;
  permissions: string[];
}
interface PermissionRow {
  id: string;
  code: string;
  description: string;
}

export default function AdminRolesPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [perms, setPerms] = useState<PermissionRow[]>([]);
  const [selected, setSelected] = useState<RoleRow | null>(null);
  const [newRole, setNewRole] = useState({ code: '', name: '' });
  const [assign, setAssign] = useState({ email: '', roleCode: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<RoleRow[]>('/roles').then((rs) => {
      setRoles(rs);
      setSelected((prev) => rs.find((r) => r.id === prev?.id) ?? null);
    }).catch(() => {});
    api.get<PermissionRow[]>('/roles/permissions').then(setPerms).catch(() => {});
  }, []);

  useEffect(() => {
    api
      .get<{ user: AuthUser }>('/auth/me')
      .then(({ user }) => {
        if (!user.permissions.includes('role.manage')) throw new Error();
        load();
      })
      .catch(() => router.replace('/login'));
  }, [router, load]);

  async function act(fn: () => Promise<unknown>, okMsg: string) {
    setError(null);
    setMsg(null);
    try {
      await fn();
      setMsg(okMsg);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }

  const createRole = () =>
    act(
      () => api.post('/roles', { code: newRole.code, name: newRole.name }),
      `Rol yaratildi: ${newRole.code}`,
    ).then(() => setNewRole({ code: '', name: '' }));

  const togglePermission = (perm: string) => {
    if (!selected || selected.code === 'SUPERADMIN') return;
    const next = selected.permissions.includes(perm)
      ? selected.permissions.filter((p) => p !== perm)
      : [...selected.permissions, perm];
    // Optimistik yangilash
    setSelected({ ...selected, permissions: next });
    void act(
      () => api.put(`/roles/${selected.id}/permissions`, { permissions: next }),
      'Permissionlar saqlandi',
    );
  };

  const assignRole = () =>
    act(() => api.post('/roles/assign', assign), `${assign.email} → ${assign.roleCode}`);

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-extrabold uppercase">Rollar boshqaruvi</h1>
      <p className="mt-1 text-sm text-muted">
        Yangi rol qo'shish uchun kod o'zgarishi kerak emas — rol yarating, permissionlarni belgilang, userga biriktiring.
      </p>
      {msg && <p className="mt-3 rounded-md bg-win/10 px-3 py-2 text-sm font-semibold text-win">{msg}</p>}
      {error && <p className="mt-3 rounded-md bg-accent-100 px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          {/* Yangi rol */}
          <div className="rounded-card bg-surface-card p-5 shadow-card">
            <h2 className="font-heading font-bold">Yangi rol</h2>
            <div className="mt-3 flex gap-2">
              <input
                value={newRole.code}
                onChange={(e) => setNewRole({ ...newRole, code: e.target.value.toUpperCase() })}
                placeholder="KOD (masalan MEDIA_MANAGER)"
                className="flex-1 rounded-md border border-border px-3 py-2 font-mono text-sm"
              />
              <input
                value={newRole.name}
                onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                placeholder="Nomi"
                className="flex-1 rounded-md border border-border px-3 py-2"
              />
            </div>
            <button
              type="button"
              disabled={!newRole.code || !newRole.name}
              onClick={createRole}
              className="mt-3 rounded-md bg-accent-600 px-5 py-2 font-semibold text-white disabled:opacity-50"
            >
              Yaratish
            </button>
          </div>

          {/* Rollar ro'yxati */}
          <div className="mt-4 space-y-2">
            {roles.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelected(r)}
                className={`flex w-full items-center gap-3 rounded-card px-4 py-3 text-left shadow-card ${
                  selected?.id === r.id ? 'bg-navy-900 text-white' : 'bg-surface-card'
                }`}
              >
                <span className="font-mono text-sm font-bold">{r.code}</span>
                <span className={selected?.id === r.id ? 'text-white/70' : 'text-muted'}>
                  {r.name}
                </span>
                <span className="ml-auto text-xs">
                  {r.permissions.length} ta ruxsat · {r.userCount} user
                  {r.isSystem && ' · tizim'}
                </span>
              </button>
            ))}
          </div>

          {/* Userga rol berish */}
          <div className="mt-4 rounded-card bg-surface-card p-5 shadow-card">
            <h2 className="font-heading font-bold">Userga rol biriktirish</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                value={assign.email}
                onChange={(e) => setAssign({ ...assign, email: e.target.value })}
                placeholder="user@email.uz"
                className="flex-1 rounded-md border border-border px-3 py-2"
              />
              <select
                value={assign.roleCode}
                onChange={(e) => setAssign({ ...assign, roleCode: e.target.value })}
                className="rounded-md border border-border px-2 py-2"
              >
                <option value="">Rol...</option>
                {roles.map((r) => (
                  <option key={r.code} value={r.code}>{r.code}</option>
                ))}
              </select>
              <button
                type="button"
                disabled={!assign.email || !assign.roleCode}
                onClick={assignRole}
                className="rounded-md bg-navy-900 px-4 py-2 font-semibold text-white disabled:opacity-50"
              >
                Biriktirish
              </button>
            </div>
          </div>
        </div>

        {/* Permission belgilash */}
        <div className="rounded-card bg-surface-card p-5 shadow-card">
          <h2 className="font-heading font-bold">
            {selected ? `Permissionlar — ${selected.code}` : 'Rolni tanlang'}
          </h2>
          {selected?.code === 'SUPERADMIN' && (
            <p className="mt-1 text-sm text-muted">SUPERADMIN har doim hamma ruxsatga ega</p>
          )}
          {selected && (
            <div className="mt-3 space-y-1.5">
              {perms.map((p) => {
                const on = selected.permissions.includes(p.code);
                return (
                  <label
                    key={p.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 ${
                      on ? 'border-accent-500 bg-accent-100/40' : 'border-border'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={selected.code === 'SUPERADMIN'}
                      onChange={() => togglePermission(p.code)}
                      className="accent-accent-600"
                    />
                    <span className="font-mono text-sm font-semibold">{p.code}</span>
                    <span className="text-xs text-muted">{p.description}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
