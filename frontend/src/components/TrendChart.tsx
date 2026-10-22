import { useEffect, useMemo, useRef, useState } from 'react';

export interface ChartLine {
  id: string;
  label: string;
  color: string;
  points: [number, number][];
  dashed?: boolean;
}
export interface ChartEvent {
  date: string;
  label: string;
}

// Colors for the countries that appear in the trend charts: the U.S. blue and China orange as everywhere else on the site, then distinct
// hues for the others. Identity is also carried by the label at the end of each line and by the table, never by color alone.
export const SUBJECT_COLOR: Record<string, string> = {
  US: 'var(--color-hue-blue-ink)',
  CN: 'var(--color-hue-orange-ink)',
  DE: 'var(--color-hue-violet-ink)',
  RU: 'var(--color-hue-gray-ink)',
  CA: 'var(--color-hue-pink-ink)',
  GB: 'var(--color-hue-cyan-ink)',
};

const H = 230;
const PAD = { l: 38, r: 74, t: 14, b: 24 };
// "United States" and "United Kingdom" are too long for the margin; the full name stays in the readout, legend-free table and aria label.
const short = (label: string) => (label === 'United States' ? 'U.S.' : label === 'United Kingdom' ? 'U.K.' : label);
// A gap longer than this between two published readings is drawn as a dashed line, so a long join never looks like a measured path.
const GAP_YEARS = 3;
const yearFrac = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  const end = Date.UTC(d.getUTCFullYear() + 1, 0, 1);
  return d.getUTCFullYear() + (d.getTime() - start) / (end - start);
};

