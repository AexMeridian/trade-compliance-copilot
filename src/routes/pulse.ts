import { Hono, type Context } from 'hono';
import type { Env } from '../types/env.js';
import { runPulseSync } from '../lib/pulse/sync.js';
import { MARKET_META, FX_META, refreshQuotes, refreshFx } from '../lib/pulse/markets.js';
import { refreshNews } from '../lib/pulse/news.js';
import { refreshIfStale } from '../lib/pulse/refreshLazy.js';
import { logRefresh } from '../lib/refresh/log.js';
import type { PulseAction, TempoPoint } from '../lib/pulse/types.js';

export const pulseRoute = new Hono<{ Bindings: Env }>();

pulseRoute.get('/feed', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 30) || 30, 100);
  const tag = c.req.query('tag') || null;
  const search = c.req.query('q') || null;
  // `countries` is stored as a JSON array string, e.g. '["CN","MX"]' -- the
  // quotes around the code in the LIKE pattern anchor the match to a whole
  // array element, so a 2-letter code can't accidentally match inside a
  // longer one.
  const country = c.req.query('country') || null;
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM trade_policy_actions
     WHERE (?1 IS NULL OR tag = ?1)
       AND (?2 IS NULL OR title LIKE '%' || ?2 || '%' OR abstract LIKE '%' || ?2 || '%')
       AND (?3 IS NULL OR countries LIKE '%"' || ?3 || '"%')
     ORDER BY publication_date DESC, document_number DESC LIMIT ?4`
  )
    .bind(tag, search, country, limit)
    .all<PulseAction>();
  return c.json({ actions: results });
});

pulseRoute.get('/tempo', async (c) => {
  const since = (() => {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - 24);
    return d.toISOString().slice(0, 10);
  })();
  const { results } = await c.env.DB.prepare(
    `SELECT strftime('%Y-%m', publication_date) AS month, COUNT(*) AS count
     FROM trade_policy_actions WHERE publication_date >= ?1 GROUP BY month ORDER BY month`
  )
    .bind(since)
    .all<TempoPoint>();
  return c.json({ months: results });
});

// Everything below is plain SQL aggregation over data already in D1 -- no
// Anthropic call, no external request, nothing that costs a token. This is
// the interpretation layer: instead of handing someone 4,000+ raw rows and
// asking them to draw conclusions, compute the handful of numbers an
// analyst would actually look for first (is activity accelerating, what
// kind of action is dominating right now, what's new).
pulseRoute.get('/summary', async (c) => {
  const trend = await c.env.DB.prepare(
    `SELECT
       SUM(CASE WHEN publication_date >= date('now', '-30 days') THEN 1 ELSE 0 END) AS last_30d,
       SUM(CASE WHEN publication_date < date('now', '-30 days') THEN 1 ELSE 0 END) AS prior_30d
     FROM trade_policy_actions
     WHERE publication_date >= date('now', '-60 days')`
  ).first<{ last_30d: number; prior_30d: number }>();

  const leadingTag = await c.env.DB.prepare(
    `SELECT tag, COUNT(*) AS n FROM trade_policy_actions
     WHERE publication_date >= date('now', '-30 days')
     GROUP BY tag ORDER BY n DESC LIMIT 1`
  ).first<{ tag: string; n: number }>();

  // Same (program, legal_basis, rate_type) grouping as /active-measures --
  // "new" means the real-world measure itself took effect recently, not
  // that a row was touched by a refresh (these are never auto-refreshed,
  // see src/scheduled.ts's header comment).
  const total = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM trade_policy_actions`).first<{ n: number }>();

  const newMeasures = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM (
       SELECT program, legal_basis, rate_type, MIN(effective_date) AS effective_date
       FROM tariff_overlays
       WHERE effective_date <= date('now') AND (expiration_date IS NULL OR expiration_date >= date('now'))
       GROUP BY program, legal_basis, rate_type
     ) WHERE effective_date >= date('now', '-90 days')`
  ).first<{ n: number }>();

  // `agency` is the Federal Register API's raw comma-joined list (e.g.
  // "Commerce Department, International Trade Administration"), not a
  // clean single field -- confirmed against real data before writing this.
  // A plain GROUP BY produces ~20 noisy rows including one 44-agency
  // omnibus string; taking just the first comma-segment was tried and
  // rejected -- it merges ITA and BIS both into "Commerce Department"
  // (verified: 123 combined vs. the correct 117/6 split), losing exactly
  // the AD/CVD-vs-export-control distinction the tagging logic in
  // lib/pulse/tag.ts exists to preserve. This instead matches against the
  // same 7 tracked agencies as lib/pulse/federalRegister.ts's AGENCY_SLUGS
  // (substring match, same technique as tag.ts's resolveAgencySlugs),
  // verified to produce exactly those 7 clean buckets.
  const agencyBreakdown = await c.env.DB.prepare(
    `WITH primary_agency AS (
       SELECT CASE
         WHEN agency LIKE '%International Trade Administration%' THEN 'International Trade Administration'
         WHEN agency LIKE '%International Trade Commission%' THEN 'International Trade Commission'
         WHEN agency LIKE '%Foreign Assets Control%' THEN 'Foreign Assets Control Office'
         WHEN agency LIKE '%Industry and Security%' THEN 'Industry and Security Bureau'
         WHEN agency LIKE '%Customs and Border%' THEN 'Customs and Border Protection'
         WHEN agency LIKE '%Trade Representative%' THEN 'Trade Representative'
         WHEN agency LIKE '%State Department%' THEN 'State Department'
         ELSE agency
       END AS agency
       FROM trade_policy_actions WHERE publication_date >= date('now', '-30 days')
     )
     SELECT agency, COUNT(*) AS n FROM primary_agency GROUP BY agency ORDER BY n DESC LIMIT 8`
  ).all<{ agency: string; n: number }>();

  // Country codes live in each row's `countries` JSON array (best-effort
  // text extraction, see lib/pulse/country.ts) -- json_each unpacks that
  // array per row so COUNT(*) here means "documents naming this country",
  // not "documents" (a document naming 3 countries counts once per country,
  // by design -- this is a coverage view, not a partition of the 30-day total).
  // Verified json_each works against this D1 instance before writing this.
  const countryBreakdown = await c.env.DB.prepare(
    `SELECT je.value AS country, COUNT(*) AS n
     FROM trade_policy_actions, json_each(countries) je
     WHERE publication_date >= date('now', '-30 days') AND countries IS NOT NULL AND countries != '[]'
     GROUP BY country ORDER BY n DESC LIMIT 40`
  ).all<{ country: string; n: number }>();

  // "Open for comment" = comments_close_on is set and hasn't passed --
  // directly answers the one question a trade attorney or affected company
  // actually needs a fast answer to: what can I still weigh in on right now.
  const openForComment = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM trade_policy_actions WHERE comments_close_on >= date('now')`
  ).first<{ n: number }>();

  const last30 = trend?.last_30d ?? 0;
  const prior30 = trend?.prior_30d ?? 0;
  const trendPct = prior30 > 0 ? Math.round(((last30 - prior30) / prior30) * 100) : null;

  return c.json({
    last30,
    prior30,
    trendPct,
    leadingTag: leadingTag?.tag ?? null,
    leadingTagCount: leadingTag?.n ?? 0,
    leadingTagShare: last30 > 0 && leadingTag ? Math.round((leadingTag.n / last30) * 100) : null,
    newMeasures90d: newMeasures?.n ?? 0,
    totalTracked: total?.n ?? 0,
    openForComment: openForComment?.n ?? 0,
    agencyBreakdown: agencyBreakdown.results.map((r) => ({ agency: r.agency, count: r.n })),
    countryBreakdown: countryBreakdown.results.map((r) => ({ country: r.country, count: r.n })),
  });
});

