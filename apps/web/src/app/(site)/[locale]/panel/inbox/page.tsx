'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { api, type AuthUser } from '@/lib/api';

interface Message {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  body: string;
  locale: string;
  status: 'NEW' | 'READ' | 'ARCHIVED';
  createdAt: string;
}

export default function AdminInboxPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState<string>('');

  const load = useCallback(() => {
    api
      .get<Message[]>(`/contact/inbox${filter ? `?status=${filter}` : ''}`)
      .then(setMessages)
      .catch(() => {});
  }, [filter]);

  useEffect(() => {
    api
      .get<{ user: AuthUser }>('/auth/me')
      .then(({ user }) => {
        if (!user.permissions.includes('contact.inbox')) throw new Error();
        load();
      })
      .catch(() => router.replace('/login'));
  }, [router, load]);

  async function setStatus(id: string, status: string) {
    await api.post(`/contact/${id}/status`, { status }).catch(() => {});
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-extrabold uppercase">Murojaatlar</h1>

      <div className="mt-4 flex gap-2">
        {[
          ['', 'Barchasi'],
          ['NEW', 'Yangi'],
          ['READ', "O'qilgan"],
          ['ARCHIVED', 'Arxiv'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              filter === key ? 'bg-navy-900 text-white' : 'bg-surface-card shadow-card'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {messages.length === 0 && <p className="text-muted">Murojaatlar yo'q</p>}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-card bg-surface-card p-4 shadow-card ${
              m.status === 'NEW' ? 'border-l-4 border-accent-500' : ''
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{m.name}</span>
              <a href={`mailto:${m.email}`} className="text-sm text-accent-400">
                {m.email}
              </a>
              <span className="text-xs uppercase text-muted">{m.locale}</span>
              <span className="ml-auto text-xs text-muted">
                {new Date(m.createdAt).toLocaleString('uz-UZ')}
              </span>
            </div>
            {m.subject && <p className="mt-1 font-semibold">{m.subject}</p>}
            <p className="mt-1 whitespace-pre-line text-sm">{m.body}</p>
            <div className="mt-3 flex gap-3 text-sm font-semibold">
              {m.status !== 'READ' && (
                <button type="button" onClick={() => setStatus(m.id, 'READ')} className="text-navy-700">
                  O'qildi
                </button>
              )}
              {m.status !== 'ARCHIVED' && (
                <button type="button" onClick={() => setStatus(m.id, 'ARCHIVED')} className="text-muted">
                  Arxivlash
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