// A line chart of one or more series by year. Hover or arrow keys read a year; events are drawn as numbered markers and listed under the
// chart; a table of the plotted numbers sits one click away. Gaps in a series are drawn as gaps in the data (points joined across them),
// so every plotted dot is a published number.
export function TrendChart({
  lines,
  format,
  events = [],
  ariaLabel,
  min,
  max,
  ticks: tickValues,
  zeroLine = false,
}: {
  lines: ChartLine[];
  format: (v: number) => string;
  events?: ChartEvent[];
  ariaLabel: string;
  min?: number;
  max?: number;
  ticks?: number[];
  zeroLine?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const years = useMemo(() => [...new Set(lines.flatMap((l) => l.points.map((p) => p[0])))].sort((a, b) => a - b), [lines]);
  const values = lines.flatMap((l) => l.points.map((p) => p[1]));
  if (years.length === 0 || values.length === 0) return <p className="text-sm text-ink-faint">No data to chart.</p>;

  const x0 = years[0];
  const x1 = Math.max(years[years.length - 1], x0 + 1);
  const lo = min ?? Math.min(0, Math.floor(Math.min(...values) / 10) * 10);
  const hi = max ?? Math.ceil(Math.max(...values) / 10) * 10;
  const x = (yr: number) => PAD.l + ((yr - x0) / (x1 - x0)) * (width - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo || 1)) * (H - PAD.t - PAD.b);
  const ticks = tickValues ?? [lo, lo + (hi - lo) / 2, hi];
  const yearTicks = years.length <= 6 ? years : [years[0], years[Math.floor(years.length / 2)], years[years.length - 1]];
  const shownEvents = events.map((e, i) => ({ ...e, n: i + 1, at: yearFrac(e.date) })).filter((e) => e.at >= x0 && e.at <= x1);

  // End-of-line labels, nudged apart so two lines that finish close together stay readable.
  const endLabels = lines
    .map((l) => {
      const last = [...l.points].sort((a, b) => a[0] - b[0]).pop()!;
      return { id: l.id, label: l.label, color: l.color, x: x(last[0]), y: y(last[1]), ly: y(last[1]) };
    })
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < endLabels.length; i++) if (endLabels[i].ly - endLabels[i - 1].ly < 13) endLabels[i].ly = endLabels[i - 1].ly + 13;

  const hoverYear = hover === null ? null : years[hover];
  const at = (clientX: number, left: number) => {
    const t = x0 + ((clientX - left - PAD.l) / (width - PAD.l - PAD.r)) * (x1 - x0);
    let best = 0;
    for (let i = 1; i < years.length; i++) if (Math.abs(years[i] - t) < Math.abs(years[best] - t)) best = i;
    setHover(best);
  };

  return (
    <div ref={box} className="w-full">
      <p className="mb-1 min-h-[1.25rem] text-[13px] text-ink-muted" aria-live="polite">
        {hoverYear !== null ? (
          <>
            <span className="font-semibold text-ink">{hoverYear}:</span>{' '}
            {lines
              .map((l) => {
                const p = l.points.find((q) => q[0] === hoverYear);
                return p ? `${l.label} ${format(p[1])}` : null;
              })
              .filter(Boolean)
              .join(', ') || 'no reading published for this year'}
          </>
        ) : (
          'Move over the chart, or use the arrow keys, to read a year.'
        )}
      </p>
      <svg
        width={width}
        height={H}
        role="img"
        tabIndex={0}
        aria-label={`${ariaLabel} Use the left and right arrow keys to read each year; the same numbers are in the table below.`}
        className="block touch-pan-y"
        onPointerMove={(e) => at(e.clientX, e.currentTarget.getBoundingClientRect().left)}
        onPointerLeave={() => setHover(null)}
        onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          e.preventDefault();
          setHover((h) => Math.max(0, Math.min(years.length - 1, (h ?? years.length - 1) + (e.key === 'ArrowRight' ? 1 : -1))));
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={width - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--color-hairline)" />
            <text x={PAD.l - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="var(--color-ink-muted)">
              {format(t)}
            </text>
          </g>
        ))}
        {zeroLine && lo < 0 && hi > 0 && <line x1={PAD.l} x2={width - PAD.r} y1={y(0)} y2={y(0)} stroke="var(--color-hairline-strong)" />}
        {yearTicks.map((t, i) => (
          <text key={t} x={x(t)} y={H - 6} textAnchor={i === 0 ? 'start' : i === yearTicks.length - 1 ? 'end' : 'middle'} fontSize="10" fill="var(--color-ink-muted)">
            {t}
          </text>
        ))}
        {shownEvents.map((e) => (
          <g key={e.n}>
            <line x1={x(e.at)} x2={x(e.at)} y1={PAD.t + 10} y2={H - PAD.b} stroke="var(--color-hairline-strong)" strokeDasharray="2 3" />
            <circle cx={x(e.at)} cy={PAD.t + 4} r="7" fill="var(--color-paper-raised)" stroke="var(--color-ink-muted)" />
            <text x={x(e.at)} y={PAD.t + 7.5} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="var(--color-ink)">
              {e.n}
            </text>
          </g>
        ))}
        {hoverYear !== null && <line x1={x(hoverYear)} x2={x(hoverYear)} y1={PAD.t} y2={H - PAD.b} stroke="var(--color-hairline-strong)" strokeDasharray="3 3" />}
        {lines.map((l) => {
          const pts = [...l.points].sort((a, b) => a[0] - b[0]);
          return (
            <g key={l.id}>
              {pts.slice(1).map((p, i) => {
                const a = pts[i];
                const gap = p[0] - a[0] > GAP_YEARS;
                return (
                  <line key={p[0]} x1={x(a[0])} y1={y(a[1])} x2={x(p[0])} y2={y(p[1])} stroke={l.color} strokeWidth="2" strokeDasharray={gap || l.dashed ? '4 4' : undefined} strokeOpacity={gap ? 0.6 : 1} />
                );
              })}
              {pts.map((p) => (
                <circle key={p[0]} cx={x(p[0])} cy={y(p[1])} r={hoverYear === p[0] ? 5 : 3.2} fill={l.color} stroke="var(--color-paper-raised)" strokeWidth="1.5" />
              ))}
            </g>
          );
        })}
        {endLabels.map((e) => (
          <text key={e.id} x={e.x + 8} y={e.ly + 3.5} fontSize="11" fontWeight="600" fill={e.color}>
            {short(e.label)}
          </text>
        ))}
      </svg>
      {shownEvents.length > 0 && (
        <ol className="mt-1 space-y-0.5 text-[12px] text-ink-muted">
          {shownEvents.map((e) => (
            <li key={e.n}>
              <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-ink-muted text-[10px] font-semibold text-ink">{e.n}</span>
              {e.date.slice(0, 4)}: {e.label}
            </li>
          ))}
        </ol>
      )}
      <details className="mt-2 text-xs text-ink-muted">
        <summary className="cursor-pointer font-semibold hover:text-ink">The same numbers as a table</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[18rem] text-left text-[13px]">
            <caption className="sr-only">{ariaLabel}</caption>
            <thead>
              <tr className="border-b border-hairline text-xs">
                <th scope="col" className="py-1 pr-3 font-semibold">
                  Year
                </th>
                {lines.map((l) => (
                  <th key={l.id} scope="col" className="py-1 pr-3 font-semibold">
                    {l.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {years.map((yr) => (
                <tr key={yr} className="border-b border-hairline/60">
                  <th scope="row" className="py-1 pr-3 font-normal tabular-nums">
                    {yr}
                  </th>
                  {lines.map((l) => {
                    const p = l.points.find((q) => q[0] === yr);
                    return (
                      <td key={l.id} className="py-1 pr-3 tabular-nums text-ink">
                        {p ? format(p[1]) : <span className="text-ink-faint">n/a</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
