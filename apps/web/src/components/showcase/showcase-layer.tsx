'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { MatchPayload } from '@/lib/socket';
import { useCountUp } from './use-count-up';
import {
  STAGE_LABEL,
  type MatchProfiles,
  type MatchRatingResult,
  type ProfileCard,
  type RatingChange,
} from './types';
import './showcase.css';

/** Sahna davomiyligi (ms): o'yin boshida 22 s, tugagach 4 s kutib 14 s */
const INTRO_MS = 22_000;
const RATING_DELAY_MS = 4_000;
const RATING_MS = 14_000;

type Phase =
  | { kind: 'intro'; matchId: string; data: MatchProfiles; ms: number }
  | { kind: 'rating'; matchId: string; data: MatchRatingResult; ms: number }
  | null;

const fmt = (n: number) => n.toFixed(0);
const signed = (d: number) => (d > 0 ? `+${d}` : d < 0 ? `−${Math.abs(d)}` : '0');

/**
 * Efir qo'shimchasi (overlay va zal ekrani): o'yin boshida o'yinchilar kartochkalari
 * ("Tale of the Tape"), o'yin tugagach reyting yangilanishi animatsiyasi.
 *  - ball berilishi bilan kartochkalar o'zi yopiladi;
 *  - fonsiz (`variant="overlay"`) — OBS'da jonli kadr ustida ko'rinadi.
 */
export function ShowcaseLayer({
  match,
  variant,
}: {
  match: MatchPayload | null;
  variant: 'overlay' | 'screen';
}) {
  const [phase, setPhase] = useState<Phase>(null);
  const prev = useRef<{ id: string; status: string } | null>(null);
  const introShownFor = useRef<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  useEffect(() => {
    if (!match) return;
    const played =
      match.sets.length > 0 || match.currentSetP1 + match.currentSetP2 > 0;
    const before = prev.current;
    prev.current = { id: match.id, status: match.status };

    // Ball berilishi bilan o'yinchi kartochkalari yopiladi
    if (played) {
      setPhase((p) => (p && p.kind === 'intro' && p.matchId === match.id ? null : p));
    }

    // 1) Hakam stolga kirdi (kod tasdiqlandi), hali ball yo'q -> o'yinchilar kartochkalari
    // (hakam kodi kiritilgach o'yin SCHEDULED bo'lib qoladi — birinchi ball berilganda LIVE bo'ladi)
    if (
      match.status !== 'FINISHED' &&
      match.refereeVerified &&
      !played &&
      introShownFor.current !== match.id
    ) {
      introShownFor.current = match.id;
      void api
        .get<MatchProfiles>(`/showcase/match/${match.id}/profiles`)
        .then((data) => {
          if (data.players.length < 2) return;
          setPhase({ kind: 'intro', matchId: match.id, data, ms: INTRO_MS });
          timers.current.push(
            setTimeout(
              () => setPhase((p) => (p && p.kind === 'intro' && p.matchId === match.id ? null : p)),
              INTRO_MS,
            ),
          );
        })
        .catch(() => undefined);
    }

    // 2) O'yin tugadi (jonli kuzatilgan) -> 4 s kutib reyting yangilanishi
    if (
      before &&
      before.id === match.id &&
      before.status !== 'FINISHED' &&
      match.status === 'FINISHED' &&
      match.winnerId
    ) {
      const id = match.id;
      timers.current.push(
        setTimeout(() => {
          void api
            .get<MatchRatingResult>(`/showcase/match/${id}/rating`)
            .then((data) => {
              setPhase({ kind: 'rating', matchId: id, data, ms: RATING_MS });
              timers.current.push(
                setTimeout(
                  () => setPhase((p) => (p && p.kind === 'rating' && p.matchId === id ? null : p)),
                  RATING_MS,
                ),
              );
            })
            .catch(() => undefined);
        }, RATING_DELAY_MS),
      );
    }
  }, [match]);

  if (!phase) return null;
  const title =
    phase.data.tournamentName +
    (phase.data.tableNumber ? ` · STOL ${phase.data.tableNumber}` : '');
  const sub = STAGE_LABEL[phase.data.stage] ?? phase.data.stage;

  return (
    <div className={`sx-scene sx-${variant}`} role="status" aria-live="polite" key={`${phase.kind}-${phase.matchId}`}>
      <div className="sx-side sx-left">
        {phase.kind === 'intro' ? (
          <Player p={phase.data.players[0]} />
        ) : (
          <RatingPlayer p={phase.data.players[0]} />
        )}
      </div>
      <Panel phase={phase} title={title} sub={sub} />
      <div className="sx-side sx-right">
        {phase.kind === 'intro' ? (
          <Player p={phase.data.players[1]} />
        ) : (
          <RatingPlayer p={phase.data.players[1]} />
        )}
      </div>
      <div className="sx-bar" aria-hidden="true">
        <i style={{ animationDuration: `${phase.ms}ms` }} />
      </div>
    </div>
  );
}

