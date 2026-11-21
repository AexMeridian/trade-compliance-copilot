import { useEffect, useState } from 'react';
import { getDataStatus, getDataStats, type DataStatus, type DataStats } from '../lib/api';
import type { ScreeningResult } from '../types/case';

const LISTS: { key: string; stat: string; label: string }[] = [
  { key: 'sdn', stat: 'sdnEntries', label: 'OFAC SDN' },
  { key: 'csl', stat: 'cslEntries', label: 'Commerce/State Consolidated Screening List' },
  { key: 'un_sanctions', stat: 'unEntries', label: 'UN Security Council list' },
  { key: 'uk_sanctions', stat: 'ukEntries', label: 'UK Sanctions List' },
];

// A list older than this is shown as stale. Matches the server rule in src/lib/listFreshness.ts.
const MAX_AGE_DAYS = 9;

type Chip = { key: string; label: string; state: 'ok' | 'stale' | 'not_loaded' | 'unknown'; text: string };

function ageDays(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(iso.slice(0, 10))) / 86_400_000));
}

function chipsFromStatus(status: DataStatus, stats: DataStats | null): Chip[] {
  return LISTS.map((l) => {
    const src = status.sources.find((x) => x.source === l.key);
    const rows = stats?.counts?.[l.stat];
    if (rows === 0) return { key: l.key, label: l.label, state: 'not_loaded', text: 'NOT LOADED (no rows, nothing was checked against it)' };
    if (!src?.lastSuccess) {
      // Rows can exist from the original seed even though no refresh has ever succeeded: the copy's date is unknown, which is itself a stale state.
      return { key: l.key, label: l.label, state: 'stale', text: `STALE: no successful refresh on record${src?.lastError ? ` (${src.lastError})` : ''}` };
    }
    const d = ageDays(src.lastSuccess);
    if (d > MAX_AGE_DAYS || src.lastError) {
      return { key: l.key, label: l.label, state: 'stale', text: `STALE: last loaded ${src.lastSuccess.slice(0, 10)}, ${d} days ago${src.lastError ? ` (latest refresh failed: ${src.lastError})` : ''}` };
    }
    return { key: l.key, label: l.label, state: 'ok', text: `loaded ${src.lastSuccess.slice(0, 10)}, ${d} day${d === 1 ? '' : 's'} old` };
  });
}

function chipsFromCase(f: NonNullable<ScreeningResult['list_freshness']>): Chip[] {
  return f.map((l) => ({
    key: l.source,
    label: l.label,
    state: l.state,
    text:
      l.state === 'not_loaded'
        ? 'NOT LOADED (no rows, nothing was checked against it)'
        : l.state === 'stale'
          ? `STALE: last loaded ${l.as_of ?? 'on an unknown date'}${l.age_days !== null ? `, ${l.age_days} days ago` : ''}${l.last_error ? ` (latest refresh failed: ${l.last_error})` : ''}`
          : `loaded ${l.as_of ?? 'date unknown'}${l.age_days !== null ? `, ${l.age_days} day${l.age_days === 1 ? '' : 's'} old` : ''}`,
  }));
}

const TONE: Record<Chip['state'], string> = {
  ok: 'border-line text-ink-soft',
  stale: 'border-stop bg-stop-soft text-stop font-semibold',
  not_loaded: 'border-stop bg-stop-soft text-stop font-semibold',
  unknown: 'border-line text-ink-faint',
};

// Which lists a screening result was checked against and how old each copy is, so no result is ever read as "clear as of today".
// Pass the case's own list_freshness to show the state at screening time; without it the current state is fetched.
export function ListsAsOf({ freshness }: { freshness?: ScreeningResult['list_freshness'] }) {
  const [status, setStatus] = useState<DataStatus | null>(null);
  const [stats, setStats] = useState<DataStats | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (freshness && freshness.length > 0) return;
    getDataStatus().then(setStatus).catch(() => setFailed(true));
    getDataStats().then(setStats).catch(() => undefined);
  }, [freshness]);

  const chips: Chip[] | null = freshness && freshness.length > 0 ? chipsFromCase(freshness) : status ? chipsFromStatus(status, stats) : null;
  const bad = chips?.filter((c) => c.state === 'stale' || c.state === 'not_loaded') ?? [];

  return (
    <div className="text-xs text-ink-faint">
      <p className="mb-1">Checked against these copies of the sanctions lists:</p>
      {chips ? (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Age of each sanctions list">
          {chips.map((c) => (
            <li key={c.key} className={`rounded border px-2 py-0.5 ${TONE[c.state]}`}>
              {c.label}: {c.text}
            </li>
          ))}
        </ul>
      ) : (
        <p className={`mb-2 rounded border px-2 py-0.5 ${failed ? TONE.stale : TONE.unknown}`}>
          {failed ? 'STALE or unknown: could not read the list dates. Treat every list as out of date.' : 'Checking list dates…'}
        </p>
      )}
      {bad.length > 0 && (
        <p className="mb-2 font-semibold text-stop" role="alert">
          One or more lists are stale or not loaded. A result of "No matches" only means no match in these copies: check the official lists before relying on it.
        </p>
      )}
      <p>
        These copies are meant to refresh weekly; the official lists change daily. This is a name match, not a clearance. For any real decision use the official{' '}
        <a href="https://sanctionssearch.ofac.treas.gov/" target="_blank" rel="noreferrer" className="text-accent underline">
          OFAC Sanctions List Search
        </a>
        .
      </p>
    </div>
  );
}
