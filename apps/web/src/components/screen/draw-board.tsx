'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Avatar } from '@/components/ui/avatar';

interface P { id?: string; firstName: string; lastName: string; photoUrl?: string | null; region?: string }
interface GroupsData {
  groupCount: number;
  advancing: number;
  groups: Array<{
    number: number;
    standings: Array<{ playerId: string; place: number; points: number; played: number; won: number; lost: number; setsWon: number; setsLost: number; player?: P }>;
  }>;
}
interface BM {
  id: string; status: string; winnerId: string | null; player1SetsWon: number; player2SetsWon: number;
  player1: P | null; player2: P | null; sets: unknown[]; referee?: string | null; assistant?: string | null;
}
type Lvl = 'base' | 'semi' | 'final';
interface Bracket {
  rounds: Array<{ roundNumber: number; stage: string; matches: BM[] }>;
  thirdPlace?: BM | null;
}

const STAGE: Record<string, string> = {
  ROUND_1: '1-raund', ROUND_OF_32: '1/16', ROUND_OF_16: '1/8', QUARTERFINAL: 'Chorak final',
  SEMIFINAL: 'Yarim final', THIRD_PLACE: '3-o‘rin', FINAL: 'Final', GROUP: 'Guruh',
};

/**
 * TV va OBS uchun: guruh jadvallari + setka, o'yinchi rasmlari bilan.
 * Yuklama: rasmlar kichik (≈4 KB) statik fayl, lazy; ma'lumot har 10 soniyada so'raladi (server tomonda 5 s kesh).
 */