// tariff_overlays is curated at HTS-line/country granularity for the duty-
// stack module's per-code lookups (e.g. 60 separate country rows for the
// Section 301 forced-labor program alone) -- a status table needs one row
// per real-world measure, not one row per underlying line, so this groups
// by (program, legal_basis, rate_type): verified against the actual seeded
// data that those three columns are constant within each real measure
// (confirmed via a manual GROUP BY check before writing this), which is why
// MIN()/MAX() wrapping every other column here is safe rather than
// arbitrary-row-picking.
pulseRoute.get('/active-measures', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT
       program,
       legal_basis,
       rate_type,
       MIN(rate_pct) AS min_rate_pct,
       MAX(rate_pct) AS max_rate_pct,
       COUNT(*) AS line_count,
       MIN(hts_pattern) AS sample_hts,
       COUNT(DISTINCT country_scope) AS country_count,
       MIN(country_scope) AS sample_scope,
       MIN(effective_date) AS effective_date,
       MAX(expiration_date) AS expiration_date,
       MIN(source_url) AS source_url,
       MIN(data_as_of) AS data_as_of
     FROM tariff_overlays
     WHERE effective_date <= date('now') AND (expiration_date IS NULL OR expiration_date >= date('now'))
     GROUP BY program, legal_basis, rate_type
     ORDER BY program, legal_basis`
  ).all();
  return c.json({ overlays: results });
});

const FX_TTL_MS = 30 * 60_000;
const QUOTES_TTL_MS = 15 * 60_000; // Yahoo data is itself ~15 min delayed
const NEWS_TTL_MS = 30 * 60_000;

// First-ever request (empty table) waits for the refresh so the panel isn't
// blank; every later request answers from D1 immediately and refreshes in
// the background, so a stale cache never makes a page load slower.
async function refreshOnDemand(c: Context<{ Bindings: Env }>, tasks: Promise<void>[], tableIsEmpty: boolean) {
  const all = Promise.all(tasks).then(() => undefined);
  if (tableIsEmpty) {
    await all;
    return;
  }
  try {
    c.executionCtx.waitUntil(all);
  } catch {
    await all;
  }
}

interface SeriesRow {
  series_id: string;
  obs_date: string;
  value: number;
}

pulseRoute.get('/markets', async (c) => {
  const load = () =>
    c.env.DB.prepare(
      `SELECT series_id, obs_date, value FROM market_series
       WHERE obs_date >= date('now', '-130 days')
       ORDER BY series_id, obs_date DESC`
    ).all<SeriesRow>();

  const quotesOn = c.env.MARKET_QUOTES !== 'off';
  let { results } = await load();
  // Wait for the fetch (instead of refreshing in the background) whenever
  // FX or quote data is missing entirely, so a first visit after a deploy
  // isn't served a half-empty page.
  const hasQuotes = !quotesOn || results.some((r) => r.series_id === '^GSPC');
  const hasFx = results.some((r) => r.series_id.startsWith('FX:'));
  await refreshOnDemand(
    c,
    [
      refreshIfStale(c.env, 'fx', FX_TTL_MS, () => refreshFx(c.env)),
      ...(quotesOn ? [refreshIfStale(c.env, 'quotes', QUOTES_TTL_MS, () => refreshQuotes(c.env))] : []),
    ],
    !hasQuotes || !hasFx
  );
  if (!hasQuotes || !hasFx) ({ results } = await load());

  const bySeries = new Map<string, SeriesRow[]>();
  for (const r of results) {
    if (!bySeries.has(r.series_id)) bySeries.set(r.series_id, []);
    bySeries.get(r.series_id)!.push(r); // newest first
  }

  // Oldest-to-newest [date, value] pairs for charts: ~3 months of daily closes.
  const points = (rows: SeriesRow[], n: number): [string, number][] =>
    rows
      .slice(0, n)
      .map((r): [string, number] => [r.obs_date, r.value])
      .reverse();

  const tiles = (quotesOn ? MARKET_META : []).flatMap((m) => {
    const rows = bySeries.get(m.id);
    if (!rows || rows.length === 0) return [];
    const [latest, prev] = rows;
    const change = prev ? latest.value - prev.value : null;
    return [
      {
        id: m.id,
        label: m.label,
        group: m.group,
        unit: m.unit,
        source: m.source,
        sourceUrl: m.sourceUrl,
        value: latest.value,
        asOf: latest.obs_date,
        change,
        changePct: change !== null && prev && prev.value !== 0 && m.changeMode === 'percent' ? (change / prev.value) * 100 : null,
        changeMode: m.changeMode,
        points: points(rows, 70),
      },
    ];
  });

  const currencies = FX_META.flatMap((m) => {
    const rows = bySeries.get(m.id);
    if (!rows || rows.length === 0) return [];
    const latest = rows[0];
    // ~30-day comparison: the newest observation at or before 30 days prior to
    // the latest, else the oldest we have (early in a fresh backfill).
    const edge = new Date(Date.parse(latest.obs_date) - 30 * 86_400_000).toISOString().slice(0, 10);
    const base = rows.find((r) => r.obs_date <= edge) ?? rows[rows.length - 1];
    return [
      {
        quote: m.id.slice(3),
        label: m.label,
        rate: latest.value,
        asOf: latest.obs_date,
        change30dPct: base.obs_date !== latest.obs_date && base.value !== 0 ? ((latest.value - base.value) / base.value) * 100 : null,
        spark: rows
          .slice(0, 30)
          .map((r) => r.value)
          .reverse(),
      },
    ];
  });

  return c.json({ tiles, currencies });
});

const NEWS_CATEGORIES = ['Trade & Supply Chain', 'Markets & Currency', 'Elections & Politics', 'Official'];

pulseRoute.get('/news', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 30) || 30, 60);
  const requested = c.req.query('category') || null;
  const category = requested && NEWS_CATEGORIES.includes(requested) ? requested : null;

  const empty = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM world_news').first<{ n: number }>();
  await refreshOnDemand(c, [refreshIfStale(c.env, 'news', NEWS_TTL_MS, () => refreshNews(c.env))], (empty?.n ?? 0) === 0);

  const { results } = await c.env.DB.prepare(
    `SELECT id, title, summary, url, source, category, countries, published_at, image_url FROM world_news
     WHERE (?1 IS NULL OR category = ?1) ORDER BY published_at DESC LIMIT ?2`
  )
    .bind(category, limit)
    .all();
  const counts = await c.env.DB.prepare(
    `SELECT category, COUNT(*) AS n FROM world_news WHERE published_at >= date('now', '-7 days') GROUP BY category`
  ).all<{ category: string; n: number }>();
  const state = await c.env.DB.prepare(`SELECT last_success_at, last_note FROM pulse_feed_state WHERE source_key = 'news'`).first<{
    last_success_at: string | null;
    last_note: string | null;
  }>();

  const showImages = c.env.NEWS_IMAGES !== 'off';
  return c.json({
    items: showImages ? results : results.map((r) => ({ ...r, image_url: null })),
    counts: Object.fromEntries(counts.results.map((r) => [r.category, r.n])),
    lastSuccessAt: state?.last_success_at ?? null,
    note: state?.last_note ?? null,
  });
});

// Global cooldown, not per-caller -- Pulse's risk is Worker CPU/subrequest
// exhaustion from repeated Federal Register calls, a shared resource, not an
// abuse-by-one-IP risk (see CLAUDE_RATE_LIMITER on the /api/cases/* routes,
// which is IP-keyed for a different reason: capping per-caller Anthropic
// spend). The UPDATE...WHERE is an atomic compare-and-swap: two concurrent
// POSTs can't both see the cooldown as expired, because "claim the right to
// sync" and "check the cooldown" are the same statement, not two steps with
// a gap between them.
const SYNC_COOLDOWN_MS = 60_000;

pulseRoute.post('/sync', async (c) => {
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
pulseRoute.get('/home', async (c) => {
  const call = async <T>(path: string): Promise<T> => {
    const res = await pulseRoute.request(path, {}, c.env, c.executionCtx);
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
    settle('/feed?limit=100'),
    settle('/markets'),
    settle('/news?limit=60'),
  ]);

  const states = await c.env.DB.prepare('SELECT source_key, last_success_at FROM pulse_feed_state').all<{ source_key: string; last_success_at: string | null }>();
  const latest = await c.env.DB.prepare('SELECT MAX(fetched_at) AS t FROM trade_policy_actions').first<{ t: string | null }>();
  const at = (k: string) => states.results.find((r) => r.source_key === k)?.last_success_at ?? null;

  c.header('Cache-Control', 'public, max-age=60');
  return c.json({
    summary,
    tempo,
    overlays,
    recent,
    markets,
    news,
    status: { policy: latest?.t ?? null, news: at('news'), quotes: c.env.MARKET_QUOTES === 'off' ? null : at('quotes'), fx: at('fx') },
  });
});

// ---------------------------------------------------------------------------
// RSS 2.0 feed of U.S. trade actions -- the no-account way to "get alerts":
// paste the URL into any feed reader. Same filters as /feed (tag, country).
// Title, agency, document type and the Federal Register's own abstract only.
// ---------------------------------------------------------------------------
const xmlEscape = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

pulseRoute.get('/rss', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 30) || 30, 50);
  const tag = c.req.query('tag') || null;
  const country = c.req.query('country') || null;
  const { results } = await c.env.DB.prepare(
    `SELECT document_number, title, abstract, agency, doc_type, tag, publication_date, html_url FROM trade_policy_actions
     WHERE (?1 IS NULL OR tag = ?1) AND (?2 IS NULL OR countries LIKE '%"' || ?2 || '"%')
     ORDER BY publication_date DESC, document_number DESC LIMIT ?3`
  )
    .bind(tag, country, limit)
    .all<{ document_number: string; title: string; abstract: string | null; agency: string; doc_type: string; tag: string; publication_date: string; html_url: string }>();

  const origin = new URL(c.req.url).origin;
  const label = [tag, country].filter(Boolean).join(', ');
  const items = results
    .map((r) => {
      const desc = `${r.doc_type} (${r.tag}) from ${r.agency.split(', ').slice(0, 2).join(', ')}.${r.abstract ? ` ${r.abstract.slice(0, 300)}${r.abstract.length > 300 ? '…' : ''}` : ''}`;
      return `<item><title>${xmlEscape(r.title)}</title><link>${xmlEscape(r.html_url)}</link><guid isPermaLink="false">${xmlEscape(r.document_number)}</guid><pubDate>${new Date(`${r.publication_date}T12:00:00Z`).toUTCString()}</pubDate><category>${xmlEscape(r.tag)}</category><description>${xmlEscape(desc)}</description></item>`;
    })
    .join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${xmlEscape(`Trade Policy Pulse: U.S. trade actions${label ? ` (${label})` : ''}`)}</title><link>${xmlEscape(origin)}/</link><description>New U.S. tariff, sanctions, export-control and trade-agreement actions from the Federal Register.</description><language>en-us</language><atom:link href="${xmlEscape(c.req.url)}" rel="self" type="application/rss+xml"/>${items}</channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
});
