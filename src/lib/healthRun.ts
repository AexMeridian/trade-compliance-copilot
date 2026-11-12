// The daily health job: gathers the facts (refresh log, curated data ages, pending notices, schema, model state, built-in accuracy checks),
// turns them into findings with src/lib/health.ts, emails what needs a person, and records what it reported so the same problem is not
// mailed every day. On Mondays it also sends a short digest. No model calls and no outside requests.
import type { Env } from '../types/env.js';
import type { RefreshResult } from './refresh/types.js';
import {
  checkSources, checkCurated, checkSchema, checkModel, checkCanaries, planMail,
  type AlertState, type Finding, type ModelState, type PendingNotice, type SourceRow, type CanaryResult,
} from './health.js';
import { curatedBaselines } from './refresh/curatedWatch.js';
import { runDataCanaries, runLogicCanaries } from './canary.js';
import { sendMail } from './notify.js';
import { estimateUsd, monthStart, monthlyBudgetUsd } from './modelSpend.js';
import { parseReminderDates, upcomingChores } from './calendar.js';

const SUMMARY_KEY = 'health:summary';

async function gather(env: Env, now: Date) {
  const today = now.toISOString().slice(0, 10);
  const [sources, pending, tables, modelStates, states, baselines, canaries] = await Promise.all([
    env.DB.prepare(
      `SELECT source,
              MAX(CASE WHEN status = 'success' THEN finished_at END) AS lastOk,
              SUM(CASE WHEN status = 'error' AND finished_at > COALESCE((SELECT MAX(l2.finished_at) FROM data_refresh_log l2 WHERE l2.source = l.source AND l2.status = 'success'), '') THEN 1 ELSE 0 END) AS errorsSinceOk,
              MAX(CASE WHEN status = 'error' THEN error_message END) AS lastError
       FROM data_refresh_log l GROUP BY source`
    ).all<SourceRow>(),
    env.DB.prepare(`SELECT program, document_number, title, publication_date, html_url FROM curated_change_alerts WHERE status = 'pending' ORDER BY publication_date DESC`)
      .all<PendingNotice>()
      .catch(() => ({ results: [] as PendingNotice[] })),
    env.DB.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all<{ name: string }>(),
    env.DB.prepare(`SELECT key, status, detail, last_seen_at FROM alert_state WHERE key LIKE 'model_%'`).all<ModelState>().catch(() => ({ results: [] as ModelState[] })),
    env.DB.prepare(`SELECT key, status, detail, last_sent_at, recovery_due FROM alert_state`).all<AlertState>().catch(() => ({ results: [] as AlertState[] })),
    curatedBaselines(env).catch(() => ({}) as Record<string, string>),
    runDataCanaries(env).catch((err): CanaryResult[] => [{ name: 'data checks', ok: false, detail: err instanceof Error ? err.message : String(err) }]),
  ]);
  const findings: Finding[] = [
    ...checkSchema(tables.results.map((t) => t.name)),
    ...checkSources(sources.results, now),
    ...checkCurated(baselines as Record<string, string>, pending.results, today),
    ...checkModel(modelStates.results),
    ...checkCanaries([...runLogicCanaries(), ...canaries]),
  ];
  return { findings, states: new Map(states.results.map((s) => [s.key, s])), sources: sources.results, pending: pending.results, today };
}

async function monthSpend(env: Env, now: Date): Promise<{ usd: number; calls: number } | null> {
  try {
    const row = await env.DB.prepare(`SELECT COALESCE(SUM(calls), 0) AS c, COALESCE(SUM(input_tokens), 0) AS i, COALESCE(SUM(output_tokens), 0) AS o FROM model_usage WHERE day >= ?1`)
      .bind(monthStart(now))
      .first<{ c: number; i: number; o: number }>();
    return row ? { usd: estimateUsd(row.i, row.o), calls: row.c } : null;
  } catch {
    return null;
  }
}

