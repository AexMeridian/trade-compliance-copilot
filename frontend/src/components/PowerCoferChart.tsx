import { useEffect, useRef, useState } from 'react';
import { quarterLabel } from '../lib/powerFormat';

// A dedicated chart for the one series-specific new data point on this page
// (IMF COFER) rather than reusing PulseLineChart: that component rebases
// every series to 100 at its first point for cross-series comparison, which
// would misrepresent a share-of-total figure like this one -- the real story
// here is the actual percentage (57%, down from 71%), not an indexed
// wiggle. This renders the raw values instead.
export function PowerCoferChart({ points, eur = [], cny = [] }: { points: [string, number][]; eur?: [string, number][]; cny?: [string, number][] }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(260, Math.floor(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (points.length < 2) return <p className="text-sm text-ink-faint">Not enough history yet.</p>;

  const H = 200;
  const pad = { l: 34, r: 10, t: 10, b: 22 };
  const xs = points.map(([d]) => Date.parse(d));
  const ys = points.map(([, v]) => v);
  const tMin = xs[0];
  const tMax = xs[xs.length - 1];
  const yMin = Math.floor(Math.min(...ys) / 5) * 5;
  const yMax = Math.ceil(Math.max(...ys) / 5) * 5;
  const x = (t: number) => pad.l + ((t - tMin) / (tMax - tMin || 1)) * (width - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - pad.t - pad.b);
  const yTicks = [yMin, (yMin + yMax) / 2, yMax];
  const yearTicks = [xs[0], xs[Math.floor(xs.length / 2)], xs[xs.length - 1]];
  const at = (clientX: number, left: number) => {
    const t = tMin + ((clientX - left - pad.l) / (width - pad.l - pad.r)) * (tMax - tMin);
    let best = 0;
    for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - t) < Math.abs(xs[best] - t)) best = i;
    setHover(best);
  };
  const quarter = quarterLabel;
  const line = points.map(([d, v]) => `${x(Date.parse(d)).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const lineOf = (pts: [string, number][]) => pts.filter(([d]) => Date.parse(d) >= tMin).map(([d, v]) => `${x(Date.parse(d)).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const valueAt = (pts: [string, number][], d: string) => pts.find((p) => p[0] === d)?.[1];
  const others = [
    { name: 'Euro', pts: eur, color: 'var(--color-hue-orange)' },
    { name: 'Renminbi', pts: cny, color: 'var(--color-hue-pink)' },
  ].filter((o) => o.pts.length > 1);

  return (
    <div ref={box} className="w-full">
      <p className="mb-1 min-h-[1.25rem] text-[13px] text-ink-muted" aria-live="polite">
        {hover !== null ? (
          <>
            <span className="font-semibold text-ink">{quarter(points[hover][0])}:</span> {points[hover][1].toFixed(1)}% of allocated reserves in dollars
            {others.map((o) => {
              const v = valueAt(o.pts, points[hover][0]);
              return v === undefined ? null : `, ${v.toFixed(1)}% ${o.name.toLowerCase()}`;
            })}
          </>
        ) : (
          `Latest: ${quarter(points[points.length - 1][0])}. Move over the chart, or use the arrow keys, to read a quarter.`
        )}
      </p>
      <svg
        width={width}
        height={H}
        role="img"
        tabIndex={0}
        aria-label="Line chart of the U.S. dollar's share of world foreign-exchange reserves since 1999. Use the left and right arrow keys to read each quarter."
        className="block touch-pan-y"
        onPointerMove={(e) => at(e.clientX, e.currentTarget.getBoundingClientRect().left)}
        onPointerLeave={() => setHover(null)}
        onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          e.preventDefault();
          setHover((h) => Math.max(0, Math.min(points.length - 1, (h ?? points.length - 1) + (e.key === 'ArrowRight' ? 1 : -1))));
        }}
      >
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} stroke="var(--color-hairline)" />
            <text x={pad.l - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill="var(--color-ink-faint)">
              {v.toFixed(0)}%
            </text>
          </g>
        ))}
        {yearTicks.map((t, i) => (
          <text
            key={t}
            x={x(t)}
            y={H - 6}
            textAnchor={i === 0 ? 'start' : i === yearTicks.length - 1 ? 'end' : 'middle'}
            fontSize="10"
            fill="var(--color-ink-faint)"
          >
            {new Date(t).getUTCFullYear()}
          </text>
        ))}
        <polygon points={`${x(tMin)},${y(yMin)} ${line} ${x(tMax)},${y(yMin)}`} fill="var(--color-hard)" opacity="0.1" />
        {others.map((o) => (
          <polyline key={o.name} points={lineOf(o.pts)} fill="none" stroke={o.color} strokeWidth="1.5" strokeLinejoin="round" />
        ))}
        <polyline points={line} fill="none" stroke="var(--color-hard)" strokeWidth="1.75" strokeLinejoin="round" />
        {hover !== null && (
          <g>
            <line x1={x(xs[hover])} x2={x(xs[hover])} y1={pad.t} y2={H - pad.b} stroke="var(--color-hairline-strong)" strokeDasharray="3 3" />
            <circle cx={x(xs[hover])} cy={y(ys[hover])} r="4.5" fill="var(--color-hard)" stroke="var(--color-paper-raised)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {others.length > 0 && (
        <p className="mt-1 text-[11px] text-ink-muted">
          Lines: U.S. dollar (dark){others.map((o) => `, ${o.name.toLowerCase()}`).join('')}. The vertical axis does not start at zero.
        </p>
      )}
      <p className="mt-1 text-[11px] text-ink-faint">
        Quarterly, IMF COFER, {quarter(points[points.length - 1][0])} latest. Shares are at current exchange rates, so a weaker dollar lowers the dollar's share even if no central bank sold any:
        part of any move is valuation, not diversification. Not indexed. The axis does not start at zero.
      </p>
    </div>
  );
}
