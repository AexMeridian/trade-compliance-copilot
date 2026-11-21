// How current each sanctions list is, so a screening result can say so instead of reading "No matches" against an old or empty copy.
// The rules are pure (evaluateListFreshness) and the loader reads only cheap things: the refresh log, the newest last_updated date on the
// table (indexed, migration 0024) and whether the table has any row at all. No full counts.
import type { Env } from '../types/env.js';

/** A list older than this is stale. Matches the health check's weekly-plus-slack rule for the four sanctions sources. */
export const LIST_MAX_AGE_DAYS = 9;

export const SANCTION_LISTS: { source: 'sdn' | 'csl' | 'un_sanctions' | 'uk_sanctions'; label: string; table: string }[] = [
  { source: 'sdn', label: 'OFAC SDN', table: 'sdn_entries' },
  { source: 'csl', label: 'Commerce/State Consolidated Screening List', table: 'csl_entries' },
  { source: 'un_sanctions', label: 'UN Security Council list', table: 'un_sanctions_entries' },
  { source: 'uk_sanctions', label: 'UK Sanctions List', table: 'uk_sanctions_entries' },
];

export type ListState = 'ok' | 'stale' | 'not_loaded';

export interface ListFreshness {
  source: string;
  label: string;
  state: ListState;
  /** Date (YYYY-MM-DD) the copy was last loaded or confirmed current; null when unknown or never loaded. */
  as_of: string | null;
  age_days: number | null;
  has_rows: boolean;
  /** Short reason the latest refresh attempt failed, when it did and nothing succeeded since. */
  last_error: string | null;
}

export interface ListFreshnessInput {
  source: string;
  label: string;
  hasRows: boolean;
  lastSuccess: string | null; // ISO date or timestamp
  tableAsOf: string | null; // newest last_updated on the table
  lastError: string | null;
}

function daysBetween(from: string, today: string): number {
  return Math.max(0, Math.floor((Date.parse(today.slice(0, 10)) - Date.parse(from.slice(0, 10))) / 86_400_000));
}

export function evaluateListFreshness(rows: ListFreshnessInput[], today: string, maxAgeDays = LIST_MAX_AGE_DAYS): ListFreshness[] {
  return rows.map((r) => {
    const dates = [r.lastSuccess, r.tableAsOf].filter((d): d is string => !!d).map((d) => d.slice(0, 10));
    const asOf = dates.length ? dates.sort().at(-1)! : null;
    const age = asOf ? daysBetween(asOf, today) : null;
    const state: ListState = !r.hasRows ? 'not_loaded' : age === null || age > maxAgeDays ? 'stale' : 'ok';
    return { source: r.source, label: r.label, state, as_of: r.hasRows ? asOf : null, age_days: r.hasRows ? age : null, has_rows: r.hasRows, last_error: r.lastError };
  });
}

/** One sentence per list that is not current; empty when every list is. */
export function freshnessCaveat(lists: ListFreshness[]): string | null {
  const bad = lists.filter((l) => l.state !== 'ok');
  if (bad.length === 0) return null;
  const parts = bad.map((l) =>
    l.state === 'not_loaded'
      ? `${l.label}: NOT LOADED (no rows, so nothing was checked against it)`
      : `${l.label}: STALE (last loaded ${l.as_of ?? 'on an unknown date'}${l.age_days !== null ? `, ${l.age_days} days ago` : ''}${l.last_error ? `; latest refresh failed: ${l.last_error}` : ''})`
  );
  return `Some lists are not current: ${parts.join('; ')}. "No matches" only means no match in the copies loaded here. Check the official lists before relying on it.`;
}

export async function loadListFreshness(env: Env, today = new Date().toISOString().slice(0, 10)): Promise<ListFreshness[]> {
  const inputs = await Promise.all(
    SANCTION_LISTS.map(async (l): Promise<ListFreshnessInput> => {
      const [ok, err, row, newest] = await Promise.all([
        env.DB.prepare(`SELECT MAX(finished_at) AS d FROM data_refresh_log WHERE source = ?1 AND status = 'success'`).bind(l.source).first<{ d: string | null }>().catch(() => null),
        env.DB.prepare(`SELECT finished_at AS d, error_message AS m FROM data_refresh_log WHERE source = ?1 AND status = 'error' ORDER BY finished_at DESC LIMIT 1`).bind(l.source).first<{ d: string | null; m: string | null }>().catch(() => null),
        env.DB.prepare(`SELECT 1 AS x FROM ${l.table} LIMIT 1`).first<{ x: number }>().catch(() => null),
        env.DB.prepare(`SELECT MAX(last_updated) AS d FROM ${l.table}`).first<{ d: string | null }>().catch(() => null),
      ]);
      const lastSuccess = ok?.d ?? null;
      const failedAfter = err?.d && (!lastSuccess || err.d > lastSuccess);
      return {
        source: l.source,
        label: l.label,
        hasRows: !!row,
        lastSuccess,
        tableAsOf: newest?.d ?? null,
        lastError: failedAfter ? (err?.m ?? 'last refresh failed').replace(/https?:\/\/\S+/g, '[address]').slice(0, 120) : null,
      };
    })
  );
  return evaluateListFreshness(inputs, today);
}
