import { BLOC_FULL_NAMES, BLOC_LABELS, BLOC_MEMBERS, BLOC_NON_COUNTRY_MEMBERS, BLOC_SOURCES, BLOCS_AS_OF, BRICS_PARTNERS, PARTNER_COUNTRIES, type Bloc } from '../lib/pulseBlocs';
import { COUNTRY_LABELS } from '../lib/pulseCountries';
import { BLOC_HUE } from '../lib/pulseColors';
import { useState } from 'react';
import { ConnectionsPanel } from './ConnectionsPanel';

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
  const [open, setOpen] = useState<Bloc | null>(null);
  // The connections endpoint takes up to 12 countries; for a larger bloc use
  // the members with the most U.S. activity this month, and say so.
  const groupFor = (bloc: Bloc) => [...BLOC_MEMBERS[bloc]].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0)).slice(0, 12);
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
                <span className="font-semibold text-ink">{total}</span> U.S. {total === 1 ? 'notice' : 'notices'} in the last 30 days named a member of this
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
                          active ? 'border-ink bg-ink text-paper' : 'border-hairline-strong bg-paper-raised text-ink-muted hover:border-ink hover:text-ink'
                        }`}
                      >
                        {COUNTRY_LABELS[c] ?? c}
                        {n > 0 && <span className="ml-1 tabular-nums">{n}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {BLOC_NON_COUNTRY_MEMBERS[bloc] && (
                <p className="mt-2 text-xs text-ink-faint">Also a member, not a country: {BLOC_NON_COUNTRY_MEMBERS[bloc]!.join(', ')}.</p>
              )}
              <p className="mt-2 text-xs text-ink-faint">
                {members.length} countries{bloc === 'BRICS' ? ' (as listed by the BRICS presidency)' : ''}. Source:{' '}
                <a href={BLOC_SOURCES[bloc].url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                  {BLOC_SOURCES[bloc].label}
                </a>
                , checked {BLOCS_AS_OF}.
              </p>
              <button
                type="button"
                onClick={() => setOpen(open === bloc ? null : bloc)}
                aria-expanded={open === bloc}
                className="mt-3 text-sm font-medium text-accent hover:underline"
              >
                {open === bloc ? 'Hide what connects them' : 'What connects them'}
              </button>
            </div>
          );
        })}
      </div>
      {open && (
        <div className={`card border-t-4 p-4 ${BLOC_HUE[open].border}`}>
          <h3 className="font-display text-base font-bold text-ink">{BLOC_LABELS[open]}: policy, sanctions, trade and news together</h3>
          <p className="mb-3 mt-0.5 text-xs text-ink-faint">
            One timeline across {groupFor(open).length === BLOC_MEMBERS[open].length ? 'every member' : `the ${groupFor(open).length} members with the most U.S. activity`}, last
            60 days. Each item names at least one member country.
          </p>
          <ConnectionsPanel code={groupFor(open)[0]} name={BLOC_LABELS[open]} group={groupFor(open)} />
        </div>
      )}
      <div className="card p-4">
        <h3 className="font-display text-base font-bold text-ink">BRICS partner countries</h3>
        <p className="mt-0.5 text-xs text-ink-faint">
          A category created in 2024: partners take part in selected BRICS activities but are not members. Shown separately from the BRICS card above on
          purpose.
        </p>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {BRICS_PARTNERS.map((c) => {
            const n = counts.get(c) ?? 0;
            const active = activeCountry === c;
            return (
              <li key={c}>
                <button
                  type="button"
                  onClick={() => onSelect(c)}
                  aria-pressed={active}
                  className={`border px-2 py-1 text-[12px] font-semibold ${
                    active ? 'border-ink bg-ink text-paper' : 'border-hairline-strong bg-paper-raised text-ink-muted hover:border-ink hover:text-ink'
                  }`}
                >
                  {COUNTRY_LABELS[c] ?? c}
                  {n > 0 && <span className="ml-1 tabular-nums">{n}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="card p-4">
        <h3 className="font-display text-base font-bold text-ink">NATO partners</h3>
        <p className="mt-0.5 text-xs text-ink-faint">
          A real, named NATO relationship ("partners across the globe") -- but not membership, and not the Article 5 mutual-defense commitment NATO members
          have. Shown separately from the NATO card above on purpose.
        </p>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {PARTNER_COUNTRIES.map((c) => {
            const n = counts.get(c) ?? 0;
            const active = activeCountry === c;
            return (
              <li key={c}>
                <button
                  type="button"
                  onClick={() => onSelect(c)}
                  aria-pressed={active}
                  className={`border px-2 py-1 text-[12px] font-semibold ${
                    active ? 'border-ink bg-ink text-paper' : 'border-hairline-strong bg-paper-raised text-ink-muted hover:border-ink hover:text-ink'
                  }`}
                >
                  {COUNTRY_LABELS[c] ?? c}
                  {n > 0 && <span className="ml-1 tabular-nums">{n}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="text-xs leading-relaxed text-ink-faint">
        Membership is public and factual (see the Guide tab for sources); it is not a measure of alignment or sentiment. A country can belong to more than one
        group above. Countries not shown in any card here simply aren't a member of a bloc tracked on this page.
      </p>
    </div>
  );
}
