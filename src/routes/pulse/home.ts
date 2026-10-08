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
const SNAPSHOT_CHART_TYPES = new Set(['tempo', 'markets', 'cofer']);

const MAX_SNAPSHOT_JSON_BYTES = 200_000;

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

homeRoute.post('/snapshots', async (c) => {
  const body = await c.req
    .json<{ chart_type?: string; title?: string; params?: unknown; data?: unknown; source_note?: string }>()
    .catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON body.' }, 400);
  const { chart_type, title, params, data, source_note } = body;

  if (!chart_type || !SNAPSHOT_CHART_TYPES.has(chart_type)) {
    return c.json({ error: `chart_type must be one of: ${[...SNAPSHOT_CHART_TYPES].join(', ')}` }, 400);
  }
  if (!title || typeof title !== 'string') return c.json({ error: 'title is required.' }, 400);
  if (!source_note || typeof source_note !== 'string') return c.json({ error: 'source_note is required.' }, 400);
  if (data === undefined) return c.json({ error: 'data is required.' }, 400);

  const paramsJson = JSON.stringify(params ?? {});
  const dataJson = JSON.stringify(data);
  if (dataJson.length > MAX_SNAPSHOT_JSON_BYTES) {
    return c.json({ error: 'Snapshot data is too large.' }, 400);
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO pulse_snapshots (id, chart_type, title, params_json, data_json, source_note, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
  )
    .bind(id, chart_type, title, paramsJson, dataJson, source_note, createdAt)
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
