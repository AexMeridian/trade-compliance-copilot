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
import { refreshWorldBank } from './lib/refresh/worldBank.js';
import { refreshPowerIndicators } from './lib/refresh/powerIndicators.js';
import { refreshUnVoting } from './lib/refresh/unVoting.js';
import { refreshUisStudents } from './lib/refresh/uisStudents.js';
import { refreshUnhcr } from './lib/refresh/unhcr.js';
import { refreshNobel } from './lib/refresh/nobel.js';
import { refreshFts } from './lib/refresh/fts.js';
import { refreshUndp } from './lib/refresh/undp.js';
import { refreshOpenAlex } from './lib/refresh/openalex.js';
import { refreshTreasury } from './lib/pulse/treasury.js';
import { refreshCommodities } from './lib/pulse/commodities.js';
import { refreshCustomsDuties, refreshTravelAdvisories } from './lib/pulse/everyday.js';
import { refreshFreight } from './lib/pulse/freight.js';
import { refreshCsms } from './lib/pulse/csms.js';
import { refreshCensusTrade, refreshAcsForeignBorn } from './lib/pulse/census.js';
import { refreshGlobalTradeAlert } from './lib/pulse/globalTradeAlert.js';
import { runHealth } from './lib/healthRun.js';
import { refreshCuratedWatch } from './lib/refresh/curatedWatch.js';
import { logRefresh } from './lib/refresh/log.js';
import { meterDb, isWriteQuotaError } from './lib/refresh/meter.js';
import { purgeExpiredCases } from './lib/caseStore.js';
import type { RefreshResult } from './lib/refresh/types.js';

// Three triggers (Workers Free allows five). A free-plan invocation may make at most 50 outbound requests and 50 database
// queries, so the work is split rather than run in one go: the daily Pulse jobs, the weekly reference-table reloads, and the
// weekly country indicators each get their own invocation and their own budget.
export const DAILY_CRON = '0 5 * * *';
export const BULK_CRON = '0 6 * * *';
export const INDICATOR_CRON = '0 7 * * *';
export const CENSUS_CRON = '30 5 * * *'; // own invocation: up to ~40 Census requests a run while the 2018-onward history backfills
export const HEALTH_CRON = '0 8 * * *'; // after the others have run: checks what they did, emails what needs a person

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
// day only runs due jobs while their combined last-known size fits BULK_WRITE_BUDGET
// (always at least one), most safety-critical first. They therefore spread themselves
// across the week automatically, and each also skips its rewrite entirely when the
// upstream file is unchanged (see lib/refresh/changeGate.ts). This also uses one
// cron trigger instead of five, leaving the rest of the Workers Free allowance free.
const DAILY_JOBS: RefreshJob[] = [
  // Markets/news also refresh on request when stale (lib/pulse/refreshLazy.ts) -- this
  // just guarantees a refresh even on a day nobody opens the page.
  { source: 'pulse', run: runPulseSync },
  // Right after the notices are stored: flags any notice about a hand-verified program that is newer than that program's data.
  { source: 'curated_watch', run: refreshCuratedWatch },
  { source: 'pulse_fx', run: refreshFx },
  { source: 'pulse_quotes', run: (env) => (env.MARKET_QUOTES === 'off' ? Promise.resolve({ source: 'pulse_quotes', rows: 0 }) : refreshQuotes(env)) },
  { source: 'pulse_news', run: refreshNews },
  { source: 'pulse_macro', run: refreshMacro },
  { source: 'pulse_cofer', run: refreshCofer },
  { source: 'pulse_treasury', run: refreshTreasury },
  { source: 'pulse_commodities', run: refreshCommodities },
  // Asked for in user testing: duties collected each month, and State Department travel advisories for country pages.
  { source: 'customs_duties', run: refreshCustomsDuties },
  { source: 'travel_advisories', run: refreshTravelAdvisories },
  // NY Fed supply-chain pressure index and IMF PortWatch chokepoint transits (3 requests, a few rows a day once loaded).
  { source: 'freight_indicators', run: refreshFreight },
  // CBP's CSMS bulletins (official GovDelivery feed), tagged by program for the Wire.
  { source: 'csms', run: refreshCsms },
  // Privacy: remove calculator cases past their 30-day retention (src/lib/caseStore.ts).
  {
    source: 'case_expiry',
    run: async (env) => {
      // Also trims the refresh log (about 25 rows a day) to the last 90 days, so it cannot grow without end.
      await env.DB.prepare(`DELETE FROM data_refresh_log WHERE finished_at < date('now', '-90 days')`).run().catch(() => undefined);
      // Daily counters (shared Claude cap, per-visitor quota) and expired citable snapshots would otherwise accumulate forever.
      await env.DB.prepare(`DELETE FROM pulse_feed_state WHERE (source_key LIKE 'claude-calls:%' AND substr(source_key, 14, 10) < date('now', '-35 days')) OR (source_key LIKE 'claude-ip:%' AND substr(source_key, 11, 10) < date('now', '-35 days'))`).run().catch(() => undefined);
      await env.DB.prepare(`DELETE FROM model_cache WHERE created_at < date('now', '-14 days')`).run().catch(() => undefined);
      return { source: 'case_expiry', rows: await purgeExpiredCases(env) };
    },
  },
];