export function DrawBoard({ categoryId, transparent = false, view = 'all' }: { categoryId: string; transparent?: boolean; view?: 'all' | 'groups' | 'bracket' }) {
  const [groups, setGroups] = useState<GroupsData | null>(null);
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [g, b] = await Promise.all([
        api.get<GroupsData>(`/groups/category/${categoryId}`).catch(() => null),
        api.get<Bracket>(`/draws/category/${categoryId}`).catch(() => null),
      ]);
      if (!alive) return;
      setGroups(g && g.groups?.length ? g : null);
      setBracket(b && b.rounds?.length ? b : null);
      setLoaded(true);
    };
    load();
    const id = setInterval(load, 10_000);
    return () => { alive = false; clearInterval(id); };
  }, [categoryId]);

  const card = transparent ? 'bg-black/70' : 'bg-broadcast-bg2';
  if (!loaded) return null;
  if ((view === 'groups' ? !groups : view === 'bracket' ? !bracket : !groups && !bracket)) return <p className="p-10 text-center text-xl text-white/50">Ma&apos;lumot yo&apos;q</p>;

  return (
    <div className="p-6 text-white">
      {groups && view !== 'bracket' && (
        <section className="mb-8">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(4, groups.groups.length)}, minmax(0, 1fr))` }}>
            {groups.groups.map((g) => (
              <div key={g.number} className={`overflow-hidden rounded-lg ${card} shadow-2xl`}>
                <div className="bg-broadcast-gold px-3 py-1.5 font-heading text-sm font-extrabold uppercase tracking-widest text-black">
                  {g.number}-guruh
                </div>
                <table className="w-full text-base tabular-nums">
                  <tbody>
                    {g.standings.map((s) => (
                      <tr key={s.playerId} className={`border-b border-white/10 last:border-0 ${s.place <= groups.advancing ? 'bg-white/10 font-semibold' : ''}`}>
                        <td className="w-7 py-1.5 pl-3 text-white/60">{s.place}</td>
                        <td className="py-1.5 pr-2">
                          <span className="flex items-center gap-2">
                            <Avatar photoUrl={s.player?.photoUrl} firstName={s.player?.firstName} lastName={s.player?.lastName} size={36} />
                            <span className="min-w-0">
                              <span className="block truncate">{s.player ? `${s.player.firstName[0]}. ${s.player.lastName}` : '—'}</span>
                              {s.player?.region ? <span className="block truncate text-xs text-white/50">{s.player.region}</span> : null}
                            </span>
                          </span>
                        </td>
                        <td className="px-2 text-center text-white/70">{s.won}-{s.lost}</td>
                        <td className="pr-3 text-right font-heading text-xl font-extrabold text-broadcast-gold">{s.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </section>
      )}

      {bracket && view !== 'groups' && (
        <section className="overflow-hidden">
          <div className="flex items-stretch gap-5">
            {bracket.rounds.map((round, idx) => {
              const fromEnd = bracket.rounds.length - 1 - idx;
              const lvl: Lvl = fromEnd === 0 ? 'final' : fromEnd === 1 ? 'semi' : 'base';
              return (
                <div key={round.roundNumber} className="flex min-w-0 flex-col" style={{ flex: lvl === 'final' ? 2.4 : lvl === 'semi' ? 1.6 : 1 }}>
                  <h4 className={`mb-2 text-center font-heading font-bold uppercase tracking-widest text-broadcast-gold ${lvl === 'final' ? 'text-2xl' : lvl === 'semi' ? 'text-base' : 'text-xs'}`}>
                    {STAGE[round.stage] ?? round.stage}
                  </h4>
                  <div className="flex flex-1 flex-col justify-around gap-3">
                    {round.matches.map((m) => <Box key={m.id} m={m} card={card} lvl={lvl} />)}
                    {lvl === 'final' && bracket.thirdPlace && (
                      <div>
                        <h4 className="mb-2 mt-4 text-center font-heading text-sm font-bold uppercase tracking-widest text-broadcast-gold">{STAGE.THIRD_PLACE}</h4>
                        <Box m={bracket.thirdPlace} card={card} lvl="semi" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

const LV = {
  base: { av: 26, text: 'text-sm', pad: 'px-2 py-1.5', score: 'size-6 text-xs', ref: 'text-[11px]' },
  semi: { av: 38, text: 'text-lg', pad: 'px-3 py-2.5', score: 'size-8 text-base', ref: 'text-xs' },
  final: { av: 64, text: 'text-3xl', pad: 'px-4 py-4', score: 'size-12 text-2xl', ref: 'text-base' },
} as const;

function Box({ m, card, lvl }: { m: BM; card: string; lvl: Lvl }) {
  const c = LV[lvl];
  return (
    <div className={`overflow-hidden rounded-md ${card} shadow-xl ${lvl === 'final' ? 'ring-2 ring-broadcast-gold' : ''}`}>
      {([[m.player1, m.player1SetsWon], [m.player2, m.player2SetsWon]] as const).map(([p, sets], i) => {
        const win = m.status === 'FINISHED' && p && m.winnerId === p.id;
        return (
          <div key={i} className={`flex items-center justify-between gap-2 ${c.pad} ${c.text} ${i === 0 ? 'border-b border-white/10' : ''} ${win ? 'font-bold text-broadcast-gold' : ''}`}>
            <span className="flex min-w-0 items-center gap-3">
              {p ? <Avatar photoUrl={p.photoUrl} firstName={p.firstName} lastName={p.lastName} size={c.av} /> : <span className="shrink-0 rounded-full bg-white/10" style={{ width: c.av, height: c.av }} />}
              <span className={`truncate ${p ? '' : 'italic text-white/40'}`}>{p ? (lvl === 'final' ? `${p.firstName} ${p.lastName}` : `${p.firstName[0]}. ${p.lastName}`) : '—'}</span>
            </span>
            <span className={`grid shrink-0 place-items-center rounded bg-white/15 font-extrabold tabular-nums ${c.score}`}>
              {m.sets.length > 0 || m.status !== 'SCHEDULED' ? sets : '–'}
            </span>
          </div>
        );
      })}
      {(m.referee || m.assistant) && (
        <div className={`border-t border-white/10 bg-black/20 px-3 py-1 text-white/70 ${c.ref}`}>
          Hakam: <b className="text-white">{m.referee ?? '—'}</b>{m.assistant ? <> · Yordamchi: <b className="text-white">{m.assistant}</b></> : null}
        </div>
      )}
    </div>
  );
}
