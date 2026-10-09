import { Hono } from 'hono';
import type { Env } from '../../types/env.js';
import { runPulseSync } from '../../lib/pulse/sync.js';
import { refreshIfStale } from '../../lib/pulse/refreshLazy.js';
import { logRefresh } from '../../lib/refresh/log.js';
import type { PulseAction } from '../../lib/pulse/types.js';
import type { PulseApp } from './util.js';
import { clampInt, slimAction } from './util.js';

// Global cooldown, not per-caller -- Pulse's risk is Worker CPU/subrequest
// exhaustion from repeated Federal Register calls, a shared resource, not an
// abuse-by-one-IP risk (see CLAUDE_RATE_LIMITER on the /api/cases/* routes,
// which is IP-keyed for a different reason: capping per-caller Anthropic
// spend). The UPDATE...WHERE is an atomic compare-and-swap: two concurrent
// POSTs can't both see the cooldown as expired, because "claim the right to
// sync" and "check the cooldown" are the same statement, not two steps with
// a gap between them.
const SYNC_COOLDOWN_MS = 60_000;

// Citable snapshots -- see migrations/0021_schema_pulse_snapshots.sql's header
// for why this is its own frozen-copy table rather than reusing any
// existing last_updated/data_as_of column. Already covered by index.ts's
// blanket /api/pulse/* rate limit (120/min/IP), same as every other route
// here -- no extra limiter needed just for the write.