// Both skip with a clear status ("needs CENSUS_API_KEY") until the owner sets the key, and write only changed rows.
const CENSUS_JOBS: RefreshJob[] = [
  { source: 'census_trade', run: refreshCensusTrade },
  { source: 'census_acs', run: refreshAcsForeignBorn },
];

// Priority order = sanctions first (a stale list is a real compliance risk).
// `typicalWrites` is the fallback D1 write cost (rows written, index and search entries included) when a job has no measured run yet.
type SizedJob = RefreshJob & { typicalWrites: number; /** Outbound requests one run makes, counted conservatively. */ fetches?: number };
// The four sanctions lists (SDN, CSL, UN, UK) are no longer reloaded here: their files (17-30 MB) need more CPU than a Workers Free
// invocation has, so the job was killed before it could even log the failure and the lists went stale. They are synced daily by
// .github/workflows/lists-sync.yml (scripts/sync-lists.ts), which writes only the changes as a migration that the deploy applies.
// The old in-Worker loaders are kept for a paid plan or a local run (they replace the table, so do not run them alongside the sync).
export const WORKER_SKIPPED_LIST_JOBS = { refreshSdn, refreshCsl, refreshUnSanctions, refreshUkSanctions };
// HTS, Schedule B and the cross-reference are NOT here: the HTS load needs 96 requests (the free plan allows 50) and a full reload writes far more rows than
// a free-plan day can absorb, so the "HTS and Schedule B sync" GitHub workflow (.github/workflows/bulk-sync.yml, scripts/sync-bulk-data.ts) loads them as
// migrations and writes their data_refresh_log rows. The Worker loaders (lib/refresh/hts.ts, scheduleB.ts, xref.ts) are kept for a paid plan, where they
// can be added back to this list.
export { refreshHts } from './lib/refresh/hts.js';
export { refreshScheduleB } from './lib/refresh/scheduleB.js';
export { refreshXref } from './lib/refresh/xref.js';
const BULK_JOBS: SizedJob[] = [
  { source: 'gta', run: refreshGlobalTradeAlert, typicalWrites: 9_000 },
  { source: 'wro_findings', run: refreshWroFindings, typicalWrites: 500 },
];

