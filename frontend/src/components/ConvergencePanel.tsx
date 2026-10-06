import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPulseConvergence } from '../lib/api';
import { COUNTRY_LABELS } from '../lib/pulseCountries';
import { KIND_LABEL, TopicPill } from './ConnectionsPanel';
import type { ConnectionKind, ConvergenceRow } from '../types/pulse';

const KIND_PLURAL: Record<ConnectionKind, [string, string]> = {
  action: ['U.S. action', 'U.S. actions'],
  news: ['news story', 'news stories'],
  gta: ['trade barrier', 'trade barriers'],
  wro: ['forced-labor order', 'forced-labor orders'],
  sanction: ['sanctions or export listing', 'sanctions or export listings'],
};

function counts(row: ConvergenceRow): string {
  return (Object.entries(row.kinds) as [ConnectionKind, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${n} ${KIND_PLURAL[k][n === 1 ? 0 : 1]}`)
    .join(' · ');
}

// Where activity from several different directions lands on the same
// country at once. Counts only, ranked by how many kinds of source name the
// country -- deliberately not a risk score. Each row opens that country's
// full timeline.
export function ConvergencePanel({ limit = 6, days = 60 }: { limit?: number; days?: number }) {
  const [rows, setRows] = useState<ConvergenceRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    getPulseConvergence({ days, limit })
      .then((r) => live && setRows(r.rows))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [days, limit]);

  if (failed) return <p className="text-sm text-ink-faint">Couldn't load this right now.</p>;
  if (!rows) return <p className="text-sm text-ink-faint">Loading…</p>;
  if (rows.length === 0) return <p className="text-sm text-ink-faint">No country is named by two or more kinds of source in the last {days} days.</p>;

  return (
    <ol className="divide-y divide-hairline">
      {rows.map((r) => (
        <li key={r.country} className="py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <Link to={`/country/${r.country.toLowerCase()}`} className="font-display text-lg font-bold text-ink no-underline hover:text-accent">
              {COUNTRY_LABELS[r.country] ?? r.country}
            </Link>
            <span className="text-xs text-ink-faint">
              {r.sourceCount} kinds of source, {r.total} items
            </span>
          </div>
          <p className="mt-0.5 text-[13px] text-ink-muted">{counts(r)}</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {r.topics.slice(0, 4).map((t) => (
              <TopicPill key={t.topic}>{`${t.topic} ${t.count}`}</TopicPill>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-ink-faint">
            Latest ({KIND_LABEL[r.latest.kind].toLowerCase()}, {r.latest.date}):{' '}
            {r.latest.url ? (
              <a href={r.latest.url} target="_blank" rel="noreferrer" className="text-ink-muted no-underline hover:text-accent">
                {r.latest.title}
              </a>
            ) : (
              r.latest.title
            )}
          </p>
        </li>
      ))}
    </ol>
  );
}
