// What "healthy" means for this site, as plain functions over data already collected, so each rule can be tested without a database or a clock.
// src/lib/healthRun.ts gathers the inputs, calls these, and sends the email. Nothing here calls the model or the network.
import { staleness } from './curatedWatch.js';

/** Every table the migrations create. tests/health.test.ts keeps this equal to what migrations/ actually creates. */
export const EXPECTED_TABLES = [
  'hts_lines', 'schedule_b_lines', 'hts_schedule_b_xref', 'sdn_entries', 'sdn_aliases', 'csl_entries', 'csl_aliases', 'hts_search', 'schedule_b_search',
  'sdn_name_search', 'sdn_alias_search', 'csl_name_search', 'csl_alias_search', 'usmca_rules', 'eccn_entries', 'eccn_search', 'country_chart',
  'country_chart_coverage', 'tariff_overlays', 'cases', 'case_events', 'data_refresh_log', 'trade_policy_actions', 'pulse_sync_state', 'market_series',
  'market_series_meta', 'world_news', 'pulse_feed_state', 'gta_interventions', 'wro_findings', 'un_sanctions_entries', 'un_sanctions_aliases',
  'un_name_search', 'un_alias_search', 'uk_sanctions_entries', 'uk_sanctions_aliases', 'uk_name_search', 'uk_alias_search', 'pulse_snapshots',
  'country_snapshot', 'hts_path_search', 'indicator_snapshot', 'curated_change_alerts', 'model_cache', 'model_usage', 'alert_state',
];

/** The longest a source may go without a successful refresh before it is reported. Weekly jobs get two extra days for a late or skipped run. */
export const SOURCE_MAX_AGE_DAYS: Record<string, number> = {
  sdn: 9, csl: 9, un_sanctions: 9, uk_sanctions: 9, hts: 9, schedule_b: 9, xref: 9, wro_findings: 9, pulse: 3, curated_watch: 3,
};

export type Severity = 'critical' | 'action' | 'warning';

export interface Finding {
  key: string;
  severity: Severity;
  title: string;
  detail: string;
  /** Changes when the situation changes, so an 'action' finding is mailed again only when there is something new. */
  fingerprint?: string;
}

export interface SourceRow {
  source: string;
  lastOk: string | null;
  errorsSinceOk: number;
  lastError: string | null;
}

const DAY = 86_400_000;

export function checkSources(rows: SourceRow[], now: Date): Finding[] {
  const bySource = new Map(rows.map((r) => [r.source, r]));
  const out: Finding[] = [];
  for (const [source, limit] of Object.entries(SOURCE_MAX_AGE_DAYS)) {
    const row = bySource.get(source);
    if (!row || !row.lastOk) {
      out.push({ key: `source:${source}`, severity: 'warning', title: `${source} has not refreshed yet`, detail: `No successful refresh of ${source} is on record.` });
      continue;
    }
    const ageDays = Math.floor((now.getTime() - Date.parse(row.lastOk)) / DAY);
    if (ageDays > limit) {
      out.push({
        key: `source:${source}`,
        severity: 'critical',
        title: `${source} is ${ageDays} days old`,
        detail: `Last successful refresh ${row.lastOk.slice(0, 10)}; the limit is ${limit} days.${row.lastError ? ` Last error: ${row.lastError.slice(0, 200)}` : ''}`,
      });
    } else if (row.errorsSinceOk >= 2) {
      out.push({
        key: `source:${source}`,
        severity: 'critical',
        title: `${source} has failed ${row.errorsSinceOk} times in a row`,
        detail: `Last success ${row.lastOk.slice(0, 10)}.${row.lastError ? ` Last error: ${row.lastError.slice(0, 200)}` : ''}`,
      });
    }
  }
  return out;
}

export interface PendingNotice {
  program: string;
  document_number: string;
  title: string;
  publication_date: string;
  html_url: string;
}

