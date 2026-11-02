'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Alert, Badge, Button, EmptyState, PageHeader, Row, inputClass } from '@/components/panel/ui';

type Tab = 'referee' | 'coach' | 'club';
interface UserLite { id: string; firstName: string; lastName: string; email: string }
interface Item {
  key: string;            // review uchun id (userId yoki clubId)
  title: string;
  lines: string[];
  status: string;
  rejectReason?: string | null;
}

const CAT: Record<string, string> = { INTERNATIONAL: 'Xalqaro', NATIONAL: 'Milliy', FIRST: '1-toifa', SECOND: '2-toifa', THIRD: '3-toifa' };

/** Hakam / murabbiy / klub arizalarini ko'rib chiqish (applicant.review). Tasdiqlash — rol beradi. */
export default function ApplicationsPage() {
  const [tab, setTab] = useState<Tab>('referee');
  const [status, setStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [items, setItems] = useState<Item[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ kind: 'success' | 'danger'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      if (tab === 'club') {
        const rows = await api.get<Array<{ id: string; name: string; regionName: string | null; address: string | null; coachName: string | null; status: string; rejectReason: string | null }>>('/clubs/pending');
        setItems(rows.map((c) => ({ key: c.id, title: c.name, lines: [c.regionName, c.address, c.coachName].filter(Boolean) as string[], status: c.status, rejectReason: c.rejectReason })));
      } else if (tab === 'referee') {
        const rows = await api.get<Array<{ userId: string; status: string; category: string | null; certification: string | null; region: string | null; phone: string | null; since: number | null; bio: string | null; rejectReason: string | null; user: UserLite }>>(`/applications?type=referee&status=${status}`);
        setItems(rows.map((r) => ({
          key: r.userId, title: `${r.user.lastName} ${r.user.firstName}`, status: r.status, rejectReason: r.rejectReason,
          lines: [r.user.email, r.phone, r.region, r.category ? CAT[r.category] : null, r.certification, r.since ? `${r.since}-yildan` : null, r.bio].filter(Boolean) as string[],
        })));
      } else {
        const rows = await api.get<Array<{ userId: string; status: string; phone: string | null; region: string | null; licenseNumber: string | null; bio: string | null; clubRecord: { name: string } | null; rejectReason: string | null; user: UserLite | null }>>(`/applications?type=coach&status=${status}`);
        setItems(rows.map((r) => ({
          key: r.userId, title: r.user ? `${r.user.lastName} ${r.user.firstName}` : r.userId, status: r.status, rejectReason: r.rejectReason,
          lines: [r.user?.email, r.phone, r.region, r.clubRecord?.name, r.licenseNumber, r.bio].filter(Boolean) as string[],
        })));
      }
    } catch (e) {
      setMsg({ kind: 'danger', text: e instanceof ApiError ? e.message : 'Yuklab bo‘lmadi' });
    }
  }, [tab, status]);

  useEffect(() => { load(); }, [load]);

  async function review(key: string, decision: 'APPROVE' | 'REJECT') {
    setMsg(null);
    if (decision === 'REJECT' && !(reasons[key] ?? '').trim()) {
      setMsg({ kind: 'danger', text: 'Rad etish sababini yozing' });
      return;
    }
    try {
      const url = tab === 'club' ? `/clubs/${key}/review` : `/applications/${tab}/${key}/review`;
      await api.post(url, { decision, reason: reasons[key]?.trim() || undefined });
      setMsg({ kind: 'success', text: decision === 'APPROVE' ? 'Tasdiqlandi' : 'Rad etildi' });
      await load();
    } catch (e) {
      setMsg({ kind: 'danger', text: e instanceof ApiError ? e.message : 'Xatolik' });
    }
  }

  const tabs: Array<[Tab, string]> = [['referee', 'Hakamlar'], ['coach', 'Murabbiylar'], ['club', 'Klublar']];
  return (
    <div className="space-y-5">
      <PageHeader title="Arizalar" description="Tasdiqlangunga qadar foydalanuvchi hech qanday huquqqa ega emas. Tasdiqlash hakam/murabbiy rolini beradi." />
      <div className="flex flex-wrap gap-2">
        {tabs.map(([k, label]) => (
          <Button key={k} variant={tab === k ? 'primary' : 'secondary'} onClick={() => setTab(k)}>{label}</Button>
        ))}
        {tab !== 'club' && (
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={`${inputClass} !w-auto`} aria-label="Holat">
            <option value="PENDING">Kutilmoqda</option><option value="APPROVED">Tasdiqlangan</option><option value="REJECTED">Rad etilgan</option>
          </select>
        )}
      </div>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
      {items.length === 0 ? <EmptyState title="Arizalar yo‘q" /> : (
        <div className="space-y-2">
          {items.map((it) => (
            <Row key={it.key} className="items-start">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{it.title} <Badge>{it.status}</Badge></p>
                {it.lines.map((l, i) => <p key={i} className="truncate text-sm text-muted">{l}</p>)}
                {it.rejectReason && <p className="text-sm text-danger">Sabab: {it.rejectReason}</p>}
              </div>
              {it.status === 'PENDING' && (
                <div className="flex flex-wrap items-center gap-2">
                  <input placeholder="Rad etish sababi" maxLength={300} value={reasons[it.key] ?? ''} onChange={(e) => setReasons((r) => ({ ...r, [it.key]: e.target.value }))} className={`${inputClass} !w-52`} />
                  <Button variant="primary" onClick={() => review(it.key, 'APPROVE')}>Tasdiqlash</Button>
                  <Button variant="danger" onClick={() => review(it.key, 'REJECT')}>Rad etish</Button>
                </div>
              )}
            </Row>
          ))}
        </div>
      )}
    </div>
  );
}
