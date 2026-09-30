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
  const line = points.map(([d, v]) => `${x(Date.parse(d)).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  return (
    <div ref={box} className="w-full">
      <svg width={width} height={H} role="img" aria-label="Line chart of the U.S. dollar's share of world foreign-exchange reserves since 1999" className="block">
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
        <polygon points={`${x(tMin)},${y(yMin)} ${line} ${x(tMax)},${y(yMin)}`} fill="var(--color-hue-gray)" opacity="0.12" />
        <polyline points={line} fill="none" stroke="var(--color-hue-gray)" strokeWidth="1.75" strokeLinejoin="round" />
      </svg>
      <p className="mt-1 text-[11px] text-ink-faint">Quarterly, IMF COFER. Actual share of allocated reserves, not indexed.</p>
    </div>
  );
}
