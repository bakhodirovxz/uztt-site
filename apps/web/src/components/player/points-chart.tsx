/**
 * Reyting balli grafigi — bitta qator (seriya), shuning uchun legenda kerak emas:
 * sarlavha nimani ko'rsatayotganini aytadi. Server tomonda SVG sifatida chiziladi,
 * hover uchun <title>, matn alternativasi uchun jadval ko'rinishi bor.
 */

export interface PointsDatum {
  date: string;
  points: number;
}

const W = 720;
const H = 240;
const PAD = { top: 16, right: 16, bottom: 28, left: 48 };

/** Chiziq va to'ldirish rangi — stol ko'ki (qizil faqat jonli holat uchun) */
const SERIES = 'var(--color-court-400)';

export function PointsChart({
  data,
  title,
  emptyLabel,
  tableLabel,
  dateLabel,
  pointsLabel,
  locale,
}: {
  data: PointsDatum[];
  title: string;
  emptyLabel: string;
  tableLabel: string;
  dateLabel: string;
  pointsLabel: string;
  locale: string;
}) {
  if (data.length === 0) {
    return (
      <section>
        <h2 className="font-heading text-xl font-bold uppercase tracking-wide">
          {title}
        </h2>
        <p className="mt-4 text-muted">{emptyLabel}</p>
      </section>
    );
  }

  const times = data.map((d) => new Date(d.date).getTime());
  const values = data.map((d) => d.points);
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const vMax = Math.max(...values, 1);
  // Pastki chegara doim 0 — ball hajmini ko'z bilan solishtirish uchun
  const vMin = 0;

  const x = (t: number) =>
    tMax === tMin
      ? PAD.left + (W - PAD.left - PAD.right) / 2
      : PAD.left + ((t - tMin) / (tMax - tMin)) * (W - PAD.left - PAD.right);
  const y = (v: number) =>
    H - PAD.bottom - ((v - vMin) / (vMax - vMin)) * (H - PAD.top - PAD.bottom);

  const pts = data.map((d, i) => ({ ...d, x: x(times[i]), y: y(d.points) }));
  const line = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${PAD.left},${H - PAD.bottom} ${line} ${pts[pts.length - 1].x.toFixed(1)},${H - PAD.bottom}`;

  // Y o'qi: 0, o'rta, maksimum — kam chiziq, kam shovqin
  const yTicks = [0, Math.round(vMax / 2), vMax];
  const last = pts[pts.length - 1];
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  return (
    <section>
      <h2 className="font-heading text-xl font-bold uppercase tracking-wide">
        {title}
      </h2>

      <div className="mt-4 overflow-x-auto rounded-card border border-border bg-surface-card p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-56 w-full min-w-[32rem]"
          role="img"
          aria-label={title}
        >
          <defs>
            <linearGradient id="pointsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES} stopOpacity="0.28" />
              <stop offset="100%" stopColor={SERIES} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* To'r — orqa fonda qoladi */}
          {yTicks.map((v) => (
            <g key={v}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(v)}
                y2={y(v)}
                stroke="var(--color-border)"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 8}
                y={y(v) + 4}
                textAnchor="end"
                className="fill-[var(--color-muted)] text-[11px] tabular-nums"
              >
                {v}
              </text>
            </g>
          ))}

          <polygon points={area} fill="url(#pointsFill)" />
          <polyline
            points={line}
            fill="none"
            stroke={SERIES}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Nuqtalar: hover'da sana va ball ko'rinadi (JS'siz) */}
          {pts.map((p, i) => (
            <circle
              key={`${p.date}-${i}`}
              cx={p.x}
              cy={p.y}
              r={i === pts.length - 1 ? 5 : 3.5}
              fill={SERIES}
              stroke="var(--color-surface-card)"
              strokeWidth="2"
            >
              <title>
                {fmtDate(p.date)} — {p.points} {pointsLabel}
              </title>
            </circle>
          ))}

          {/* Faqat oxirgi nuqta yozib ko'rsatiladi — har nuqtada raqam shovqin */}
          <text
            x={Math.min(last.x + 10, W - PAD.right)}
            y={Math.max(last.y - 10, PAD.top + 10)}
            textAnchor={last.x > W - 80 ? 'end' : 'start'}
            className="fill-[var(--color-ink)] text-[13px] font-bold tabular-nums"
          >
            {last.points}
          </text>

          {/* X o'qi: boshi va oxiri */}
          <text
            x={PAD.left}
            y={H - 8}
            className="fill-[var(--color-muted)] text-[11px]"
          >
            {fmtDate(data[0].date)}
          </text>
          <text
            x={W - PAD.right}
            y={H - 8}
            textAnchor="end"
            className="fill-[var(--color-muted)] text-[11px]"
          >
            {fmtDate(data[data.length - 1].date)}
          </text>
        </svg>
      </div>

      {/* Matn alternativasi — skrinrider va bosma uchun */}
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-semibold text-muted hover:text-ink">
          {tableLabel}
        </summary>
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wider text-muted">
              <th className="py-2 font-bold">{dateLabel}</th>
              <th className="py-2 text-right font-bold">{pointsLabel}</th>
            </tr>
          </thead>
          <tbody>
            {[...data].reverse().map((d, i) => (
              <tr key={`${d.date}-${i}`} className="border-b border-border/60">
                <td className="py-2 text-muted">
                  {new Date(d.date).toLocaleDateString(locale)}
                </td>
                <td className="py-2 text-right font-semibold tabular-nums">
                  {d.points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
