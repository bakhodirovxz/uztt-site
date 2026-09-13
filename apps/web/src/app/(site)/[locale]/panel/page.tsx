'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api, type AuthUser } from '@/lib/api';
import { Card, PageHeader } from '@/components/panel/ui';

interface Snapshot {
  live: number;
  upcoming: number;
  pendingPlayers: number;
  newMessages: number;
}

type ShortcutPath =
  | '/panel/tournaments'
  | '/panel/players'
  | '/panel/news'
  | '/panel/stream'
  | '/referee'
  | '/profile';

/** Har bo'lim uchun: nima qilinadi + qaysi permission kerak */
const SHORTCUTS: Array<{
  href: ShortcutPath;
  permission: string | null;
  title: string;
  text: string;
}> = [
  {
    href: '/panel/tournaments',
    permission: 'tournament.manage',
    title: 'Musobaqa o‘tkazish',
    text: 'Turnir ochish, guruhlar, arizalar, qura va o‘yinlar jadvali',
  },
  {
    href: '/panel/players',
    permission: 'player.verify',
    title: 'O‘yinchilarni tasdiqlash',
    text: 'Yangi arizalarni ko‘rish, litsenziya berish, reyting ballini tuzatish',
  },
  {
    href: '/panel/news',
    permission: 'news.manage',
    title: 'Yangilik chiqarish',
    text: 'Uch tilda yangilik yozish va nashr qilish',
  },
  {
    href: '/panel/stream',
    permission: 'stream.view',
    title: 'Jonli efir',
    text: 'OBS overlay va zal monitori havolalari',
  },
  {
    href: '/referee',
    permission: 'match.score',
    title: 'Hakam paneli',
    text: 'Stolni tanlab jonli hisob kiritish',
  },
  {
    href: '/profile',
    permission: null,
    title: 'Profilim',
    text: 'Shaxsiy ma’lumotlar, hujjatlar va turnir arizalarim',
  },
];

export default function PanelHomePage() {
  const t = useTranslations('panel');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [snap, setSnap] = useState<Snapshot>({
    live: 0,
    upcoming: 0,
    pendingPlayers: 0,
    newMessages: 0,
  });

  useEffect(() => {
    api
      .get<{ user: AuthUser }>('/auth/me')
      .then(({ user }) => {
        setUser(user);
        return user;
      })
      .then(async (u) => {
        const [live, tournaments] = await Promise.all([
          api.get<unknown[]>('/matches/live').catch(() => []),
          api.get<Array<{ status: string }>>('/tournaments').catch(() => []),
        ]);
        const pending = u.permissions.includes('player.verify')
          ? await api.get<unknown[]>('/registration/pending').catch(() => [])
          : [];
        const messages = u.permissions.includes('contact.inbox')
          ? await api
              .get<Array<{ status: string }>>('/contact/inbox')
              .catch(() => [])
          : [];
        setSnap({
          live: live.length,
          upcoming: tournaments.filter((x) => x.status === 'UPCOMING').length,
          pendingPlayers: pending.length,
          newMessages: messages.filter((m) => m.status === 'NEW').length,
        });
      })
      .catch(() => undefined);
  }, []);

  if (!user) return null;

  const stats = [
    { label: 'Jonli o‘yin', value: snap.live, tone: snap.live > 0 },
    { label: 'Kelayotgan musobaqa', value: snap.upcoming, tone: false },
    ...(user.permissions.includes('player.verify')
      ? [{ label: 'Tasdiq kutmoqda', value: snap.pendingPlayers, tone: snap.pendingPlayers > 0 }]
      : []),
    ...(user.permissions.includes('contact.inbox')
      ? [{ label: 'Yangi murojaat', value: snap.newMessages, tone: snap.newMessages > 0 }]
      : []),
  ];

  const shortcuts = SHORTCUTS.filter(
    (s) => s.permission === null || user.permissions.includes(s.permission),
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('title')}
        description={`${t('welcome')}, ${user.email}`}
      />

      {/* Hozir nima bo'layotgani — bir qarashda */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-card border border-border bg-surface-card px-4 py-3.5"
          >
            <div
              className={`font-heading text-3xl font-extrabold tabular-nums ${
                s.tone ? 'text-accent-400' : 'text-ink'
              }`}
            >
              {s.value}
            </div>
            <div className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-muted">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <div>
        <span className="eyebrow">Tez o‘tish</span>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shortcuts.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group rounded-card border border-border bg-surface-card p-5 transition-colors hover:border-court-500"
            >
              <h2 className="font-heading font-bold group-hover:text-accent-500">
                {s.title}
              </h2>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </Link>
          ))}
        </div>
      </div>

      <Card title="Rollaringiz" description="Ko‘rinadigan bo‘limlar shu rollarga bog‘liq">
        <div className="flex flex-wrap gap-2">
          {user.roles.map((r) => (
            <span
              key={r}
              className="rounded-full bg-surface-raised px-3 py-1 text-xs font-bold text-muted"
            >
              {r}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}