function digest(env: Env, now: Date, findings: Finding[], sources: SourceRow[], spend: { usd: number; calls: number } | null, today: string): string {
  const lines: string[] = [];
  const bad = findings.filter((f) => f.severity !== 'warning');
  lines.push(bad.length === 0 ? 'Everything is running. Nothing needs you this week.' : `${bad.length} item${bad.length === 1 ? '' : 's'} need${bad.length === 1 ? 's' : ''} you:`);
  for (const f of bad) lines.push('', `* ${f.title}`, f.detail);
  const warn = findings.filter((f) => f.severity === 'warning');
  if (warn.length > 0) lines.push('', 'Worth a look:', ...warn.map((f) => `- ${f.title}`));
  lines.push('', 'Last successful refresh:', ...sources.map((s) => `- ${s.source}: ${s.lastOk ? s.lastOk.slice(0, 10) : 'never'}`));
  if (spend) lines.push('', `Calculator spend this month: about $${spend.usd.toFixed(2)} over ${spend.calls} model calls (limit $${monthlyBudgetUsd(env.MONTHLY_BUDGET_USD)}).`);
  const chores = upcomingChores(today, 45, parseReminderDates(env.REMINDER_DATES));
  if (chores.length > 0) lines.push('', 'Coming up:', ...chores.map((c) => `- ${c.due}: ${c.text}`));
  lines.push('', 'What to do about each item: docs/OPERATIONS.md, "Keeping the calculator current".');
  return lines.join('\n');
}

export async function runHealth(env: Env, now = new Date()): Promise<RefreshResult> {
  const { findings, states, sources, pending, today } = await gather(env, now);
  const plan = planMail(findings, states, now);
  const nowIso = now.toISOString();

  let sentCount = 0;
  const sent = new Set<string>();
  for (const f of plan.send) {
    const subject = `${f.severity === 'critical' ? 'Needs attention' : 'To review'}: ${f.title}`;
    if ((await sendMail(env, subject, `${f.detail}\n\nSee docs/OPERATIONS.md for what to do.`)) === 'sent') {
      sent.add(f.key);
      sentCount++;
    }
  }
  const statements = findings
    .filter((f) => f.severity !== 'warning')
    .map((f) =>
      env.DB.prepare(
        `INSERT INTO alert_state (key, status, detail, first_seen_at, last_seen_at, last_sent_at, recovery_due) VALUES (?1, 'failing', ?2, ?3, ?3, ?4, ?5)
         ON CONFLICT(key) DO UPDATE SET status = 'failing', detail = ?2, last_seen_at = ?3,
           first_seen_at = CASE WHEN alert_state.status = 'failing' THEN alert_state.first_seen_at ELSE ?3 END,
           last_sent_at = CASE WHEN ?4 IS NOT NULL THEN ?4 ELSE alert_state.last_sent_at END,
           recovery_due = CASE WHEN ?4 IS NOT NULL THEN 1 ELSE alert_state.recovery_due END`
      ).bind(f.key, f.severity === 'action' ? (f.fingerprint ?? '') : f.detail.slice(0, 300), nowIso, sent.has(f.key) ? nowIso : null, sent.has(f.key) ? 1 : 0)
    );
  for (const key of plan.recovered) {
    statements.push(env.DB.prepare(`UPDATE alert_state SET status = 'ok', recovery_due = 0, last_seen_at = ?2 WHERE key = ?1`).bind(key, nowIso));
  }
  const current = new Set(findings.map((f) => f.key));
  statements.push(
    env.DB.prepare(`UPDATE alert_state SET status = 'ok', last_seen_at = ?1 WHERE status = 'failing' AND recovery_due = 0 AND key NOT IN (${[...current].map(() => '?').join(',') || "''"})`).bind(nowIso, ...current)
  );
  const critical = findings.filter((f) => f.severity === 'critical').map((f) => f.key);
  statements.push(
    env.DB.prepare(
      `INSERT INTO pulse_feed_state (source_key, last_attempt_at, last_success_at, last_note) VALUES (?1, ?2, ?2, ?3)
       ON CONFLICT(source_key) DO UPDATE SET last_attempt_at = ?2, last_success_at = ?2, last_note = ?3`
    ).bind(SUMMARY_KEY, nowIso, JSON.stringify({ ok: critical.length === 0, at: nowIso, critical, pendingNotices: pending.length }))
  );
  await env.DB.batch(statements);

  if (plan.recovered.length > 0) {
    await sendMail(env, 'Resolved: ' + plan.recovered.join(', '), `These problems have cleared:\n${plan.recovered.map((k) => `- ${k}`).join('\n')}`);
  }
  if (now.getUTCDay() === 1) {
    await sendMail(env, 'Aex Terminal weekly summary', digest(env, now, findings, sources, await monthSpend(env, now), today));
  }
  return { source: 'health', rows: sentCount };
}

/** The last stored summary, for the public status endpoint. */
export async function readHealthSummary(env: Env): Promise<{ ok: boolean; at: string; critical: string[]; pendingNotices: number } | null> {
  try {
    const row = await env.DB.prepare(`SELECT last_note FROM pulse_feed_state WHERE source_key = ?1`).bind(SUMMARY_KEY).first<{ last_note: string | null }>();
    return row?.last_note ? JSON.parse(row.last_note) : null;
  } catch {
    return null;
  }
}
