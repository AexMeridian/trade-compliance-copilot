import { useEffect, useState } from 'react';
import { getSanctionCounts, type SanctionCounts } from '../lib/api';
import { COUNTRY_LABELS } from '../lib/pulseCountries';
import { FreshnessNote } from './FreshnessNote';

// The countries named on the most sanctions entries, as bars you can click to filter the table below. The count is a text match on each
// entry's address field, so it says where parties are listed as located, not which governments are targeted.
export function SanctionsLeaders({ selected, onPick }: { selected: string; onPick: (country: string) => void }) {
  const [data, setData] = useState<SanctionCounts | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    getSanctionCounts()
      .then((d) => live && setData(d))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);
  if (failed) return <p className="text-sm text-ink-faint">Couldn't load the country counts right now.</p>;
  if (!data) return <p className="text-sm text-ink-faint">Loading…</p>;
  const rows = data.countries.slice(0, 12);
  const max = rows[0]?.count || 1;
  return (
    <div>
      <p className="mb-2 text-[13px] text-ink-muted">
        {data.total.toLocaleString('en-US')} listings across four lists
        {data.totals ? ` (OFAC SDN ${data.totals.sdn.toLocaleString('en-US')}, Commerce/State ${data.totals.csl.toLocaleString('en-US')}, UN ${data.totals.un.toLocaleString('en-US')}, UK ${data.totals.uk.toLocaleString('en-US')})` : ''}. A party on several lists
        counts once on each. Commerce/State entries are export-control listings, not OFAC sanctions. Hong Kong is counted separately from mainland China. Select a country to filter the table below.
      </p>
      <FreshnessNote sources={data.lists} className="mb-2" />
      <ol>
        {rows.map((r) => {
          const name = COUNTRY_LABELS[r.country] ?? r.country;
          return (
          <li key={r.country}>
            <button
              type="button"
              aria-pressed={selected === name}
              onClick={() => onPick(selected === name ? '' : name)}
              className={`flex w-full items-center gap-2 rounded px-1 py-[3px] text-left text-[13px] hover:bg-hairline/50 ${selected === name ? 'bg-hard-tint font-semibold' : ''}`}
            >
              <span className="w-32 shrink-0 truncate text-ink">{name}</span>
              <span className="h-3 min-w-0 flex-1 rounded-sm bg-hairline" aria-hidden="true">
                <span className="block h-3 rounded-sm bg-hard" style={{ width: `${Math.max(1.5, (r.count / max) * 100)}%` }} />
              </span>
              <span className="w-14 shrink-0 text-right tabular-nums text-ink">{r.count.toLocaleString('en-US')}</span>
              {r.bySource && (
                <span className="hidden w-48 shrink-0 text-right text-[11px] tabular-nums text-ink-faint sm:inline">
                  OFAC {r.bySource.sdn.toLocaleString('en-US')} / Commerce-State {r.bySource.csl.toLocaleString('en-US')} / UN {r.bySource.un.toLocaleString('en-US')} / UK {r.bySource.uk.toLocaleString('en-US')}
                </span>
              )}
            </button>
          </li>
          );
        })}
      </ol>
    </div>
  );
}