export function checkCurated(baselines: Record<string, string>, pending: PendingNotice[], today: string): Finding[] {
  const out: Finding[] = [];
  for (const [program, asOf] of Object.entries(baselines)) {
    const s = staleness(program, asOf, today);
    if (s.level === 'stale') {
      out.push({ key: `curated:${program}`, severity: 'critical', title: `${program} data is ${s.ageDays} days old`, detail: `Last verified ${asOf}. Cases touching it are no longer called clear.` });
    } else if (s.level === 'aging') {
      out.push({ key: `curated:${program}`, severity: 'warning', title: `${program} data is ${s.ageDays} days old`, detail: `Last verified ${asOf}.` });
    }
  }
  if (pending.length > 0) {
    const ids = pending.map((p) => `${p.program}:${p.document_number}`).sort();
    out.push({
      key: 'pending_notices',
      severity: 'action',
      title: `${pending.length} Federal Register notice${pending.length === 1 ? '' : 's'} to review`,
      detail: pending.slice(0, 15).map((p) => `- ${p.program}, ${p.publication_date}: ${p.title.slice(0, 120)}\n  ${p.html_url}`).join('\n'),
      fingerprint: ids.join(','),
    });
  }
  return out;
}

export function checkSchema(found: string[]): Finding[] {
  const have = new Set(found.map((n) => n.toLowerCase()));
  const missing = EXPECTED_TABLES.filter((t) => !have.has(t));
  return missing.length === 0
    ? []
    : [{ key: 'schema', severity: 'critical', title: `${missing.length} database table${missing.length === 1 ? ' is' : 's are'} missing`, detail: `Missing: ${missing.join(', ')}. A migration has not been applied; run: npm run db:migrate:remote` }];
}

export interface ModelState {
  key: string;
  status: string;
  detail: string | null;
  last_seen_at: string;
}

const MODEL_TEXT: Record<string, string> = {
  model_credit: 'The AI service account is out of credit. The calculator is paused for visitors until it is topped up.',
  model_auth: 'The AI service key was rejected. The calculator is paused until the key is replaced.',
  model_budget: 'The calculator reached its monthly spending limit and is paused until next month (or until MONTHLY_BUDGET_USD is raised).',
};

export function checkModel(states: ModelState[]): Finding[] {
  return states
    .filter((s) => s.status === 'failing' && MODEL_TEXT[s.key])
    .map((s) => ({ key: s.key, severity: 'critical' as const, title: 'The calculator is paused', detail: `${MODEL_TEXT[s.key]}${s.detail ? ` (${s.detail})` : ''}` }));
}

export interface CanaryResult {
  name: string;
  ok: boolean;
  detail: string;
}

export function checkCanaries(results: CanaryResult[]): Finding[] {
  const failed = results.filter((r) => !r.ok);
  return failed.length === 0
    ? []
    : [{ key: 'canary', severity: 'critical', title: `${failed.length} built-in accuracy check${failed.length === 1 ? '' : 's'} failed`, detail: failed.map((f) => `- ${f.name}: ${f.detail}`).join('\n') }];
}

export interface AlertState {
  key: string;
  status: string;
  detail: string | null;
  last_sent_at: string | null;
  recovery_due: number;
}

export interface MailPlan {
  send: Finding[];
  recovered: string[];
}

/**
 * Decides what to email. A critical finding is mailed when it first appears and again after 24 hours while it persists; an action finding is
 * mailed when it first appears and again only if its fingerprint changes (new notices). A problem that was mailed and has cleared produces
 * one recovery message. Warnings are never mailed on their own; they go in the weekly digest.
 */
export function planMail(findings: Finding[], states: Map<string, AlertState>, now: Date): MailPlan {
  const send: Finding[] = [];
  const current = new Set(findings.map((f) => f.key));
  for (const f of findings) {
    if (f.severity === 'warning') continue;
    const state = states.get(f.key);
    const sentAgo = state?.last_sent_at ? now.getTime() - Date.parse(state.last_sent_at) : Infinity;
    if (!state || state.status !== 'failing' || !state.last_sent_at) send.push(f);
    else if (f.severity === 'critical' && sentAgo >= DAY) send.push(f);
    else if (f.severity === 'action' && (state.detail ?? '') !== (f.fingerprint ?? '')) send.push(f);
  }
  const recovered = [...states.values()].filter((s) => s.recovery_due === 1 && !current.has(s.key)).map((s) => s.key);
  return { send, recovered };
}
