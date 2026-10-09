// Cron-triggered auto-refresh for the bulk government reference tables (HTS,
// Schedule B, OFAC SDN, BIS/State CSL) and Aex Terminal's live Federal
// Register feed -- see wrangler.jsonc's `triggers.crons` for the schedule
// and src/lib/refresh/*.ts / src/lib/pulse/sync.ts for each job. Curated
// legal content (USMCA rules, tariff overlays, country chart, ECCN) is
// deliberately NOT auto-refreshed here: every one of those rows was
// hand-verified against a primary source before being encoded, and silently
// rewriting a duty rate or license determination from an unverified feed
// would undermine exactly the grounding guarantee this app is built to
// demonstrate. Extending auto-refresh to curated content should mean
// detect-and-flag for human review, never auto-apply -- see README.md's
// "Known limitations".
import type { Env } from './types/env.js';
import { refreshHts } from './lib/refresh/hts.js';
import { refreshScheduleB } from './lib/refresh/scheduleB.js';
import { refreshXref } from './lib/refresh/xref.js';
import { refreshSdn } from './lib/refresh/sdn.js';
import { refreshCsl } from './lib/refresh/csl.js';
import { refreshUnSanctions } from './lib/refresh/unSanctions.js';
import { refreshUkSanctions } from './lib/refresh/ukSanctions.js';
import { refreshWroFindings } from './lib/refresh/wroFindings.js';
import { runPulseSync } from './lib/pulse/sync.js';
import { refreshFx, refreshQuotes } from './lib/pulse/markets.js';
import { refreshMacro } from './lib/pulse/macro.js';
import { refreshCofer } from './lib/pulse/cofer.js';
import { refreshNews } from './lib/pulse/news.js';
import { refreshGlobalTradeAlert } from './lib/pulse/globalTradeAlert.js';
import { logRefresh } from './lib/refresh/log.js';
import { purgeExpiredCases } from './lib/caseStore.js';
import type { RefreshResult } from './lib/refresh/types.js';

export const DAILY_CRON = '0 5 * * *';

interface RefreshJob {
  source: RefreshResult['source'];
  run: (env: Env) => Promise<RefreshResult>;
}

// Scheduling model. One daily trigger runs the light Pulse jobs, then at most a
// small, budgeted set of the heavy bulk reference reloads (SDN, CSL, UN, UK, GTA,
// WRO, HTS, Schedule B, xref). Those jobs replace a whole table, and D1's free tier
// allows only 100,000 rows written per day account-wide -- counting index and
// search-index entries -- so running them all on one Monday blew the quota and
// starved everything else that day. Instead each bulk job is "due" once a week, and a
// day only runs due jobs while their combined last-known size fits BULK_ROW_BUDGET
// (always at least one), most safety-critical first. They therefore spread themselves
// across the week automatically, and each also skips its rewrite entirely when the
// upstream file is unchanged (see lib/refresh/changeGate.ts). This also uses one
// cron trigger instead of five, leaving the rest of the Workers Free allowance free.
const DAILY_JOBS: RefreshJob[] = [
  // Markets/news also refresh on request when stale (lib/pulse/refreshLazy.ts) -- this
  // just guarantees a refresh even on a day nobody opens the page.
  { source: 'pulse', run: runPulseSync },
  { source: 'pulse_fx', run: refreshFx },
  { source: 'pulse_quotes', run: (env) => (env.MARKET_QUOTES === 'off' ? Promise.resolve({ source: 'pulse_quotes', rows: 0 }) : refreshQuotes(env)) },
  { source: 'pulse_news', run: refreshNews },
  { source: 'pulse_macro', run: refreshMacro },
  { source: 'pulse_cofer', run: refreshCofer },
  // Privacy: remove calculator cases past their 30-day retention (src/lib/caseStore.ts).
  { source: 'case_expiry', run: async (env) => ({ source: 'case_expiry', rows: await purgeExpiredCases(env) }) },
];

// Priority order = sanctions first (a stale list is a real compliance risk).
// `typicalRows` is the fallback size when a job has never logged a run.
const BULK_JOBS: (RefreshJob & { typicalRows: number })[] = [
  { source: 'sdn', run: refreshSdn, typicalRows: 44_000 },
  { source: 'csl', run: refreshCsl, typicalRows: 7_000 },
  { source: 'un_sanctions', run: refreshUnSanctions, typicalRows: 3_000 },
  { source: 'uk_sanctions', run: refreshUkSanctions, typicalRows: 8_000 },
  { source: 'gta', run: refreshGlobalTradeAlert, typicalRows: 3_000 },
  { source: 'wro_findings', run: refreshWroFindings, typicalRows: 100 },
  { source: 'hts', run: refreshHts, typicalRows: 32_000 },
  { source: 'schedule_b', run: refreshScheduleB, typicalRows: 15_000 },
  { source: 'xref', run: refreshXref, typicalRows: 30_000 },
];
const BULK_DUE_AFTER_MS = 7 * 86_400_000 - 3_600_000; // a day-late cron must not slip a whole extra week
const BULK_ROW_BUDGET = 30_000; // rows per day; with indexes and search tables each costs several writes

export async function pickDueBulkJobs(env: Env, now = Date.now()) {
  const { results } = await env.DB.prepare(
    `SELECT source, MAX(rows_affected) AS biggest,
            MAX(CASE WHEN status = 'success' THEN finished_at END) AS last_ok
     FROM data_refresh_log GROUP BY source`
  ).all<{ source: string; biggest: number | null; last_ok: string | null }>();
  const seen = new Map(results.map((r) => [r.source, r]));

  const picked: typeof BULK_JOBS = [];
  let spent = 0;
  for (const job of BULK_JOBS) {
    const row = seen.get(job.source);
    const lastOk = row?.last_ok ? Date.parse(row.last_ok) : 0;
    if (now - lastOk < BULK_DUE_AFTER_MS) continue;
    const cost = Math.max(row?.biggest ?? 0, job.typicalRows);
    if (picked.length > 0 && spent + cost > BULK_ROW_BUDGET) continue;
    picked.push(job);
    spent += cost;
  }
  return picked;
}

export async function scheduled(controller: ScheduledController, env: Env): Promise<void> {
  if (controller.cron !== DAILY_CRON) {
    console.error(`No refresh jobs mapped for cron pattern "${controller.cron}" -- check wrangler.jsonc vs DAILY_CRON`);
    return;
  }

  let bulk: typeof BULK_JOBS = [];
  try {
    bulk = await pickDueBulkJobs(env);
  } catch (err) {
    console.error('Could not work out which bulk reloads are due:', err instanceof Error ? err.message : String(err));
  }

  for (const job of [...DAILY_JOBS, ...bulk]) {
    const startedAt = new Date().toISOString();
    try {
      const result = await job.run(env);
      // truncatedTerms is only ever set by pulse -- every other job leaves
      // it undefined, so this stays a no-op note for them.
      const note = result.truncatedTerms?.length
        ? `Pagination cap reached for: ${result.truncatedTerms.join(', ')} -- some historical documents may be missing.`
        : result.unchanged
          ? 'Source unchanged since the last load; skipped the rewrite to save database writes.'
          : null;
      await logRefresh(env, result.source, 'success', result.rows, note, startedAt);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Scheduled refresh failed for "${job.source}":`, message);
      // Every job fetches and builds its full dataset in memory before ever
      // writing to D1, and writes via one atomic batch() -- see hts.ts's
      // header comment -- so a failure here means the live table was never
      // touched, and it doesn't prevent the next job in this same
      // invocation from running.
      await logRefresh(env, job.source, 'error', null, message, startedAt);
    }
  }
}
