// Refresh-on-request for the market/news sources. Cloudflare Free caps an
// account at 5 cron triggers and all 5 are in use (see src/scheduled.ts), and
// a once-daily cron would leave ECB rates a day stale anyway -- so a request
// that finds a source past its TTL triggers a background refresh instead.
//
// The claim is one atomic upsert (same compare-and-swap shape as POST /sync in
// routes/pulse.ts): "claim the right to refresh" and "check the TTL" are the
// same statement, so concurrent page loads can't all trigger a fetch.
import type { Env } from '../../types/env.js';
import { logRefresh } from '../refresh/log.js';

const FAILURE_RETRY_MS = 5 * 60_000;

export async function refreshIfStale(
  env: Env,
  key: string,
  ttlMs: number,
  run: () => Promise<{ rows: number; note?: string }>
): Promise<void> {
  const now = Date.now();
  const startedAt = new Date(now).toISOString();
  const claim = await env.DB.prepare(
    `INSERT INTO pulse_feed_state (source_key, last_attempt_at) VALUES (?1, ?2)
     ON CONFLICT(source_key) DO UPDATE SET last_attempt_at = excluded.last_attempt_at
     WHERE pulse_feed_state.last_attempt_at IS NULL OR pulse_feed_state.last_attempt_at < ?3`
  )
    .bind(key, startedAt, new Date(now - ttlMs).toISOString())
    .run();
  if (claim.meta.changes === 0) return;

  try {
    const result = await run();
    await env.DB.prepare('UPDATE pulse_feed_state SET last_success_at = ?2, last_note = ?3 WHERE source_key = ?1')
      .bind(key, new Date().toISOString(), result.note ?? null)
      .run();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Backdate the attempt so a transient failure retries in minutes, not a
    // full TTL later (6h for FRED would leave the panel stale all day).
    await env.DB.prepare('UPDATE pulse_feed_state SET last_attempt_at = ?2, last_note = ?3 WHERE source_key = ?1')
      .bind(key, new Date(now - ttlMs + FAILURE_RETRY_MS).toISOString(), `Last refresh failed: ${message}`)
      .run();
    await logRefresh(env, `pulse_${key}`, 'error', null, message, startedAt);
  }
}
