import type { Env } from '../../types/env.js';

// Small derived answers (a monthly count of every policy notice, one country's monthly counts) that otherwise scan thousands of
// rows each time the edge cache misses. The answer is kept in one pulse_feed_state row for a while, so a miss reads one row
// instead. A stale answer is acceptable for these slow, monthly-grain charts; a failed read or write falls back to computing.
export async function cachedAggregate<T>(env: Env, key: string, ttlMs: number, compute: () => Promise<T>): Promise<T> {
  const sourceKey = `agg:${key}`;
  const row = await env.DB.prepare('SELECT last_success_at, last_note FROM pulse_feed_state WHERE source_key = ?1')
    .bind(sourceKey)
    .first<{ last_success_at: string | null; last_note: string | null }>()
    .catch(() => null);
  if (row?.last_success_at && row.last_note && Date.now() - Date.parse(row.last_success_at) < ttlMs) {
    try {
      return JSON.parse(row.last_note) as T;
    } catch {
      /* recompute below */
    }
  }
  const value = await compute();
  await env.DB.prepare(
    `INSERT INTO pulse_feed_state (source_key, last_success_at, last_note) VALUES (?1, ?2, ?3)
     ON CONFLICT(source_key) DO UPDATE SET last_success_at = excluded.last_success_at, last_note = excluded.last_note`
  )
    .bind(sourceKey, new Date().toISOString(), JSON.stringify(value))
    .run()
    .catch(() => undefined);
  return value;
}
