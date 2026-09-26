import { COUNTRY_LABELS } from '../lib/pulseCountries';

// Same horizontal bar-list idiom as PulseAgencyBreakdown, one dimension
// over -- but clickable, since "show me everything about this country"
// is a first-class filter on the feed below (activeCountry in Pulse.tsx),
// not just a read-only stat. Best-effort/text-derived, not authoritative
// jurisdiction data -- see lib/pulseCountries.ts and lib/pulse/country.ts.
export function PulseCountryBreakdown({
  breakdown,
  activeCountry,
  onSelect,
}: {
  breakdown: { country: string; count: number }[];
  activeCountry: string | null;
  onSelect: (country: string | null) => void;
}) {
  if (breakdown.length === 0) {
    return <p className="text-sm text-ink-faint">No countries named in the last 30 days.</p>;
  }
  const max = Math.max(...breakdown.map((b) => b.count), 1);

  return (
    <ul className="flex flex-col gap-2">
      {breakdown.map((b) => {
        const active = activeCountry === b.country;
        return (
          <li key={b.country}>
            <button
              type="button"
              onClick={() => onSelect(active ? null : b.country)}
              aria-pressed={active}
              className={`flex w-full items-center gap-2 text-left ${active ? 'text-accent' : ''}`}
            >
              <span className={`w-24 shrink-0 truncate text-xs ${active ? 'text-accent' : 'text-ink-muted'}`}>{COUNTRY_LABELS[b.country] ?? b.country}</span>
              <span className="h-3 flex-1 bg-hairline">
                <span className={`block h-full ${active ? 'bg-hue-indigo' : 'bg-hue-cyan'}`} style={{ width: `${Math.max((b.count / max) * 100, 4)}%` }} />
              </span>
              <span className="w-8 shrink-0 text-right tabular-nums text-xs text-ink">{b.count}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
