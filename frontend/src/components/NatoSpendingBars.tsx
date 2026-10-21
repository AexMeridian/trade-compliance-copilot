import { COUNTRY_LABELS } from '../lib/pulseCountries';
import type { NatoDefenseCountry } from '../lib/api';

const GUIDELINE = 2;

// NATO members' defense spending as a share of GDP, one bar each on a shared scale, with the alliance's 2% guideline drawn as a line so
// "above or below" is read from the picture, not from colour alone: each row also says "meets 2%" or "below 2%".
export function NatoSpendingBars({ countries, onSelect, active }: { countries: Record<string, NatoDefenseCountry>; onSelect?: (code: string) => void; active?: string | null }) {
  const rows = Object.entries(countries)
    .map(([code, d]) => ({ code, latest: d.points[d.points.length - 1] }))
    .filter((r) => r.latest)
    .sort((a, b) => b.latest[1] - a.latest[1]);
  if (rows.length === 0) return null;
  const max = Math.max(GUIDELINE * 1.25, ...rows.map((r) => r.latest[1]));
  const pct = (v: number) => `${((v / max) * 100).toFixed(1)}%`;
  return (
    <div>
      <p className="mb-2 text-xs text-ink-muted">
        <span aria-hidden="true" className="mr-1.5 inline-block h-3 w-px translate-y-0.5 bg-ink" />
        The line marks NATO's 2% of GDP guideline.
      </p>
      <ol className="flex flex-col">
        {rows.map(({ code, latest }) => {
          const meets = latest[1] >= GUIDELINE;
          return (
            <li key={code} className={`flex items-center gap-2 py-[3px] text-[13px] ${active === code ? 'font-semibold' : ''}`}>
              <button type="button" onClick={() => onSelect?.(code)} className="w-28 shrink-0 truncate text-left text-ink hover:underline sm:w-36" title={COUNTRY_LABELS[code] ?? code}>
                {COUNTRY_LABELS[code] ?? code}
              </button>
              <span className="relative h-3 min-w-0 flex-1 rounded-sm bg-hairline" aria-hidden="true">
                <span className={`absolute inset-y-0 left-0 rounded-sm ${meets ? 'bg-hard' : 'bg-ink-faint'}`} style={{ width: pct(latest[1]) }} />
                <span className="absolute -inset-y-0.5 w-px bg-ink" style={{ left: pct(GUIDELINE) }} />
              </span>
              <span className="w-32 shrink-0 text-right tabular-nums text-ink">
                {latest[1].toFixed(2)}% <span className="text-xs text-ink-muted">{meets ? 'meets 2%' : 'below 2%'}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
