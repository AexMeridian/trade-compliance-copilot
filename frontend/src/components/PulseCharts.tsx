import { useEffect, useRef, useState } from 'react';
import type { CurrencyRow } from '../types/pulse';
import { PulseDelta } from './PulseDelta';

// Dependency-free SVG charts for the Markets tab. Everything plotted is a
// stored observation (or a plain percent change between two of them) -- no
// smoothing, forecasting or model output.

export type Point = [string, number]; // [ISO date, value], oldest first

// ---------- Sparkline ----------

// Colored by direction over the whole window (green up, red down -- the same
// up/down convention as PulseDelta), with a faint area fill under the line.
export function PulseSpark({ values, height = 28, className = '' }: { values: number[]; height?: number; className?: string }) {
  if (values.length < 2) return <div style={{ height }} className={className} />;
  const w = 100;
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const xy = values.map((v, i) => [(i / (values.length - 1)) * w, height - 2 - ((v - min) / span) * (height - 4)] as const);
  const line = xy.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const color = values[values.length - 1] >= values[0] ? 'var(--color-clear)' : 'var(--color-stop)';
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" aria-hidden="true" className={`block w-full ${className}`} style={{ height }}>
      <polygon points={`0,${height} ${line} ${w},${height}`} fill={color} opacity="0.12" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

// ---------- Multi-line chart, indexed to 100 ----------

export interface LineSeries {
  id: string;
  label: string;
  css: string; // stroke color (CSS value)
  swatch: string; // matching bg-* class for the legend
  points: Point[];
}

const fmtDate = (t: number) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

// Different markets trade on different calendars and sit at very different
// levels (Dow ~51,000 vs. S&P ~7,700), so each series is rebased to 100 at
// its first point in the window; the chart then shows relative performance.
export function PulseLineChart({ series }: { series: LineSeries[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hoverX, setHoverX] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(260, Math.floor(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const usable = series
    .filter((s) => s.points.length > 1)
    .map((s) => ({ ...s, pts: s.points.map(([d, v]) => [Date.parse(d), (v / s.points[0][1]) * 100] as const) }));
  if (usable.length === 0) return <p className="text-sm text-ink-faint">Chart data isn't available right now.</p>;

  const H = 230;
  const pad = { l: 38, r: 10, t: 10, b: 22 };
  const tMin = Math.min(...usable.map((s) => s.pts[0][0]));
  const tMax = Math.max(...usable.map((s) => s.pts[s.pts.length - 1][0]));
  const allV = usable.flatMap((s) => s.pts.map((p) => p[1]));
  const lo = Math.min(...allV, 100);
  const hi = Math.max(...allV, 100);
  const padV = (hi - lo) * 0.08 || 1;
  const yMin = lo - padV;
  const yMax = hi + padV;
  const x = (t: number) => pad.l + ((t - tMin) / (tMax - tMin || 1)) * (width - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);
  const yTicks = [0, 1, 2, 3].map((i) => yMin + ((yMax - yMin) * i) / 3);
  const xTicks = [0, 1, 2, 3].map((i) => tMin + ((tMax - tMin) * i) / 3);

  const hoverT = hoverX === null ? null : tMin + ((hoverX - pad.l) / (width - pad.l - pad.r)) * (tMax - tMin);
  const hoverRows =
    hoverT === null
      ? []
      : usable.map((s) => {
          const nearest = s.pts.reduce((best, p) => (Math.abs(p[0] - hoverT) < Math.abs(best[0] - hoverT) ? p : best));
          return { s, t: nearest[0], v: nearest[1] };
        });

  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
        {usable.map((s) => {
          const last = s.pts[s.pts.length - 1][1] - 100;
          return (
            <li key={s.id} className="flex items-center gap-1.5 text-ink-muted">
              <span className={`h-2 w-2 ${s.swatch}`} aria-hidden="true" />
              {s.label}
              <PulseDelta change={last} text={`${Math.abs(last).toFixed(1)}%`} />
            </li>
          );
        })}
      </ul>
      <div ref={box} className="relative w-full">
        <svg
          width={width}
          height={H}
          role="img"
          aria-label="Line chart of relative performance, each line rebased to 100 at the start of the period"
          className="block touch-pan-y"
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setHoverX(Math.min(Math.max(e.clientX - r.left, pad.l), width - pad.r));
          }}
          onPointerLeave={() => setHoverX(null)}
        >
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} stroke="var(--color-hairline)" />
              <text x={pad.l - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill="var(--color-ink-faint)">
                {v.toFixed(0)}
              </text>
            </g>
          ))}
          <line x1={pad.l} x2={width - pad.r} y1={y(100)} y2={y(100)} stroke="var(--color-hairline-strong)" strokeDasharray="3 3" />
          {xTicks.map((t, i) => (
            <text
              key={t}
              x={x(t)}
              y={H - 6}
              textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
              fontSize="10"
              fill="var(--color-ink-faint)"
            >
              {fmtDate(t)}
            </text>
          ))}
          {usable.map((s) => (
            <polyline
              key={s.id}
              points={s.pts.map(([t, v]) => `${x(t).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}
              fill="none"
              stroke={s.css}
              strokeWidth="1.75"
              strokeLinejoin="round"
            />
          ))}
          {hoverT !== null && <line x1={x(hoverT)} x2={x(hoverT)} y1={pad.t} y2={H - pad.b} stroke="var(--color-ink-faint)" />}
          {hoverRows.map(({ s, t, v }) => (
            <circle key={s.id} cx={x(t)} cy={y(v)} r="3.5" fill={s.css} stroke="var(--color-paper)" strokeWidth="1.5" />
          ))}
        </svg>
        {hoverT !== null && hoverRows.length > 0 && (
          <div
            className="pointer-events-none absolute top-2 border border-hairline-strong bg-paper-raised px-2.5 py-1.5 text-[11px] tabular-nums text-ink"
            style={{ left: hoverX! > width / 2 ? undefined : hoverX! + 12, right: hoverX! > width / 2 ? width - hoverX! + 12 : undefined }}
          >
            <div className="mb-1 text-ink-faint">{fmtDate(hoverT)}</div>
            {hoverRows.map(({ s, v }) => (
              <div key={s.id} className="flex items-center gap-2">
                <span className={`h-2 w-2 ${s.swatch}`} aria-hidden="true" />
                <span className="text-ink-muted">{s.label}</span>
                <span className={`ml-auto pl-3 ${v >= 100 ? 'text-clear' : 'text-stop'}`}>
                  {v >= 100 ? '+' : '−'}
                  {Math.abs(v - 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="mt-2 text-[11px] text-ink-faint">Each line is rebased to 100 at the start, so lines show relative performance, not price.</p>
    </div>
  );
}

// ---------- Diverging bars: who moved most vs. the dollar ----------

const CURRENCY_NAMES: Record<string, string> = {
  EUR: 'Euro',
  CNY: 'Chinese yuan',
  JPY: 'Japanese yen',
  MXN: 'Mexican peso',
  CAD: 'Canadian dollar',
  GBP: 'British pound',
  INR: 'Indian rupee',
  KRW: 'South Korean won',
};

export interface Mover {
  key: string;
  label: string;
  pct: number;
}

// Bars to the right (green) rose over the period; to the left (red) fell.
// Same up/down convention as everywhere else on the page.
export function PulseMoverBars({ movers, note }: { movers: Mover[]; note?: string }) {
  const sorted = [...movers].sort((a, b) => b.pct - a.pct);
  if (sorted.length === 0) return <p className="text-sm text-ink-faint">Not enough history yet to compare.</p>;
  const max = Math.max(...sorted.map((m) => Math.abs(m.pct)), 0.01);

  return (
    <div>
      <ul className="flex flex-col gap-2">
        {sorted.map((m) => (
          <li key={m.key} className="grid grid-cols-[7.5rem_1fr_3.5rem] items-center gap-2 text-xs">
            <span className="truncate text-ink-muted" title={m.label}>
              {m.label}
            </span>
            <div className="relative h-3 bg-paper">
              <span className="absolute inset-y-0 left-1/2 w-px bg-hairline-strong" />
              <span
                className={`absolute inset-y-0 ${m.pct >= 0 ? 'left-1/2 bg-clear' : 'right-1/2 bg-stop'}`}
                style={{ width: `${(Math.abs(m.pct) / max) * 50}%` }}
              />
            </div>
            <PulseDelta change={m.pct} text={`${Math.abs(m.pct).toFixed(1)}%`} className="text-right text-xs" />
          </li>
        ))}
      </ul>
      {note && <p className="mt-3 text-[11px] text-ink-faint">{note}</p>}
    </div>
  );
}

export function PulseCurrencyMovers({ rows }: { rows: CurrencyRow[] }) {
  return (
    <PulseMoverBars
      movers={rows.flatMap((r) => (r.change30dPct === null ? [] : [{ key: r.quote, label: CURRENCY_NAMES[r.quote] ?? r.quote, pct: r.change30dPct }]))}
      note="Right (green): the dollar buys more of that currency than 30 days ago. Left (red): it buys less."
    />
  );
}
