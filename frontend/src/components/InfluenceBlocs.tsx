import { BLOC_FULL_NAMES, BLOC_LABELS, BLOC_MEMBERS, type Bloc } from '../lib/pulseBlocs';
import { COUNTRY_LABELS } from '../lib/pulseCountries';
import { BLOC_HUE } from '../lib/pulseColors';

const BLOCS: Bloc[] = ['USMCA', 'G7', 'NATO', 'BRICS', 'G20'];

// Real, public membership (lib/pulseBlocs.ts) cross-referenced against this
// month's real country breakdown -- a sum over data the page already has,
// not a new metric. Membership is not sentiment: a low count next to a
// close ally just means nothing named it this month.
export function InfluenceBlocs({
  breakdown,
  activeCountry,
  onSelect,
}: {
  breakdown: { country: string; count: number }[];
  activeCountry: string | null;
  onSelect: (code: string) => void;
}) {
  const counts = new Map(breakdown.map((b) => [b.country, b.count]));
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {BLOCS.map((bloc) => {
          const members = BLOC_MEMBERS[bloc];
          const total = members.reduce((s, c) => s + (counts.get(c) ?? 0), 0);
          const hue = BLOC_HUE[bloc];
          return (
            <div key={bloc} className={`card border-t-4 p-4 ${hue.border}`}>
              <h3 className="font-display text-lg font-bold text-ink">{BLOC_LABELS[bloc]}</h3>
              <p className="mt-0.5 text-xs text-ink-faint">{BLOC_FULL_NAMES[bloc]}</p>
              <p className="mt-2 text-sm text-ink-muted">
                <span className="font-semibold text-ink">{total}</span> U.S. {total === 1 ? 'action' : 'actions'} in the last 30 days named a member of this
                group.
              </p>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {members.map((c) => {
                  const n = counts.get(c) ?? 0;
                  const active = activeCountry === c;
                  return (
                    <li key={c}>
                      <button
                        type="button"
                        onClick={() => onSelect(c)}
                        aria-pressed={active}
                        className={`border px-2 py-1 text-[12px] font-semibold ${
                          active ? 'border-ink bg-ink text-white' : 'border-hairline-strong bg-paper-raised text-ink-muted hover:border-ink hover:text-ink'
                        }`}
                      >
                        {COUNTRY_LABELS[c] ?? c}
                        {n > 0 && <span className="ml-1 tabular-nums opacity-70">{n}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="text-xs leading-relaxed text-ink-faint">
        Membership is public and factual (see the Guide tab for sources); it is not a measure of alignment or sentiment. A country can belong to more than one
        group above. Countries not shown in any card here simply aren't a member of a bloc tracked on this page.
      </p>
    </div>
  );
}
