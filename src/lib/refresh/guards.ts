// A refresh that loads far fewer rows than last time almost always means the upstream file changed shape or came back truncated, not that most of
// the list was removed. Replacing the live table with it would silently weaken screening or rate lookups, so the job stops before the write and
// the failure reaches the owner through the health check. The size is remembered after each successful load (see changeGate.ts).
import type { Env } from '../../types/env.js';

/** Fewer than this share of the previous size aborts the load. A real list rarely moves more than a few percent in a week. */
export const MIN_SIZE_RATIO = 0.8;

export function shrinkError(source: string, previous: number | null, current: number, minRatio = MIN_SIZE_RATIO): string | null {
  if (previous === null || previous <= 0) return null; // nothing to compare with (first load)
  if (current >= previous * minRatio) return null;
  return `${source} refresh would load ${current} rows against ${previous} last time (under ${Math.round(minRatio * 100)}%) -- aborting without touching the live table; the upstream file may have changed format`;
}

export async function storedSize(env: Env, source: string): Promise<number | null> {
  const row = await env.DB.prepare('SELECT last_note FROM pulse_feed_state WHERE source_key = ?1').bind(`size:${source}`).first<{ last_note: string | null }>();
  const n = Number(row?.last_note);
  return row && Number.isFinite(n) ? n : null;
}

export async function assertNotShrunk(env: Env, source: string, current: number): Promise<void> {
  const message = shrinkError(source, await storedSize(env, source), current);
  if (message) throw new Error(message);
}
