'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { api, type AuthUser } from '@/lib/api';

type PanelPath =
  | '/panel'
  | '/panel/news'
  | '/panel/tournaments'
  | '/panel/levels'
  | '/panel/players'
  | '/panel/roles'
  | '/panel/users'
  | '/panel/media'
  | '/panel/federation'
  | '/panel/pages'
  | '/panel/inbox'
  | '/panel/coach'
  | '/panel/stream'
  | '/referee'
  | '/profile';

/**
 * Panel menyusi permissionlardan quriladi — yangi bo'lim qo'shish
 * uchun shu ro'yxatga bitta yozuv yetarli.
 */
const MENU: Array<{ key: string; permission: string | null; href: PanelPath }> = [
  { key: 'menuOverview', permission: null, href: '/panel' },
  { key: 'menuTournaments', permission: 'tournament.manage', href: '/panel/tournaments' },
  { key: 'menuLevels', permission: 'tournament.manage', href: '/panel/levels' },
  { key: 'menuPlayers', permission: 'player.manage', href: '/panel/players' },
  { key: 'menuNews', permission: 'news.manage', href: '/panel/news' },
  { key: 'menuMedia', permission: 'media.manage', href: '/panel/media' },
  { key: 'menuFederation', permission: 'page.manage', href: '/panel/federation' },
  { key: 'menuPages', permission: 'page.manage', href: '/panel/pages' },
  { key: 'menuStream', permission: 'stream.view', href: '/panel/stream' },
  { key: 'menuCoach', permission: 'coach.players.manage', href: '/panel/coach' },
  { key: 'menuInbox', permission: 'contact.inbox', href: '/panel/inbox' },
  { key: 'menuUsers', permission: 'user.manage', href: '/panel/users' },
  { key: 'menuRoles', permission: 'role.manage', href: '/panel/roles' },
  // Paneldan tashqaridagi, lekin kabinetga tegishli sahifalar
  { key: 'menuReferee', permission: 'match.score', href: '/referee' },
  { key: 'menuProfile', permission: null, href: '/profile' },
];

export default function PanelLayout({ children }: { children: ReactNode }) {
  const t = useTranslations('panel');
  const tc = useTranslations('common');
  const tn = useTranslations('nav');
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ user: AuthUser }>('/auth/me')
      .then((res) => setUser(res.user))
      .catch(() => router.replace('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  async function logout() {
    await api.post('/auth/logout').catch(() => undefined);
    router.replace('/');
    router.refresh();
  }

  if (loading) {
    return <div className="mx-auto max-w-site px-4 py-16 text-muted">{tc('loading')}</div>;
  }
  if (!user) return null;

  const visible = MENU.filter(
    (m) => m.permission === null || user.permissions.includes(m.permission),
  );

  // Bo'lim permissioni yo'q bo'lsa — kirish taqiqlangani aytiladi (API ham 403 beradi)
  const currentItem = MENU.find((m) => m.href === pathname);
  if (
    currentItem?.permission &&
    !user.permissions.includes(currentItem.permission)
  ) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-heading text-2xl font-extrabold uppercase">
          Bu bo‘limga ruxsatingiz yo‘q
        </h1>
        <p className="mt-2 text-muted">
          Kerakli huquq: <code className="text-accent-500">{currentItem.permission}</code>.
          Administratordan so‘rang.
        </p>
        <Link
          href="/panel"
          className="mt-6 inline-block rounded-md bg-accent-500 px-5 py-2.5 font-semibold text-white"
        >
          Kabinetga qaytish
        </Link>
      </div>
    );
  }

  const linkClass = (href: string) =>
    `block rounded-md px-3 py-2.5 text-sm font-semibold transition-colors ${
      pathname === href
        ? 'bg-navy-900 text-accent-500'
        : 'text-muted hover:bg-surface-raised hover:text-ink'
    }`;

  return (
    <div className="mx-auto max-w-site gap-8 px-4 py-8 lg:flex">
      {/* Yon menyu — desktopda ustun, mobilda gorizontal lenta */}
      <aside className="lg:w-56 lg:shrink-0">
        <nav
          aria-label={t('title')}
          className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 lg:mx-0 lg:block lg:space-y-0.5 lg:overflow-visible lg:px-0 lg:pb-0"
        >
          {visible.map((m) => (
            <Link
              key={m.key}
              href={m.href}
              className={`${linkClass(m.href)} shrink-0 whitespace-nowrap lg:whitespace-normal`}
            >
              {t(m.key)}
            </Link>
          ))}
        </nav>

        <div className="mt-4 hidden rounded-card border border-border bg-surface-card p-4 lg:block">
          <p className="truncate text-xs text-muted">{user.email}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {user.roles.map((r) => (
              <span
                key={r}
                className="rounded-full bg-surface-raised px-2 py-0.5 text-[11px] font-bold text-muted"
              >
                {r}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={logout}
            className="mt-3 w-full rounded-md border border-border px-3 py-2 text-xs font-semibold hover:border-accent-500 hover:text-accent-400"
          >
            {tn('logout')}
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 pt-4 lg:pt-0">{children}</main>
    </div>
  );
}
