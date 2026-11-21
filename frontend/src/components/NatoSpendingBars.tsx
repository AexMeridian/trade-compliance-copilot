import { COUNTRY_LABELS } from '../lib/pulseCountries';
import type { NatoDefenseCountry } from '../lib/api';

const GUIDELINE = 2;
const name = (code: string) => (code === 'US' ? 'United States' : COUNTRY_LABELS[code] ?? code);
const HAGUE_CORE = 3.5;
/** NATO has 32 members; the stored table holds only some of them. */
export const NATO_MEMBER_COUNT = 32;
/** Allies in NATO's own defence-expenditure table: Iceland has no armed forces and is left out of it. */
export const NATO_TABLE_COUNT = 31;

/** Each country's newest stored figure with its year, highest first. A country is shown at its own latest year, so the year is always printed beside the bar. */
export function natoLatestRows(countries: Record<string, NatoDefenseCountry>) {
  return Object.entries(countries)
    .map(([code, d]) => ({ code, latest: d.points[d.points.length - 1] }))
    .filter((r): r is { code: string; latest: [string, number] } => Boolean(r.latest))
    .map((r) => ({ code: r.code, year: r.latest[0].slice(0, 4), value: r.latest[1] }))
    .sort((a, b) => b.value - a.value);
}

// Defense spending as a share of GDP for the NATO allies stored here (NOT all 32: the panel says how many), one bar each on a shared scale,
// with the 2% guideline and the 3.5% core target agreed at The Hague in 2025 drawn as lines. Every row prints its own year because a
// country can be one year behind the others.
export function NatoSpendingBars({ countries, onSelect, active }: { countries: Record<string, NatoDefenseCountry>; onSelect?: (code: string) => void; active?: string | null }) {
  const rows = natoLatestRows(countries);
  if (rows.length === 0) return null;
  const years = [...new Set(rows.map((r) => r.year))].sort();
  const max = Math.max(HAGUE_CORE * 1.1, ...rows.map((r) => r.value));
  const pct = (v: number) => `${((v / max) * 100).toFixed(1)}%`;
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-ink">
        {rows.length} of {NATO_MEMBER_COUNT} NATO allies shown
        {rows.length >= NATO_TABLE_COUNT ? ' (Iceland has no armed forces and is not in NATO’s table).' : '. The rest are not stored here, so this chart does not show the alliance as a whole.'}
      </p>
      <p className="mb-2 text-xs text-ink-muted">
        <span aria-hidden="true" className="mr-1.5 inline-block h-3 w-px translate-y-0.5 bg-ink" />
        Lines mark the 2% of GDP guideline and the 3.5% core-defense target for 2035 (with a further 1.5% for related spending). Years shown: {years.join(', ')}.
      </p>
      <ol className="flex flex-col">
        {rows.map(({ code, value, year }) => (
          <li key={code} className={`flex items-center gap-2 py-[3px] text-[13px] ${active === code ? 'font-semibold' : ''}`}>
            <button type="button" onClick={() => onSelect?.(code)} className="w-28 shrink-0 truncate text-left text-ink hover:underline sm:w-36" title={name(code)}>
              {name(code)}
            </button>
            <span className="relative h-3 min-w-0 flex-1 rounded-sm bg-hairline" aria-hidden="true">
              <span className={`absolute inset-y-0 left-0 rounded-sm ${value >= GUIDELINE ? 'bg-hard' : 'bg-ink-faint'}`} style={{ width: pct(value) }} />
              <span className="absolute -inset-y-0.5 w-px bg-ink" style={{ left: pct(GUIDELINE) }} />
              <span className="absolute -inset-y-0.5 w-px bg-ink" style={{ left: pct(HAGUE_CORE) }} />
            </span>
            <span className="w-32 shrink-0 text-right tabular-nums text-ink">
              {value.toFixed(2)}% <span className="text-xs text-ink-muted">{year}{Number(year) >= 2024 ? 'e' : ''}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
