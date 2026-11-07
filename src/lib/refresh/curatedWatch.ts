// Daily job: compare the Federal Register notices the Pulse sync already stored against how current each hand-verified table is, and
// record an alert for each notice that is newer. Reads two or three small tables and writes only new alerts, so it is free of outside
// requests and model calls. See src/lib/curatedWatch.ts for the matching rules and migrations/0027 for the alert lifecycle.
import type { Env } from '../../types/env.js';
import type { RefreshResult } from './types.js';
import { findNewAlerts, type CuratedProgram, type WatchedAction } from '../curatedWatch.js';
import { FEE_DATA_AS_OF } from '../customsFees.js';

export async function curatedBaselines(env: Env): Promise<Partial<Record<CuratedProgram, string>>> {
  const [overlays, usmca, chart, eccn] = await Promise.all([
    env.DB.prepare(`SELECT substr(program, 1, 6) AS p, MAX(data_as_of) AS d FROM tariff_overlays GROUP BY substr(program, 1, 6)`).all<{ p: string; d: string }>(),
    env.DB.prepare(`SELECT MAX(last_updated) AS d FROM usmca_rules`).first<{ d: string | null }>(),
    env.DB.prepare(`SELECT MAX(last_updated) AS d FROM country_chart`).first<{ d: string | null }>(),
    env.DB.prepare(`SELECT MAX(last_updated) AS d FROM eccn_entries`).first<{ d: string | null }>(),
  ]);
  const byPrefix = new Map(overlays.results.map((r) => [r.p, r.d]));
  const out: Partial<Record<CuratedProgram, string>> = { customs_fees: FEE_DATA_AS_OF };
  if (byPrefix.has('sec232')) out.sec232 = byPrefix.get('sec232');
  if (byPrefix.has('sec301')) out.sec301 = byPrefix.get('sec301');
  if (byPrefix.has('sec338')) out.sec338 = byPrefix.get('sec338');
  if (usmca?.d) out.usmca = usmca.d;
  const exportDates = [chart?.d, eccn?.d].filter((d): d is string => !!d);
  if (exportDates.length > 0) out.export_controls = exportDates.sort()[0];
  return out;
}

export async function refreshCuratedWatch(env: Env): Promise<RefreshResult> {
  const baselines = await curatedBaselines(env);
  const dates = Object.values(baselines).filter((d): d is string => !!d).sort();
  if (dates.length === 0) return { source: 'curated_watch', rows: 0 };
  const since = dates[0];

  const [actions, existing] = await Promise.all([
    env.DB.prepare(
      `SELECT document_number, title, abstract, agency, doc_type, publication_date, effective_on, html_url
       FROM trade_policy_actions WHERE publication_date > ?1 ORDER BY publication_date DESC LIMIT 500`
    )
      .bind(since)
      .all<WatchedAction>(),
    env.DB.prepare(`SELECT document_number, program FROM curated_change_alerts`).all<{ document_number: string; program: string }>(),
  ]);
  const known = new Set(existing.results.map((r) => `${r.document_number}:${r.program}`));
  const fresh = findNewAlerts(actions.results, baselines, known);
  const now = new Date().toISOString();

  const statements = fresh.map((a) =>
    env.DB.prepare(
      `INSERT OR IGNORE INTO curated_change_alerts (document_number, program, title, publication_date, effective_on, html_url, detected_at, status)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending')`
    ).bind(a.document_number, a.program, a.title, a.publication_date, a.effective_on, a.html_url, now)
  );
  // An alert is resolved once its program's data was verified on or after the notice's publication date.
  for (const [program, asOf] of Object.entries(baselines)) {
    statements.push(
      env.DB.prepare(
        `UPDATE curated_change_alerts SET status = 'resolved', resolved_at = ?1 WHERE status = 'pending' AND program = ?2 AND publication_date <= ?3`
      ).bind(now, program, asOf)
    );
  }
  if (statements.length > 0) await env.DB.batch(statements);
  return { source: 'curated_watch', rows: fresh.length };
}

export interface PendingAlert {
  program: CuratedProgram;
  document_number: string;
  title: string;
  publication_date: string;
  html_url: string;
}

export async function getPendingAlerts(env: Env, programs: CuratedProgram[]): Promise<PendingAlert[]> {
  if (programs.length === 0) return [];
  const marks = programs.map((_, i) => `?${i + 1}`).join(', ');
  const { results } = await env.DB.prepare(
    `SELECT program, document_number, title, publication_date, html_url FROM curated_change_alerts
     WHERE status = 'pending' AND program IN (${marks}) ORDER BY publication_date DESC LIMIT 20`
  )
    .bind(...programs)
    .all<PendingAlert>();
  return results;
}