export function homeRoute(root: PulseApp): PulseApp {
  const homeRoute: PulseApp = new Hono<{ Bindings: Env }>();

homeRoute.post('/sync', async (c) => {
  const now = new Date();
  const cooldownEdge = new Date(now.getTime() - SYNC_COOLDOWN_MS).toISOString();

  // One atomic upsert: plain INSERT if the row doesn't exist yet (first-ever
  // call), or a conditional UPDATE if it does -- the WHERE after DO UPDATE
  // SET only fires the update (and only then counts as a change) when the
  // cooldown has actually elapsed, so "claim the right to sync" and "check
  // the cooldown" can never race across two concurrent requests.
  const claim = await c.env.DB.prepare(
    `INSERT INTO pulse_sync_state (id, last_synced_date, last_synced_at) VALUES (1, NULL, ?1)
     ON CONFLICT(id) DO UPDATE SET last_synced_at = excluded.last_synced_at
     WHERE pulse_sync_state.last_synced_at IS NULL OR pulse_sync_state.last_synced_at < ?2`
  )
    .bind(now.toISOString(), cooldownEdge)
    .run();

  if (claim.meta.changes === 0) {
    return c.json({ ok: false, error: 'Sync already ran recently -- try again shortly.' }, 429);
  }

  const startedAt = now.toISOString();
  try {
    const result = await runPulseSync(c.env);
    // Status stays 'success' -- a pagination cap isn't a failed sync, real
    // rows were still fetched and written -- but the note carries forward
    // into data_refresh_log instead of only living in a console.warn, so
    // it's visible after the fact, not just at the moment it happened.
    const note = result.truncatedTerms?.length
      ? `Pagination cap reached for: ${result.truncatedTerms.join(', ')} -- some historical documents may be missing.`
      : null;
    await logRefresh(c.env, 'pulse', 'success', result.rows, note, startedAt);
    return c.json({ ok: true, rows: result.rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logRefresh(c.env, 'pulse', 'error', null, message, startedAt);
    return c.json({ ok: false, error: "Couldn't refresh from the Federal Register API -- showing last-synced data." }, 502);
  }
});

// ---------------------------------------------------------------------------
// One-call page load. The page used to make six or seven separate API calls;
// this composes the same handlers (so every rule -- lazy refresh, kill
// switches, filters -- stays defined in exactly one place) into a single
// response, which is faster for the reader and cuts the Worker request count
// per visit several-fold. Also reports how fresh each source is.
// ---------------------------------------------------------------------------
homeRoute.get('/home', async (c) => {
  const call = async <T>(path: string): Promise<T> => {
    const res = await root.request(path, {}, c.env, c.executionCtx);
    if (!res.ok) throw new Error(`${path} failed: HTTP ${res.status}`);
    return (await res.json()) as T;
  };
  // Each part is independent: one failing (say an upstream news feed) must not
  // blank the rest, so failures come back as null and the page shows its
  // per-panel fallback.
  const settle = async <T>(path: string): Promise<T | null> => {
    try {
      return await call<T>(path);
    } catch {
      return null;
    }
  };
  const [summary, tempo, overlays, recent, markets, news] = await Promise.all([
    settle('/summary'),
    settle('/tempo'),
    settle('/active-measures'),
    settle<{ actions: PulseAction[] }>('/feed?limit=100'),
    settle('/markets'),
    settle('/news?limit=60'),
  ]);

  // Same degrade-don't-crash rule as the panels above: freshness timestamps
  // are a nice-to-have (a "how stale is this" caption), not core data, so a
  // D1 hiccup here (an outage, a quota day) must not 500 the whole page when
  // every panel above already came back fine.
  const states = await c.env.DB.prepare('SELECT source_key, last_success_at FROM pulse_feed_state')
    .all<{ source_key: string; last_success_at: string | null }>()
    .catch(() => ({ results: [] as { source_key: string; last_success_at: string | null }[] }));
  // "Freshness" here means the same thing for every source: when did the
  // Worker last successfully check for new data, not when the newest row
  // happened to be published. The other four sources already get this from
  // pulse_feed_state (refreshIfStale's lazy-refresh tracker); the Federal
  // Register sync runs on its own cron + on-demand path instead (see
  // scheduled.ts), so its equivalent is the latest successful row in
  // data_refresh_log. Using MAX(fetched_at) from trade_policy_actions here
  // used to conflate "checked today, found nothing new" with "haven't
  // checked in days" -- a real source of the exact stale-looking timestamp
  // this was rewritten to fix.
  const policyChecked = await c.env.DB.prepare(
    `SELECT MAX(finished_at) AS t FROM data_refresh_log WHERE source = 'pulse' AND status = 'success'`
  )
    .first<{ t: string | null }>()
    .catch(() => null);
  const at = (k: string) => states.results.find((r) => r.source_key === k)?.last_success_at ?? null;

  c.header('Cache-Control', 'public, max-age=60');
  return c.json({
    summary,
    tempo,
    overlays,
    recent: recent && { ...recent, actions: recent.actions.map(slimAction) },
    markets,
    news,
    status: {
      policy: policyChecked?.t ?? null,
      news: at('news'),
      quotes: c.env.MARKET_QUOTES === 'off' ? null : at('quotes'),
      fx: at('fx'),
      macro: at('macro'),
    },
  });
});

 // generous for chart data (a few hundred points), well under D1's 100KB-per-value column limit headroom when combined with the rest of the row

// A citable snapshot must be something the site itself published, so the data is never taken from the
// request: the server reads it from its own database, and the title and source note are fixed text.
// (Taking client-supplied data would let anyone mint a "citable" chart of numbers that never existed.)
// Market charts are not offered: their source is not currently shown (MARKET_QUOTES is off).
const SNAPSHOT_SPECS = {
  tempo: {
    title: 'Policy tempo: U.S. trade notices per month',
    note: 'Federal Register (federalregister.gov), monthly count of tracked trade-policy notices.',
  },
  cofer: {
    title: "U.S. dollar's share of world FX reserves",
    note: 'International Monetary Fund, COFER (data.imf.org), quarterly, share of allocated reserves.',
  },
} as const;

homeRoute.post('/snapshots', async (c) => {
  const body = await c.req.json<{ chart_type?: string; params?: { months?: unknown } }>().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON body.' }, 400);
  const type = body.chart_type as keyof typeof SNAPSHOT_SPECS;
  if (!type || !(type in SNAPSHOT_SPECS)) {
    return c.json({ error: `chart_type must be one of: ${Object.keys(SNAPSHOT_SPECS).join(', ')}` }, 400);
  }

  let params: Record<string, unknown> = {};
  let data: unknown;
  if (type === 'cofer') {
    const { results } = await c.env.DB.prepare(`SELECT obs_date, value FROM market_series WHERE series_id = 'COFER:USD_SHARE' ORDER BY obs_date`).all<{ obs_date: string; value: number }>();
    if (results.length === 0) return c.json({ error: 'No data to save yet.' }, 409);
    data = { points: results.map((r) => [r.obs_date, r.value]) };
  } else {
    const months = clampInt(typeof body.params?.months === 'number' ? String(body.params.months) : undefined, { default: 24, min: 6, max: 120 });
    const since = new Date();
    since.setUTCMonth(since.getUTCMonth() - months);
    const [series, trend] = await Promise.all([
      c.env.DB.prepare(`SELECT strftime('%Y-%m', publication_date) AS month, COUNT(*) AS count FROM trade_policy_actions WHERE publication_date >= ?1 GROUP BY month ORDER BY month`)
        .bind(since.toISOString().slice(0, 10))
        .all<{ month: string; count: number }>(),
      c.env.DB.prepare(
        `SELECT SUM(CASE WHEN publication_date >= date('now', '-30 days') THEN 1 ELSE 0 END) AS last_30d,
                SUM(CASE WHEN publication_date < date('now', '-30 days') THEN 1 ELSE 0 END) AS prior_30d
         FROM trade_policy_actions WHERE publication_date >= date('now', '-60 days')`
      ).first<{ last_30d: number; prior_30d: number }>(),
    ]);
    const last30 = trend?.last_30d ?? 0;
    const prior30 = trend?.prior_30d ?? 0;
    params = { months };
    data = { months: series.results, trendPct: prior30 > 0 ? Math.round(((last30 - prior30) / prior30) * 100) : null };
  }

  const paramsJson = JSON.stringify(params);
  const dataJson = JSON.stringify(data);

  // The same capture made twice (same chart, same data) reuses the first snapshot instead of writing another.
  const existing = await c.env.DB.prepare(`SELECT id, created_at FROM pulse_snapshots WHERE chart_type = ?1 AND params_json = ?2 AND data_json = ?3 LIMIT 1`)
    .bind(type, paramsJson, dataJson)
    .first<{ id: string; created_at: string }>();
  if (existing) return c.json(existing);

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO pulse_snapshots (id, chart_type, title, params_json, data_json, source_note, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
  )
    .bind(id, type, SNAPSHOT_SPECS[type].title, paramsJson, dataJson, SNAPSHOT_SPECS[type].note, createdAt)
    .run();

  return c.json({ id, created_at: createdAt });
});

homeRoute.get('/snapshots/:id', async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare(`SELECT * FROM pulse_snapshots WHERE id = ?1`)
    .bind(id)
    .first<{ id: string; chart_type: string; title: string; params_json: string; data_json: string; source_note: string; created_at: string }>();
  if (!row) return c.json({ error: 'Snapshot not found.' }, 404);

  return c.json({
    id: row.id,
    chart_type: row.chart_type,
    title: row.title,
    params: JSON.parse(row.params_json),
    data: JSON.parse(row.data_json),
    source_note: row.source_note,
    created_at: row.created_at,
  });
});
  return homeRoute;
}
