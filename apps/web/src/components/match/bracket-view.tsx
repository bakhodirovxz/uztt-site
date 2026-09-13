import { getTranslations } from 'next-intl/server';

interface BracketMatch {
  id: string;
  bracketPosition: number;
  status: string;
  winnerId: string | null;
  player1SetsWon: number;
  player2SetsWon: number;
  player1: { id: string; firstName: string; lastName: string } | null;
  player2: { id: string; firstName: string; lastName: string } | null;
  sets: Array<{ p1Points: number; p2Points: number }>;
}

export interface BracketData {
  id: string;
  size: number;
  category: {
    gender: 'MALE' | 'FEMALE';
    ageCategory: { code: string; name: string };
  };
  rounds: Array<{
    roundNumber: number;
    stage: string;
    matches: BracketMatch[];
  }>;
}

/** WTT-uslub gorizontal setka: ustunlar = raundlar, kartalar markazlashgan */
export async function BracketView({ bracket }: { bracket: BracketData }) {
  const t = await getTranslations('bracket');
  const tm = await getTranslations('match');

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded bg-navy-800 px-2 py-0.5 text-xs font-bold text-white">
          {bracket.category.ageCategory.code}
        </span>
        <span className="text-sm font-semibold text-muted">
          {bracket.category.gender === 'MALE' ? '♂' : '♀'} ·{' '}
          {bracket.size} lik setka
        </span>
      </div>

      <div className="overflow-x-auto pb-3">
        <div className="flex gap-6" style={{ minWidth: bracket.rounds.length * 240 }}>
          {bracket.rounds.map((round) => (
            <div key={round.roundNumber} className="flex w-56 shrink-0 flex-col">
              <h4 className="mb-3 text-center font-heading text-xs font-bold uppercase tracking-wider text-muted">
                {tm(`stage_${round.stage}`)}
              </h4>
              <div className="flex flex-1 flex-col justify-around gap-4">
                {round.matches.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-card bg-surface-card text-sm shadow-card"
                  >
                    {(
                      [
                        [m.player1, m.player1SetsWon],
                        [m.player2, m.player2SetsWon],
                      ] as const
                    ).map(([p, sets], i) => {
                      const isWinner =
                        m.status === 'FINISHED' && p && m.winnerId === p.id;
                      const isBye =
                        m.status === 'FINISHED' && !p && m.sets.length === 0;
                      return (
                        <div
                          key={i}
                          className={`flex items-center justify-between gap-2 px-3 py-2 ${
                            i === 0 ? 'border-b border-border' : ''
                          } ${isWinner ? 'font-bold' : ''}`}
                        >
                          <span className={`truncate ${!p ? 'text-muted/60 italic' : ''}`}>
                            {p
                              ? `${p.firstName[0]}. ${p.lastName}`
                              : isBye
                                ? t('bye')
                                : t('tbd')}
                          </span>
                          <span
                            className={`grid size-6 shrink-0 place-items-center rounded text-xs font-extrabold ${
                              isWinner
                                ? 'bg-accent-600 text-white'
                                : 'bg-surface text-muted'
                            }`}
                          >
                            {m.sets.length > 0 || m.status !== 'SCHEDULED'
                              ? sets
                              : '–'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
