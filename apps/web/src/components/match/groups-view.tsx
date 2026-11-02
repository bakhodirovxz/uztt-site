import { getTranslations } from 'next-intl/server';
import { Avatar } from '@/components/ui/avatar';

export interface GroupsData {
  status: 'ACTIVE' | 'ADVANCED';
  groupCount: number;
  advancing: number;
  bracketPlan?: { size: number; firstRound: Array<{ n: number; a: string | null; b: string | null }> };
  groups: Array<{
    number: number;
    standings: Array<{
      playerId: string;
      place: number;
      points: number;
      played: number;
      won: number;
      lost: number;
      setsWon: number;
      setsLost: number;
      lot: boolean;
      player?: { firstName: string; lastName: string; region: string; photoUrl: string | null };
    }>;
    matches: Array<{
      id: string;
      round: number | null;
      status: string;
      player1Id: string | null;
      player2Id: string | null;
      winnerId: string | null;
      setsP1: number;
      setsP2: number;
      games: number[][];
    }>;
  }>;
}

/** Guruh bosqichi: har guruh uchun jadval (g'alaba 2 / mag'lubiyat 1 ochko) va o'yinlar natijasi. */
export async function GroupsView({
  data,
  category,
}: {
  data: GroupsData;
  category: { code: string; gender: 'MALE' | 'FEMALE' | null };
}) {
  const t = await getTranslations('groups');
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded bg-navy-800 px-2 py-0.5 text-xs font-bold text-white">{category.code}</span>
        <span className="text-sm font-semibold text-muted">
          {category.gender === 'MALE' ? '♂' : category.gender === 'FEMALE' ? '♀' : ''} ·{' '}
          {t('summary', { groups: data.groupCount, advancing: data.advancing })}
        </span>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {data.groups.map((g) => {
          const name = new Map(
            g.standings.map((s) => [s.playerId, s.player ? `${s.player.firstName[0]}. ${s.player.lastName}` : '—']),
          );
          return (
            <div key={g.number} className="overflow-hidden rounded-card bg-surface-card shadow-card">
              <div className="bg-navy-800 px-4 py-2 font-heading text-sm font-extrabold uppercase tracking-wider text-white">
                {t('group', { n: g.number })} ({g.number <= 26 ? String.fromCharCode(64 + g.number) : `G${g.number}`})
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase text-muted">
                    <th className="w-8 px-3 py-2 text-left">#</th>
                    <th className="px-2 py-2 text-left">{t('player')}</th>
                    <th className="px-2 py-2 text-center">{t('played')}</th>
                    <th className="px-2 py-2 text-center">{t('sets')}</th>
                    <th className="px-3 py-2 text-center">{t('points')}</th>
                  </tr>
                </thead>
                <tbody>
                  {g.standings.map((s) => {
                    const advances = s.place <= data.advancing;
                    return (
                      <tr key={s.playerId} className={`border-b border-border/60 last:border-0 ${advances ? 'bg-accent-50 font-semibold' : ''}`}>
                        <td className="px-3 py-2">{s.place}</td>
                        <td className="px-2 py-2">
                          <span className="flex min-w-0 items-center gap-2">
                            {s.player ? <Avatar photoUrl={s.player.photoUrl} firstName={s.player.firstName} lastName={s.player.lastName} size={28} /> : null}
                            <span className="truncate">{s.player ? `${s.player.firstName} ${s.player.lastName}` : '—'}</span>
                          </span>
                          <span className="ml-2 text-xs font-normal text-muted">{s.player?.region}</span>
                        </td>
                        <td className="px-2 py-2 text-center tabular-nums">{s.won}–{s.lost}</td>
                        <td className="px-2 py-2 text-center tabular-nums">{s.setsWon}:{s.setsLost}</td>
                        <td className="px-3 py-2 text-center font-extrabold tabular-nums">{s.points}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="border-t border-border bg-surface px-4 py-3 text-xs text-muted">
                {g.matches.map((m) => (
                  <div key={m.id} className="flex justify-between gap-2 py-0.5">
                    <span className="truncate">
                      {name.get(m.player1Id ?? '') ?? '—'} – {name.get(m.player2Id ?? '') ?? '—'}
                    </span>
                    <span className="shrink-0 font-bold tabular-nums text-foreground">
                      {m.status === 'FINISHED' ? `${m.setsP1}:${m.setsP2}` : '–'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {data.bracketPlan && data.status !== 'ADVANCED' && (
        <div className="mt-5 rounded-card border border-border bg-surface-card p-4">
          <h3 className="text-sm font-bold">{t('bracketPlan')}</h3>
          <p className="mt-1 text-xs text-muted">{t('bracketPlanHint')}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {data.bracketPlan.firstRound.map((r) => (
              <div key={r.n} className="flex items-center justify-between rounded-md bg-surface px-3 py-2 text-sm font-bold">
                <span>{r.a ?? 'BYE'}</span>
                <span className="text-xs font-semibold text-muted">vs</span>
                <span>{r.b ?? 'BYE'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