function Photo({ url, name }: { url: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="sx-photo">
      <span className="sx-ini">{name.slice(0, 2).toUpperCase()}</span>
      {url && !broken && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" onError={() => setBroken(true)} />
      )}
    </div>
  );
}

function Plate({ first, last, rank }: { first: string; last: string; rank: number }) {
  const long = last.length > 12 ? ' sx-sm' : '';
  return (
    <div className="sx-plate">
      <div className={`sx-plate-in${long}`}>
        {rank > 0 && <i className="sx-rk">{rank}</i>}
        <small>{first.toUpperCase()}</small>
        <b>{last.toUpperCase()}</b>
      </div>
    </div>
  );
}

function Player({ p }: { p: ProfileCard }) {
  return (
    <div className="sx-pl">
      <div className="sx-flag" />
      <Photo url={p.photoUrl} name={p.lastName} />
      <Plate first={p.firstName} last={p.lastName} rank={p.rank} />
      <div className="sx-rec">
        <span>{p.countryCode}</span>
        <em>{fmt(p.rating)}</em>
      </div>
    </div>
  );
}

function RatingPlayer({ p }: { p: RatingChange }) {
  return (
    <div className="sx-pl">
      <div className="sx-flag" />
      {p.won && <div className="sx-win">G&apos;OLIB</div>}
      <Photo url={p.photoUrl} name={p.lastName} />
      <Plate first={p.firstName} last={p.lastName} rank={p.rankAfter} />
      <div className="sx-rec">
        <span>{p.countryCode}</span>
        <em className={p.delta > 0 ? 'sx-up' : p.delta < 0 ? 'sx-dn' : ''}>{signed(p.delta)}</em>
      </div>
    </div>
  );
}

function Panel({ phase, title, sub }: { phase: NonNullable<Phase>; title: string; sub: string }) {
  if (phase.kind === 'intro') {
    const [a, b] = phase.data.players;
    const rows: Array<[string, string, string]> = [
      [a.age ? String(a.age) : '–', 'YOSH', b.age ? String(b.age) : '–'],
      [fmt(a.rating), 'REYTING', fmt(b.rating)],
      [`#${a.rank}`, "O'RIN", `#${b.rank}`],
      [a.region, 'HUDUD', b.region],
      [String(a.played), "O'YNAGAN", String(b.played)],
      [String(a.won), 'YUTGAN', String(b.won)],
      [String(a.lost), 'YUTQAZGAN', String(b.lost)],
    ];
    return (
      <div className="sx-panel">
        <div className="sx-tab">{title}</div>
        <div className="sx-head">
          <b>O&apos;YINCHILAR</b>
          <i>{sub}</i>
        </div>
        {rows.map(([l, k, r], i) => (
          <div className="sx-row" key={k} style={{ animationDelay: `${0.5 + i * 0.09}s` }}>
            <span className={l.length > 11 ? 'sx-lg' : ''}>{l}</span>
            <em>{k}</em>
            <span className={r.length > 11 ? 'sx-lg' : ''}>{r}</span>
          </div>
        ))}
      </div>
    );
  }
  const [a, b] = phase.data.players;
  const sets = `${a.sets} – ${b.sets}`;
  return (
    <div className="sx-panel">
      <div className="sx-tab">{title}</div>
      <div className="sx-head">
        <b>REYTING YANGILANDI</b>
        <i>{sub}</i>
        <u>{sets}</u>
      </div>
      <RatingRow a={a} b={b} />
      <div className="sx-row" style={{ animationDelay: '0.5s' }}>
        <Chip d={a.delta} />
        <em>+ / &minus;</em>
        <Chip d={b.delta} />
      </div>
      <div className="sx-row" style={{ animationDelay: '0.6s' }}>
        <Rank p={a} />
        <em>O&apos;RIN</em>
        <Rank p={b} />
      </div>
    </div>
  );
}

function RatingRow({ a, b }: { a: RatingChange; b: RatingChange }) {
  const va = useCountUp(a.before, a.after, 900, 2400);
  const vb = useCountUp(b.before, b.after, 900, 2400);
  return (
    <div className="sx-row" style={{ animationDelay: '0.4s' }}>
      <span>{fmt(va)}</span>
      <em>REYTING</em>
      <span>{fmt(vb)}</span>
    </div>
  );
}

function Chip({ d }: { d: number }) {
  return <span className={`sx-chip ${d > 0 ? 'sx-pos' : d < 0 ? 'sx-neg' : ''}`}>{signed(d)}</span>;
}

function Rank({ p }: { p: RatingChange }) {
  if (p.rankBefore === p.rankAfter) return <span>#{p.rankAfter}</span>;
  const up = p.rankAfter < p.rankBefore;
  return (
    <span className={`sx-rkch ${up ? 'sx-up' : 'sx-dn'}`}>
      <s>#{p.rankBefore}</s> {up ? '▲' : '▼'} #{p.rankAfter}
    </span>
  );
}