// Country indicators: weekly, tiny writes but many outbound requests (one per World Bank series, one per year of humanitarian
// funding...). They run in their own invocation, at most INDICATOR_FETCH_BUDGET requests per day, so whatever does not fit
// waits for the next day instead of failing with "too many subrequests".
const INDICATOR_JOBS: SizedJob[] = [
  { source: 'world_bank', run: refreshWorldBank, typicalWrites: 1200, fetches: 2 },
  { source: 'power_indicators', run: refreshPowerIndicators, typicalWrites: 150, fetches: 9 },
  { source: 'un_voting', run: refreshUnVoting, typicalWrites: 3, fetches: 2 },
  { source: 'uis_students', run: refreshUisStudents, typicalWrites: 6, fetches: 2 },
  { source: 'unhcr', run: refreshUnhcr, typicalWrites: 3, fetches: 2 },
  { source: 'nobel', run: refreshNobel, typicalWrites: 6, fetches: 4 },
  { source: 'fts', run: refreshFts, typicalWrites: 3, fetches: 9 },
  { source: 'undp_hdr', run: refreshUndp, typicalWrites: 9, fetches: 2 },
  { source: 'openalex', run: refreshOpenAlex, typicalWrites: 12, fetches: 6 },
];
const INDICATOR_FETCH_BUDGET = 40;
const BULK_DUE_AFTER_MS = 7 * 86_400_000 - 3_600_000; // a day-late cron must not slip a whole extra week
// D1 Free allows 100,000 rows written per day for the whole account. The bulk reloads may use at most BULK_WRITE_BUDGET of it, and DAILY_WRITE_RESERVE is
// always left for everything else (case creation, health and refresh log rows, the Claude call counter, alerts), so those small writes still succeed on a
// day a big reload ran. Budgets are in measured writes (meta.rows_written, see lib/refresh/meter.ts), not declared rows.
export const D1_DAILY_WRITE_CAP = 100_000;
export const DAILY_WRITE_RESERVE = 20_000;
export const BULK_WRITE_BUDGET = 30_000;
const LEGACY_WRITES_PER_ROW = 5; // for log rows from before rows_written was recorded: rows x (base + indexes + search entries)

interface LogSummary {
  source: string;
  biggest: number | null;
  written?: number | null;
  last_ok: string | null;
  fails?: number | null;
}

async function readLogSummary(env: Env): Promise<LogSummary[]> {
  const sql = (writtenColumn: string) =>
    `SELECT source, MAX(rows_affected) AS biggest, ${writtenColumn}
            MAX(CASE WHEN status = 'success' THEN finished_at END) AS last_ok,
            SUM(CASE WHEN status = 'error' AND finished_at > COALESCE((SELECT MAX(l2.finished_at) FROM data_refresh_log l2 WHERE l2.source = l.source AND l2.status = 'success'), '') THEN 1 ELSE 0 END) AS fails
     FROM data_refresh_log l GROUP BY source`;
  try {
    return (await env.DB.prepare(sql('MAX(rows_written) AS written,')).all<LogSummary>()).results;
  } catch {
    // Migration 0090 (rows_written) not applied yet: fall back to declared rows.
    return (await env.DB.prepare(sql('')).all<LogSummary>()).results;
  }
}

/** Writes already spent today (UTC), from the measured figures in the refresh log. 0 when it cannot be read. */
export async function writesSpentToday(env: Env): Promise<number> {
  try {
    const row = await env.DB.prepare(`SELECT COALESCE(SUM(rows_written), 0) AS spent FROM data_refresh_log WHERE finished_at >= date('now')`).first<{ spent: number }>();
    return Number(row?.spent ?? 0) || 0;
  } catch {
    return 0;
  }
}

/** The write cost to plan for: the largest measured run, else the largest declared row count times a per-row factor, else the typical size. */
export function plannedWrites(row: LogSummary | undefined, typicalWrites: number): number {
  if (row?.written != null && row.written > 0) return row.written;
  return Math.max((row?.biggest ?? 0) * LEGACY_WRITES_PER_ROW, typicalWrites);
}

/** Budget for one bulk invocation: the fixed bulk allowance, cut down by what today already used and by the reserve kept for small writes. */
export function bulkWriteLimit(spentToday: number): number {
  return Math.max(0, Math.min(BULK_WRITE_BUDGET, D1_DAILY_WRITE_CAP - DAILY_WRITE_RESERVE - spentToday));
}

