// Cron-triggered auto-refresh for the bulk government reference tables (HTS,
// Schedule B, OFAC SDN, BIS/State CSL) and Trade Policy Pulse's live Federal
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
import { runPulseSync } from './lib/pulse/sync.js';
import { refreshFx, refreshQuotes } from './lib/pulse/markets.js';
import { refreshNews } from './lib/pulse/news.js';
import { logRefresh } from './lib/refresh/log.js';
import type { RefreshResult } from './lib/refresh/types.js';

interface RefreshJob {
  source: RefreshResult['source'];
  run: (env: Env) => Promise<RefreshResult>;
}

// Workers Free caps an account at 5 cron triggers total, and this app
// already used all 5 before Pulse needed a 6th daily slot -- rather than
// dropping a data source or requiring a plan upgrade, one cron string can
// dispatch multiple independent jobs in sequence, so SDN and CSL (previously
// 15 minutes apart, with no ordering dependency between them) now share the
// Monday 06:00 UTC slot. Each job is still logged to data_refresh_log
// individually, and one job's failure doesn't block the other from running.
//
// SDN/CSL were originally daily -- a stale sanctions/entity-list hit is a
// real compliance risk, not just a freshness nicety. They were moved to
// weekly because each job does a full DELETE + full re-INSERT of its table
// (see hts.ts's header comment for why: a partial refresh must never leave a
// half-deleted table), and D1's free-tier plan caps writes at 100,000 rows/
// day account-wide -- daily full reloads of SDN+CSL alone routinely exceeded
// that. Fix is to run less often on the free tier, or move to Workers Paid
// (50M rows/month, 1,000 cron triggers) for daily SDN/CSL freshness and
// separate trigger slots -- see README's "Refreshing the data" section.
const CRON_JOBS: Record<string, RefreshJob[]> = {
  // Daily backstop for Pulse. Markets/news also refresh on request when stale
  // (lib/pulse/refreshLazy.ts) -- this slot just guarantees a refresh even on a
  // day nobody opens the page.
  '0 5 * * *': [
    { source: 'pulse', run: runPulseSync },
    { source: 'pulse_fx', run: refreshFx },
    { source: 'pulse_quotes', run: (env) => (env.MARKET_QUOTES === 'off' ? Promise.resolve({ source: 'pulse_quotes', rows: 0 }) : refreshQuotes(env)) },
    { source: 'pulse_news', run: refreshNews },
  ],
  '0 6 * * 1': [
    { source: 'sdn', run: refreshSdn },
    { source: 'csl', run: refreshCsl },
  ],
  '0 7 * * 1': [{ source: 'hts', run: refreshHts }],
  '30 7 * * 1': [{ source: 'schedule_b', run: refreshScheduleB }],
  '0 8 * * 1': [{ source: 'xref', run: refreshXref }],
};

export async function scheduled(controller: ScheduledController, env: Env): Promise<void> {
  const jobs = CRON_JOBS[controller.cron];
  if (!jobs) {
    console.error(`No refresh jobs mapped for cron pattern "${controller.cron}" -- check wrangler.jsonc vs CRON_JOBS`);
    return;
  }

  for (const job of jobs) {
    const startedAt = new Date().toISOString();
    try {
      const result = await job.run(env);
      // truncatedTerms is only ever set by pulse -- every other job leaves
      // it undefined, so this stays a no-op note for them.
      const note = result.truncatedTerms?.length
        ? `Pagination cap reached for: ${result.truncatedTerms.join(', ')} -- some historical documents may be missing.`
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
