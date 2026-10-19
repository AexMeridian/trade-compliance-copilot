import type { PowerUnit } from '../lib/api';
import { formatValue } from '../lib/powerFormat';
import { nameFor } from '../lib/powerCountries';

// A plain ranked list of countries on one measure, used by frozen snapshots: the bar length is the value itself.
export function PowerRanking({ rows, unit, year }: { rows: [string, number][]; unit: PowerUnit; year: number | null }) {
  const max = Math.max(...rows.map((r) => r[1]), 1);
  return (
    <div>
      <ol className="flex flex-col">
        {rows.map(([code, value], i) => (
          <li key={code} className="flex items-center gap-3 border-t border-hairline py-1.5 text-sm first:border-t-0">
            <span className="w-6 shrink-0 text-right tabular-nums text-ink-faint">{i + 1}</span>
            <span className="w-36 shrink-0 truncate text-ink sm:w-48">{nameFor(code)}</span>
            <span aria-hidden="true" className="h-2.5 flex-1 bg-paper-sunken">
              <span className="block h-full bg-accent" style={{ width: `${Math.max(2, (value / max) * 100)}%` }} />
            </span>
            <span className="w-32 shrink-0 text-right font-semibold tabular-nums text-ink">{formatValue(unit, value)}</span>
          </li>
        ))}
      </ol>
      {year && <p className="mt-2 text-xs text-ink-faint">Latest value reported for each country, as of {year}.</p>}
    </div>
  );
}