async function pickDue(env: Env, jobs: SizedJob[], limits: { writes: number; fetches?: number }, now: number): Promise<SizedJob[]> {
  // No headroom left today (the reserve for small writes is already being eaten): run nothing heavy until tomorrow.
  if (limits.writes <= 0) return [];
  const seen = new Map((await readLogSummary(env)).map((r) => [r.source, r]));

  // A job that keeps failing must not starve the others: jobs with a failure since their last success go to the back of the
  // line (stable sort keeps priority order within each group), so a healthy due job is always picked first and the failing one
  // only runs when it fits the budget or nothing else is due. Otherwise a permanently broken first job (e.g. SDN) would run
  // alone every day and nothing after it would ever refresh.
  const failing = (j: SizedJob) => ((seen.get(j.source)?.fails ?? 0) > 0 ? 1 : 0);
  const ordered = [...jobs].sort((a, b) => failing(a) - failing(b));
  const picked: SizedJob[] = [];
  let spent = 0;
  let requests = 0;
  for (const job of ordered) {
    const row = seen.get(job.source);
    const lastOk = row?.last_ok ? Date.parse(row.last_ok) : 0;
    if (now - lastOk < BULK_DUE_AFTER_MS) continue;
    const cost = plannedWrites(row, job.typicalWrites);
    if (picked.length > 0 && spent + cost > limits.writes) continue;
    if (limits.fetches !== undefined && picked.length > 0 && requests + (job.fetches ?? 1) > limits.fetches) continue;
    picked.push(job);
    spent += cost;
    requests += job.fetches ?? 1;
  }
  return picked;
}

export const pickDueBulkJobs = async (env: Env, now = Date.now()) => pickDue(env, BULK_JOBS, { writes: bulkWriteLimit(await writesSpentToday(env)) }, now);
export const pickDueIndicatorJobs = (env: Env, now = Date.now()) => pickDue(env, INDICATOR_JOBS, { writes: BULK_WRITE_BUDGET, fetches: INDICATOR_FETCH_BUDGET }, now);

export async function scheduled(controller: ScheduledController, env: Env): Promise<void> {
  let jobs: RefreshJob[];
  try {
    if (controller.cron === DAILY_CRON) jobs = DAILY_JOBS;
    else if (controller.cron === BULK_CRON) jobs = await pickDueBulkJobs(env);
    else if (controller.cron === INDICATOR_CRON) jobs = await pickDueIndicatorJobs(env);
    else if (controller.cron === CENSUS_CRON) jobs = CENSUS_JOBS;
    else if (controller.cron === HEALTH_CRON) jobs = [{ source: 'health', run: runHealth }];
    else {
      console.error(`No refresh jobs mapped for cron pattern "${controller.cron}" -- check wrangler.jsonc against src/scheduled.ts`);
      return;
    }
  } catch (err) {
    console.error('Could not work out which reloads are due:', err instanceof Error ? err.message : String(err));
    return;
  }

  for (const job of jobs) {
    const startedAt = new Date().toISOString();
    const meter = meterDb(env.DB);
    const jobEnv = { ...env, DB: meter.db } as Env;
    try {
      const result = await job.run(jobEnv);
      // truncatedTerms is only ever set by pulse -- every other job leaves
      // it undefined, so this stays a no-op note for them.
      const note = result.skipped
        ? result.skipped
        : result.truncatedTerms?.length
        ? `Pagination cap reached for: ${result.truncatedTerms.join(', ')} -- some historical documents may be missing.`
        : result.unchanged
          ? 'Source unchanged since the last load; skipped the rewrite to save database writes.'
          : null;
      await logRefresh(env, result.source, 'success', result.rows, note, startedAt, meter.written());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Scheduled refresh failed for "${job.source}":`, message);
      // Every job fetches and builds its full dataset in memory before ever
      // writing to D1, and writes via one atomic batch() -- see hts.ts's
      // header comment -- so a failure here means the live table was never
      // touched, and it doesn't prevent the next job in this same
      // invocation from running.
      await logRefresh(env, job.source, 'error', null, message, startedAt, meter.written());
      // Out of D1 writes for the day: the remaining jobs would fail the same way and each attempt wastes a log write. The next invocation picks them up.
      if (isWriteQuotaError(err)) {
        console.error('D1 write allowance looks exhausted; skipping the remaining jobs in this invocation.');
        break;
      }
    }
  }
}
