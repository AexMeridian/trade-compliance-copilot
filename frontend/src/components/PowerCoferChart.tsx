import { useEffect, useRef, useState } from 'react';

// A dedicated chart for the one series-specific new data point on this page
// (IMF COFER) rather than reusing PulseLineChart: that component rebases
// every series to 100 at its first point for cross-series comparison, which
// would misrepresent a share-of-total figure like this one -- the real story
// here is the actual percentage (57%, down from 71%), not an indexed
// wiggle. This renders the raw values instead.
export function PowerCoferChart({ points }: { points: [string, number][] }) {
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
  const quarter = (d: string) => {
    const dt = new Date(Date.parse(d));
    return `Q${Math.floor(dt.getUTCMonth() / 3) + 1} ${dt.getUTCFullYear()}`;
  };
  const line = points.map(([d, v]) => `${x(Date.parse(d)).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  return (
    <div ref={box} className="w-full">
      <p className="mb-1 min-h-[1.25rem] text-[13px] text-ink-muted" aria-live="polite">
        {hover !== null ? (
          <>
            <span className="font-semibold text-ink">{quarter(points[hover][0])}:</span> {points[hover][1].toFixed(1)}% of allocated reserves in dollars
          </>
        ) : (
          'Move over the chart, or use the arrow keys, to read a quarter.'
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
        <polyline points={line} fill="none" stroke="var(--color-hard)" strokeWidth="1.75" strokeLinejoin="round" />
        {hover !== null && (
          <g>
            <line x1={x(xs[hover])} x2={x(xs[hover])} y1={pad.t} y2={H - pad.b} stroke="var(--color-hairline-strong)" strokeDasharray="3 3" />
            <circle cx={x(xs[hover])} cy={y(ys[hover])} r="4.5" fill="var(--color-hard)" stroke="var(--color-paper-raised)" strokeWidth="2" />
          </g>
        )}
      </svg>
      <p className="mt-1 text-[11px] text-ink-faint">Quarterly, IMF COFER. Actual share of allocated reserves, not indexed.</p>
    </div>
  );
}
