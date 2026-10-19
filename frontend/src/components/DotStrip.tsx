import type { PowerIndicator } from '../lib/api';
import { formatShort, formatValue } from '../lib/powerFormat';
import { nameFor, SERIES_COLORS } from '../lib/powerCountries';

// Every country with a figure is one faint dot on a shared axis; the countries being compared are the large colored
// dots. It shows where each one sits in the whole field (a rank alone hides how bunched or spread out the field is),
// which a bar chart of two or three values cannot. Skewed series (money, populations) use a log axis, and the axis
// label says so. The dots are drawn in an SVG with no viewBox so their size stays constant in pixels at any width.
export function DotStrip({ indicator, codes }: { indicator: PowerIndicator; codes: string[] }) {
  const dist = indicator.distribution;
  if (dist.length < 3) return null;
  const min = dist[0][1];
  const max = dist[dist.length - 1][1];
  const log = min > 0 && max / min >= 100;
  const span = log ? Math.log(max) - Math.log(min) : max - min || 1;
  const pos = (v: number) => {
    const t = log ? (Math.log(v) - Math.log(min)) / span : (v - min) / span;
    return `${(1.5 + t * 97).toFixed(2)}%`;
  };

  const picked = codes.flatMap((code, i) => {
    const s = indicator.standings[code];
    return s ? [{ code, i, s }] : [];
  });
  const summary = picked.length
    ? picked.map(({ code, s }) => `${nameFor(code)} ${formatValue(indicator.unit, s.value)}, rank ${s.rank} of ${s.of}`).join('; ')
    : 'none of the selected countries has a figure';

  return (
    <figure className="mt-3">
      <svg
        role="img"
        aria-label={`${indicator.label}: ${dist.length} countries plotted from ${formatValue(indicator.unit, min)} to ${formatValue(indicator.unit, max)}${log ? ' on a log scale' : ''}. ${summary}.`}
        width="100%"
        height="34"
        className="block overflow-visible"
      >
        <line x1="1.5%" x2="98.5%" y1="17" y2="17" stroke="var(--color-hairline-strong)" strokeWidth="1" opacity="0.5" />
        {dist.map(([cc, v]) => (
          <circle key={cc} cx={pos(v)} cy="17" r="2.6" fill="var(--color-hairline-strong)" opacity="0.55" />
        ))}
        {picked.map(({ code, i, s }) => (
          <circle key={code} cx={pos(s.value)} cy="17" r="7" fill={SERIES_COLORS[i]} stroke="var(--color-paper-raised)" strokeWidth="2" />
        ))}
      </svg>
      <figcaption className="mt-1 flex justify-between text-[11px] text-ink-faint">
        <span>{formatShort(indicator.unit, min)}</span>
        <span>
          {dist.length} countries{log ? ', log scale' : ''}
        </span>
        <span>{formatShort(indicator.unit, max)}</span>
      </figcaption>
    </figure>
  );
}
