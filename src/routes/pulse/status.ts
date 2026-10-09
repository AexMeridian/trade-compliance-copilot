import { Hono } from 'hono';
import type { Env } from '../../types/env.js';
import type { PulseApp } from './util.js';

// Public facts about the data the site is built on, used by the Methodology page and by the
// uptime monitor. Two read-only endpoints:
//   /data-status  when each source was last refreshed successfully (one small query)
//   /stats        how much of each reference dataset is loaded (counts, so cached for hours)
// Both are edge-cached in src/index.ts. Nothing here is estimated: it is what is in the database.

export interface SourceStatus {
  source: string;
  lastSuccess: string | null;
  lastError: string | null; // latest failure message newer than the last success, if any
}

export const statusRoute: PulseApp = new Hono<{ Bindings: Env }>();

statusRoute.get('/data-status', async (c) => {
  const [ok, failed] = await Promise.all([
    c.env.DB.prepare(
      `SELECT source, MAX(finished_at) AS last_success FROM data_refresh_log WHERE status = 'success' GROUP BY source`
    ).all<{ source: string; last_success: string }>(),
    c.env.DB.prepare(
      `SELECT source, MAX(finished_at) AS last_error, error_message FROM data_refresh_log WHERE status = 'error' GROUP BY source`
    ).all<{ source: string; last_error: string; error_message: string | null }>(),
  ]);
  const lastOk = new Map(ok.results.map((r) => [r.source, r.last_success]));
  const lastErr = new Map(failed.results.map((r) => [r.source, r]));
  const sources = [...new Set([...lastOk.keys(), ...lastErr.keys()])].sort().map((source): SourceStatus => {
    const success = lastOk.get(source) ?? null;
    const err = lastErr.get(source);
    return {
      source,
      lastSuccess: success,
      lastError: err && (!success || err.last_error > success) ? (err.error_message ?? 'Last refresh failed') : null,
    };
  });
  c.header('Cache-Control', 'public, max-age=300');
  return c.json({ asOf: new Date().toISOString(), sources });
});

// Counted once per six hours per data centre; the tables change at most weekly.
const STAT_TABLES: [string, string][] = [
  ['htsLines', 'hts_lines'],
  ['scheduleBLines', 'schedule_b_lines'],
  ['sdnEntries', 'sdn_entries'],
  ['cslEntries', 'csl_entries'],
  ['unEntries', 'un_sanctions_entries'],
  ['ukEntries', 'uk_sanctions_entries'],
  ['eccnEntries', 'eccn_entries'],
  ['usmcaRules', 'usmca_rules'],
  ['countryChartRows', 'country_chart'],
  ['tariffOverlays', 'tariff_overlays'],
  ['wroFindings', 'wro_findings'],
  ['policyNotices', 'trade_policy_actions'],
];

statusRoute.get('/stats', async (c) => {
  const rows = await Promise.all(
    STAT_TABLES.map(async ([key, table]) => {
      const r = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>().catch(() => null);
      return [key, r?.n ?? null] as const;
    })
  );
  c.header('Cache-Control', 'public, max-age=21600');
  return c.json({ asOf: new Date().toISOString(), counts: Object.fromEntries(rows) });
});
