// A small line for a series over time: no axes, because the number beside it carries the value. `fill` adds a faint area under the line
// and a dot on the latest point so a reader sees where the series ends.
export function Sparkline({
  points,
  color,
  width = 80,
  height = 24,
  fill = false,
}: {
  points: [number, number][];
  color: string;
  width?: number;
  height?: number;
  fill?: boolean;
}) {
  if (points.length < 2) return null;
  const pad = 3;
  const ys = points.map((p) => p[1]);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const x0 = points[0][0];
  const xSpan = points[points.length - 1][0] - x0 || 1;
  const xy = points.map(([x, y]) => [pad + ((x - x0) / xSpan) * (width - pad * 2), height - pad - ((y - lo) / (hi - lo || 1)) * (height - pad * 2)] as const);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const last = xy[xy.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="shrink-0">
      {fill && <path d={`${d} L${last[0].toFixed(1)} ${height} L${xy[0][0].toFixed(1)} ${height} Z`} fill={color} opacity="0.12" />}
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      {fill && <circle cx={last[0]} cy={last[1]} r="2.4" fill={color} />}
    </svg>
  );
}
