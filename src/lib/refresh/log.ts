import type { Env } from '../../types/env.js';

export async function logRefresh(
  env: Env,
  source: string,
  status: 'success' | 'error',
  rowsAffected: number | null,
  errorMessage: string | null,
  startedAt: string
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO data_refresh_log (source, status, rows_affected, error_message, started_at, finished_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
  )
    .bind(source, status, rowsAffected, errorMessage, startedAt, new Date().toISOString())
    .run();
}
