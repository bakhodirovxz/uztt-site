'use client';

import { useCallback, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { Movement, RankNumber } from '@/components/ui';
import { PlayerCell, Td, Tr } from '@/components/ui';

/**
 * Reyting jadvalining bitta qatori + yoyiladigan tafsilot.
 *
 * WTT'da har qatorning oxirida "+" tugmasi bor: bosilganda ballar qayerdan
 * kelgani (musobaqa, o'rin, ball, muddat) ochiladi.
 *
 * Bizda o'sha ustundagi ma'lumot HOZIRCHA yo'q: import qilingan 5 520
 * o'yinchining ballari uttf.uz eksportidan kelgan, musobaqa natijalaridan
 * emas, shuning uchun `PlayerPointsLog` bo'sh. Musobaqa natijalari import
 * qilingach (Phase B) shu joy o'z-o'zidan to'ladi.
 *
 * Shu sababli hozir HAQIQATAN bor narsani ko'rsatamiz — kesimlar bo'yicha
 * o'rin tarixi va o'yinlar. Ma'lumot yo'q bo'lsa, halol bo'sh holat.
 */

interface RankRow {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  region: string;
  club: string | null;
  rankingPoints: number;
  movement: number | null;
  rank: number;
  photoUrl: string | null;
}

interface HistoryPoint {
  delta: number;
  reason: string | null;
  createdAt: string;
}

interface HistoryRank {
  label: string;
  takenAt: string;
  rank: number;
  points: number;
}

interface History {
  points: HistoryPoint[];
  ranks: HistoryRank[];
  stats: { played: number; wins: number; losses: number };
}

export function RankingRow({
  row,
  labels,
  locale,
}: {
  row: RankRow;
  labels: {
    new: string;
    snapshot: string;
    date: string;
    rank: string;
    points: string;
    played: string;
    wins: string;
    losses: string;
    empty: string;
    loading: string;
    open: string;
  };
  locale: string;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<History | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = useCallback(() => {
    setOpen((v) => !v);
    // Faqat birinchi ochilishda tortamiz — 100 qatorli jadvalda
    // hammasini oldindan yuklash mantiqsiz bo'lardi.
    if (!data && !loading) {
      setLoading(true);
      api
        .get<History>(`/players/${row.slug}/history`)
        .then(setData)
        .catch(() => setData({ points: [], ranks: [], stats: { played: 0, wins: 0, losses: 0 } }))
        .finally(() => setLoading(false));
    }
  }, [data, loading, row.slug]);

  const hasDetail = (data?.ranks.length ?? 0) > 0 || (data?.points.length ?? 0) > 0;

  return (
    <>
      <Tr highlight={open}>
        <Td className="w-24 whitespace-nowrap">
          <span className="flex items-center gap-2">
            <RankNumber rank={row.rank} />
            <Movement
              movement={row.movement}
              isNew={row.movement === null}
              newLabel={labels.new}
            />
          </span>
        </Td>
        <Td>
          <Link
            href={{ pathname: '/players/[slug]', params: { slug: row.slug } }}
            className="block hover:text-accent-500"
          >
            <PlayerCell
              photoUrl={row.photoUrl}
              firstName={row.firstName}
              lastName={row.lastName}
              sub={row.club ?? undefined}
            />
          </Link>
        </Td>
        <Td className="hidden text-[13px] text-muted sm:table-cell">{row.region}</Td>
        <Td align="right" className="font-heading font-bold tabular-nums">
          {row.rankingPoints}
        </Td>
        <Td align="right" className="w-12">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-label={labels.open}
            className="grid size-7 place-items-center rounded-card text-lg font-bold leading-none text-accent-500 transition-colors hover:bg-accent-100"
          >
            {open ? '−' : '+'}
          </button>
        </Td>
      </Tr>

      {open && (
        <tr className="border-b border-border bg-accent-100/40">
          <td colSpan={5} className="px-3 py-3">
            {loading ? (
              <p className="text-xs text-muted">{labels.loading}</p>
            ) : hasDetail ? (
              <div className="space-y-3">
                {data!.ranks.length > 0 && (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-muted">
                        <th className="py-1 font-bold">{labels.snapshot}</th>
                        <th className="py-1 font-bold">{labels.date}</th>
                        <th className="py-1 text-right font-bold">{labels.rank}</th>
                        <th className="py-1 text-right font-bold">{labels.points}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data!.ranks.map((r) => (
                        <tr key={r.label} className="border-t border-border/60">
                          <td className="py-1.5 font-medium">{r.label}</td>
                          <td className="py-1.5 text-muted">
                            {new Date(r.takenAt).toLocaleDateString(locale)}
                          </td>
                          <td className="py-1.5 text-right tabular-nums">{r.rank}</td>
                          <td className="py-1.5 text-right font-bold tabular-nums">
                            {r.points}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {data!.stats.played > 0 && (
                  <p className="flex gap-4 text-xs text-muted">
                    <span>
                      {labels.played}: <b className="text-ink">{data!.stats.played}</b>
                    </span>
                    <span>
                      {labels.wins}: <b className="text-win">{data!.stats.wins}</b>
                    </span>
                    <span>
                      {labels.losses}: <b className="text-danger">{data!.stats.losses}</b>
                    </span>
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted">{labels.empty}</p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
