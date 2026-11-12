// Daily job: compare the Federal Register notices the Pulse sync already stored against how current each hand-verified table is, and
// record an alert for each notice that is newer. Reads two or three small tables and writes only new alerts, so it is free of outside
// requests and model calls. See src/lib/curatedWatch.ts for the matching rules and migrations/0027 for the alert lifecycle.
import type { Env } from '../../types/env.js';
import type { RefreshResult } from './types.js';
import { ecfrAlerts, ECFR_PARTS, findNewAlerts, latestAmendment, type CuratedProgram, type NewAlert, type WatchedAction } from '../curatedWatch.js';
import { FEE_DATA_AS_OF } from '../customsFees.js';
import { changeGate, storedFingerprint } from './changeGate.js';

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
  // A change in the Chapter 99 lines is settled once the overlay data was next verified, whichever program it touched.
  const overlayDates = [...byPrefix.values()].sort();
  if (overlayDates.length > 0) out.hts_ch99 = overlayDates[overlayDates.length - 1];
  if (usmca?.d) out.usmca = usmca.d;
  const exportDates = [chart?.d, eccn?.d].filter((d): d is string => !!d);
  if (exportDates.length > 0) {
    out.export_controls = exportDates.sort()[0];
    out.ecfr_ear = out.export_controls;
  }
  out.ecfr_fees = FEE_DATA_AS_OF;
  return out;
}

const CH99_URL = 'https://hts.usitc.gov/reststop/exportList?from=9903&to=9904&format=JSON&styles=false';

/**
 * Chapter 99 of the HTS is where additional duties (Section 232, 301, and the like) are published as tariff lines. The weekly HTS load covers
 * chapters 1-97, so this fetches chapter 99 on its own (one request, about half a megabyte) and compares its fingerprint with the last one.
 * A change becomes a pending alert; the first run only records the starting point. A fetch failure is logged and retried tomorrow.
 */
async function watchChapter99(env: Env): Promise<number> {
  try {
    const res = await fetch(CH99_URL, { headers: { accept: 'application/json', 'user-agent': 'AexTerminal/1.0 (+https://aexterminal.com)' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const lines = (text.match(/"htsno"/g) ?? []).length;
    if (lines < 50) throw new Error(`only ${lines} lines in the response`); // a truncated or error body must not look like a change
    const first = (await storedFingerprint(env, 'ch99')) === null;
    const gate = await changeGate(env, 'ch99', text);
    if (gate.unchanged) return 0;
    let added = 0;
    if (!first) {
      const today = new Date().toISOString().slice(0, 10);
      await env.DB.prepare(
        `INSERT OR IGNORE INTO curated_change_alerts (document_number, program, title, publication_date, effective_on, html_url, detected_at, status)
         VALUES (?1, 'hts_ch99', ?2, ?3, NULL, 'https://hts.usitc.gov/', ?4, 'pending')`
      )
        .bind(`ch99:${today}`, `HTS Chapter 99 changed (${lines} lines now). Check the additional-duty lines for new or changed Section 232, 301 or other duties.`, today, new Date().toISOString())
        .run();
      added = 1;
    }
    await gate.commit(lines);
    return added;
  } catch (err) {
    console.warn('Chapter 99 check failed:', err instanceof Error ? err.message : String(err));
    return 0;
  }
}

/** Amendment dates for the export-control and fee regulations, from the eCFR (5 small requests; a failure on one part is skipped until tomorrow). */
async function watchEcfr(env: Env): Promise<number> {
  const baselines = await curatedBaselines(env);
  const found: Parameters<typeof ecfrAlerts>[0] = [];
  for (const p of ECFR_PARTS) {
    try {
      const res = await fetch(`https://www.ecfr.gov/api/versioner/v1/versions/title-${p.title}.json?part=${p.part}`, { headers: { accept: 'application/json', 'user-agent': 'AexTerminal/1.0 (+https://aexterminal.com)' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const latest = latestAmendment(await res.json());
      if (latest) found.push({ ...p, latest });
    } catch (err) {
      console.warn(`eCFR check failed for ${p.title} CFR ${p.part}:`, err instanceof Error ? err.message : String(err));
    }
  }
  const { results } = await env.DB.prepare(`SELECT document_number, program FROM curated_change_alerts WHERE document_number LIKE 'ecfr:%'`).all<{ document_number: string; program: string }>();
  const fresh: NewAlert[] = ecfrAlerts(found, baselines, new Set(results.map((r) => `${r.document_number}:${r.program}`)));
  if (fresh.length > 0) {
    const now = new Date().toISOString();
    await env.DB.batch(
      fresh.map((a) =>
        env.DB.prepare(
          `INSERT OR IGNORE INTO curated_change_alerts (document_number, program, title, publication_date, effective_on, html_url, detected_at, status)
           VALUES (?1, ?2, ?3, ?4, NULL, ?5, ?6, 'pending')`
        ).bind(a.document_number, a.program, a.title, a.publication_date, a.html_url, now)
      )
    );
  }
  return fresh.length;
}

export async function refreshCuratedWatch(env: Env): Promise<RefreshResult> {
  const ch99Added = await watchChapter99(env);
  const ecfrAdded = await watchEcfr(env).catch((err) => {
    console.warn('eCFR watch failed:', err instanceof Error ? err.message : String(err));
    return 0;
  });
  const result = await watchNotices(env);
  return { source: 'curated_watch', rows: result.rows + ch99Added + ecfrAdded };
}

async function watchNotices(env: Env): Promise<RefreshResult> {
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
