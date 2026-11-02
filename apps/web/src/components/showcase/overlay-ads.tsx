'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Avatar } from '@/components/ui/avatar';
import { DrawBoard } from '@/components/screen/draw-board';
import type { OverlayAdPublic } from './types';

interface Side { name: string; photoUrl: string | null; sets: number; won: boolean }
interface IdleMatch { id: string; stage: string; table: number | null; at: string | null; p1: Side; p2: Side; referee: string | null; assistant: string | null }
interface Idle { tournament: string | null; results: IdleMatch[]; upcoming: IdleMatch[]; groupCategories: Array<{ id: string; label: string }> }

type Section = { kind: 'results' } | { kind: 'upcoming' } | { kind: 'groups'; id: string; label: string };
type Step = { type: 'section'; section: Section } | { type: 'ads'; ads: OverlayAdPublic[] };

const SECTION_S = { results: 12, upcoming: 12, groups: 15 } as const;
const STAGE: Record<string, string> = {
  GROUP: 'Guruh', ROUND_1: '1-raund', ROUND_OF_32: '1/16', ROUND_OF_16: '1/8', QUARTERFINAL: 'Chorak final',
  SEMIFINAL: 'Yarim final', THIRD_PLACE: '3-o‘rin', FINAL: 'FINAL',
};

/**
 * Stolda o'yin bo'lmagan bo'sh vaqt (`idle`) aylanmasi:
 *   bo'lim (natijalar / navbatdagi o'yinlar / guruh jadvallari) → reklama bloki → keyingi bo'lim → ...
 * Reklama bloki: 2–3 ta qisqa reklama (rasm yoki ≤15 s rolik) YOKI har 3-blokda bitta promo rolik (≤30 s).
 * Reklama ham, ma'lumot ham bo'lmasa — hech narsa chizilmaydi (shaffof).
 */
export function OverlayAds({ table, idle }: { table: number; idle: boolean }) {
  const [ads, setAds] = useState<OverlayAdPublic[]>([]);
  const [feed, setFeed] = useState<Idle | null>(null);
  const [step, setStep] = useState<Step | null>(null);
  const cursor = useRef({ section: 0, ad: 0, promo: 0, breaks: 0 });

  useEffect(() => {
    let alive = true;
    const load = () => {
      api.get<OverlayAdPublic[]>(`/showcase/ads?table=${table}`).then((r) => alive && setAds(r)).catch(() => undefined);
      api.get<Idle>(`/showcase/idle?table=${table}`).then((r) => alive && setFeed(r)).catch(() => undefined);
    };
    load();
    const id = setInterval(load, 20_000);
    return () => { alive = false; clearInterval(id); };
  }, [table]);

  const sections = useMemo<Section[]>(() => {
    const out: Section[] = [];
    if (feed?.results.length) out.push({ kind: 'results' });
    if (feed?.upcoming.length) out.push({ kind: 'upcoming' });
    for (const g of feed?.groupCategories ?? []) out.push({ kind: 'groups', id: g.id, label: g.label });
    return out;
  }, [feed]);

  // Ro'yxatlar so'rov oralig'ida o'zgarsa ham aylanma buzilmasin — ref orqali o'qiladi
  const live = useRef({ ads, sections });
  useEffect(() => {
    live.current = { ads, sections };
  }, [ads, sections]);

  const nextAdBlock = useCallback((): OverlayAdPublic[] => {
    const all = live.current.ads;
    const promos = all.filter((a) => a.kind === 'PROMO');
    const shorts = all.filter((a) => a.kind !== 'PROMO');
    const c = cursor.current;
    c.breaks += 1;
    if (promos.length && (c.breaks % 3 === 0 || shorts.length === 0)) {
      return [promos[c.promo++ % promos.length]];
    }
    if (!shorts.length) return [];
    const n = Math.min(shorts.length, c.breaks % 2 === 0 ? 3 : 2); // 2 va 3 navbatma-navbat
    return Array.from({ length: n }, () => shorts[c.ad++ % shorts.length]);
  }, []);

  const advance = useCallback((after: Step | null) => {
    const { sections: secs } = live.current;
    // Bo'limdan keyin — reklama bloki (reklama bo'lmasa — darhol keyingi bo'lim)
    if (after?.type === 'section') {
      const block = nextAdBlock();
      if (block.length) {
        setStep({ type: 'ads', ads: block });
        return;
      }
    }
    // Reklamadan keyin (yoki boshida) — keyingi bo'lim; bo'lim yo'q bo'lsa — yana reklama
    if (secs.length) {
      setStep({ type: 'section', section: secs[cursor.current.section++ % secs.length] });
      return;
    }
    const block = nextAdBlock();
    setStep(block.length ? { type: 'ads', ads: block } : null);
  }, [nextAdBlock]);

  // Bo'sh vaqt tugaganda aylanma to'xtaydi (render paytida holatni tiklash — effect'siz)
  const [wasIdle, setWasIdle] = useState(idle);
  if (wasIdle !== idle) {
    setWasIdle(idle);
    if (!idle) setStep(null);
  }

  // Bo'sh vaqt boshlanganda aylanma yoqiladi
  useEffect(() => {
    if (idle && !step && feed && (sections.length || ads.length)) advance(null);
  }, [idle, step, feed, sections.length, ads.length, advance]);

  // Bo'lim vaqti tugagach keyingi qadam
  useEffect(() => {
    if (!idle || !step || step.type !== 'section') return;
    const t = setTimeout(() => advance(step), SECTION_S[step.section.kind] * 1000);
    return () => clearTimeout(t);
  }, [idle, step, advance]);

  if (!idle || !step) return null;
  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-black text-white" aria-hidden="true">
      {step.type === 'ads' ? (
        <AdBlock key={step.ads.map((a) => a.id).join()} ads={step.ads} onDone={() => advance(step)} />
      ) : (
        <SectionView section={step.section} feed={feed} />
      )}
    </div>
  );
}

