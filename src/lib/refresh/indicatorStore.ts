import type { Env } from '../../types/env.js';
import type { SeriesByCountry } from '../power/compute.js';
import { USER_AGENT } from './userAgent.js';

export async function getJson(url: string, timeoutMs = 20_000): Promise<unknown> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).hostname}${new URL(url).pathname}`);
  return res.json();
}

export async function getText(url: string, timeoutMs = 30_000): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).hostname}${new URL(url).pathname}`);
  return res.text();
}

/**
 * Writes one indicator_snapshot row per series. The WHERE clause makes an unchanged series a no-op, which D1 does not bill as a
 * written row. Returns how many statements ran.
 */
export async function upsertIndicators(env: Env, series: Map<string, { code: string; data: SeriesByCountry }>): Promise<number> {
  const now = new Date().toISOString();
  const statements = [...series.entries()].map(([id, s]) =>
    env.DB.prepare(
      `INSERT INTO indicator_snapshot (indicator, source_code, fetched_at, data_json) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(indicator) DO UPDATE SET source_code = excluded.source_code, fetched_at = excluded.fetched_at, data_json = excluded.data_json
       WHERE indicator_snapshot.data_json IS NOT excluded.data_json`
    ).bind(id, s.code, now, JSON.stringify(s.data))
  );
  if (statements.length) await env.DB.batch(statements);
  return statements.length;
}
