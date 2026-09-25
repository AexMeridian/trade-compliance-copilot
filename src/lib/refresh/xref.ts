// In-Worker equivalent of scripts/seed-schedule-b-xref.ts. That script derives
// pairs by re-parsing the generated hts/*.sql and schedule_b/*.sql files back
// off disk -- appropriate for an offline, pre-D1-load generation pass, but
// there's no disk here and no need for the indirection: hts_lines and
// schedule_b_lines already live in D1, so this is just a join on HS-6 (the
// internationally-harmonized first 6 digits, identical between the two
// schedules) done directly in SQL. Same rule as the original: only fully-
// specified 10-digit HTS statistical lines are paired.
import type { Env } from '../../types/env.js';
import type { RefreshResult } from './types.js';

export async function refreshXref(env: Env): Promise<RefreshResult> {
  const result = await env.DB.batch([
    env.DB.prepare('DELETE FROM hts_schedule_b_xref'),
    env.DB.prepare(
      `INSERT INTO hts_schedule_b_xref (hts_htsno, schedule_b_code, hs6)
       SELECT h.htsno, s.code, s.hs6
       FROM hts_lines h
       JOIN schedule_b_lines s ON s.hs6 = substr(replace(h.htsno, '.', ''), 1, 6)
       WHERE length(replace(h.htsno, '.', '')) = 10`
    ),
  ]);

  const rows = result[1]?.meta?.changes ?? 0;
  if (rows === 0) {
    throw new Error('Cross-reference rebuild produced zero rows -- hts_lines/schedule_b_lines may be empty or stale');
  }

  return { source: 'xref', rows };
}