/**
 * Reklamalar ketma-ket: rasm — durationS soniya; rolik — tugaguncha (yoki durationS+1 s dan oshmasin).
 * `onDone` ref'da: ota komponent har 20 s so'rovda qayta chizilganda taymer qayta boshlanmasin.
 */
function AdBlock({ ads, onDone }: { ads: OverlayAdPublic[]; onDone: () => void }) {
  const [i, setI] = useState(0);
  const ad = ads[i];
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);
  const next = useCallback(() => {
    if (i + 1 < ads.length) setI(i + 1);
    else doneRef.current();
  }, [i, ads.length]);

  useEffect(() => {
    const ms = (ad.videoUrl ? ad.durationS + 1 : ad.durationS) * 1000;
    const t = setTimeout(next, ms);
    return () => clearTimeout(t);
  }, [ad, next]);

  return ad.videoUrl ? (
    <video key={ad.id + i} src={ad.videoUrl} autoPlay muted playsInline onEnded={next} onError={next}
      className="h-full w-full object-contain" style={{ animation: 'sx-fade .6s both' }} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={ad.id + i} src={ad.imageUrl ?? ''} alt="" className="h-full w-full object-contain" style={{ animation: 'sx-fade .6s both' }} />
  );
}

function SectionView({ section, feed }: { section: Section; feed: Idle | null }) {
  if (section.kind === 'groups') {
    return (
      <div className="h-full w-full bg-broadcast-bg" style={{ animation: 'sx-fade .6s both' }}>
        <h2 className="px-6 pt-5 font-heading text-3xl font-extrabold uppercase tracking-widest text-broadcast-gold">Guruh jadvallari · {section.label}</h2>
        <DrawBoard categoryId={section.id} view="groups" />
      </div>
    );
  }
  const rows = (section.kind === 'results' ? feed?.results : feed?.upcoming) ?? [];
  return (
    <div className="flex h-full w-full flex-col bg-broadcast-bg px-10 py-8" style={{ animation: 'sx-fade .6s both' }}>
      <h2 className="font-heading text-4xl font-extrabold uppercase tracking-widest text-broadcast-gold">
        {section.kind === 'results' ? 'Oxirgi natijalar' : 'Navbatdagi o‘yinlar'}
      </h2>
      {feed?.tournament && <p className="mb-5 text-lg text-white/60">{feed.tournament}</p>}
      <div className="grid flex-1 content-start gap-3">
        {rows.slice(0, 8).map((m) => (
          <div key={m.id} className="flex items-center gap-4 rounded-lg bg-broadcast-bg2 px-5 py-3 shadow-xl">
            <div className="w-40 shrink-0 text-sm font-bold uppercase tracking-wider text-white/60">
              {STAGE[m.stage] ?? m.stage}
              <div>{m.table ? `Stol ${m.table}` : ''}{m.at ? ` · ${new Date(m.at).toLocaleTimeString('uz', { hour: '2-digit', minute: '2-digit' })}` : ''}</div>
            </div>
            <PlayerSide s={m.p1} score={section.kind === 'results'} />
            <span className="text-white/40">—</span>
            <PlayerSide s={m.p2} score={section.kind === 'results'} />
            {(m.referee || m.assistant) && (
              <div className="ml-auto w-64 shrink-0 text-right text-sm text-white/60">
                Hakam: <b className="text-white">{m.referee ?? '—'}</b>
                {m.assistant ? <div>Yordamchi: <b className="text-white">{m.assistant}</b></div> : null}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlayerSide({ s, score }: { s: Side; score: boolean }) {
  const [first, ...rest] = s.name.split(' ');
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-3 text-2xl ${s.won ? 'font-bold text-broadcast-gold' : ''}`}>
      <Avatar tone="broadcast" photoUrl={s.photoUrl} firstName={first.replace('.', '')} lastName={rest.join(' ')} size={52} />
      <span className="truncate">{s.name}</span>
      {score && <span className="ml-auto grid size-11 place-items-center rounded bg-white/15 text-2xl font-extrabold tabular-nums">{s.sets}</span>}
    </div>
  );
}
