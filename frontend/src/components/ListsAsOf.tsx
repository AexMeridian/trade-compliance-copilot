import { useEffect, useState } from 'react';
import { getDataStatus, type DataStatus } from '../lib/api';

const LISTS: [string, string][] = [
  ['sdn', 'OFAC SDN'],
  ['csl', 'Commerce/State Consolidated Screening List'],
  ['un_sanctions', 'UN Security Council list'],
  ['uk_sanctions', 'UK Sanctions List'],
];

// Which lists a screening result was checked against and when each was last loaded, so no result
// is ever read as "clear as of today". The lists reload weekly and the official ones change daily.
export function ListsAsOf() {
  const [status, setStatus] = useState<DataStatus | null>(null);
  useEffect(() => {
    getDataStatus().then(setStatus).catch(() => undefined);
  }, []);
  const when = (key: string) => {
    const s = status?.sources.find((x) => x.source === key)?.lastSuccess;
    return s ? s.slice(0, 10) : status ? 'date unavailable' : '…';
  };
  return (
    <p className="text-xs text-ink-faint">
      Checked against: {LISTS.map(([k, label], i) => `${label} (loaded ${when(k)})${i < LISTS.length - 1 ? '; ' : ''}`).join('')}. These copies refresh weekly. This is a
      name match, not a clearance. For any real decision use the official{' '}
      <a href="https://sanctionssearch.ofac.treas.gov/" target="_blank" rel="noreferrer" className="text-accent underline">
        OFAC Sanctions List Search
      </a>
      .
    </p>
  );
}
