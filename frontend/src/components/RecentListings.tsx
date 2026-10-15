import { useEffect, useState } from 'react';
import { getRecentListings, type RecentListings as Data } from '../lib/api';
import { COUNTRY_LABELS } from '../lib/pulseCountries';
import { ChartFooter } from './ChartFooter';

// Parties added to the UN, UK and U.S. (BIS/State) lists in the last 30 days, by each list's own listing date.
export function RecentListings() {
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    getRecentListings(30).then(setData).catch(() => setFailed(true));
  }, []);
  if (failed) return <p className="text-sm text-ink-faint">Not available right now.</p>;
  if (!data) return <p className="text-sm text-ink-faint">Loading…</p>;
  if (data.items.length === 0) return <p className="text-sm text-ink-muted">No new listings with a named country in the last {data.days} days.</p>;
  return (
    <div>
      <ul className="divide-y divide-hairline">
        {data.items.map((e) => (
          <li key={e.id} className="py-2 text-sm">
            <p className="text-ink">
              {e.url ? (
                <a href={e.url} target="_blank" rel="noreferrer" className="hover:underline">
                  {e.title}
                </a>
              ) : (
                e.title
              )}
            </p>
            <p className="mt-0.5 text-xs text-ink-faint">
              {e.date}
              {e.source ? ` · ${e.source}` : ''}
              {e.countries.length > 0 ? ` · ${e.countries.map((c) => COUNTRY_LABELS[c] ?? c).join(', ')}` : ''}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-ink-faint">
        Showing {data.items.length} of {data.total}. The OFAC SDN file does not carry listing dates, so U.S. Treasury additions are not shown here; see OFAC's
        recent actions.
      </p>
      <ChartFooter source="UN Security Council, UK OFSI and U.S. Consolidated Screening List" asOf={new Date().toISOString().slice(0, 10)} />
    </div>
  );
}
