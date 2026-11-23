import type { Env } from '../../types/env.js';

/**
 * Writes one data_refresh_log row. Never throws: when the day's D1 write cap is nearly spent this very insert can be the one that
 * fails, and a logging failure must not take the rest of the invocation (or a request) down with it. Returns whether the row was stored.
 * `rowsWritten` is the measured D1 writes for the run (see meter.ts); the column comes from migration 0035, so the insert falls back
 * to the old shape if it is not applied yet.
 */
export async function logRefresh(
  env: Env,
  source: string,
  status: 'success' | 'error',
  rowsAffected: number | null,
  errorMessage: string | null,
  startedAt: string,
  rowsWritten: number | null = null
): Promise<boolean> {
  const finishedAt = new Date().toISOString();
  try {
    await env.DB.prepare(
      `INSERT INTO data_refresh_log (source, status, rows_affected, error_message, started_at, finished_at, rows_written)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
    )
      .bind(source, status, rowsAffected, errorMessage, startedAt, finishedAt, rowsWritten)
      .run();
    return true;
  } catch {
    // Migration 0035 missing, or the write cap is reached: try the plain insert once.
  }
  try {
    await env.DB.prepare(
      `INSERT INTO data_refresh_log (source, status, rows_affected, error_message, started_at, finished_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
    )
      .bind(source, status, rowsAffected, errorMessage, startedAt, finishedAt)
      .run();
    return true;
  } catch (err) {
    console.error(`Could not write the refresh log row for "${source}":`, err instanceof Error ? err.message : String(err));
    return false;
  }
}
