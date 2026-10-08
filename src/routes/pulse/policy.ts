import { Hono } from 'hono';
import type { Env } from '../../types/env.js';
import type { PulseAction, TempoPoint } from '../../lib/pulse/types.js';
import type { PulseApp } from './util.js';
import { clampInt, csvParam } from './util.js';

export const policyRoute: PulseApp = new Hono<{ Bindings: Env }>();

policyRoute.get('/feed', async (c) => {
  const limit = clampInt(c.req.query('limit'), { default: 30, min: 1, max: 100 });
  const tags = csvParam(c.req.query('tag'));
  const keywords = csvParam(c.req.query('q'));
  // `countries` is stored as a JSON array string, e.g. '["CN","MX"]' -- the
  // quotes around the code in the LIKE pattern anchor the match to a whole
  // array element, so a 2-letter code can't accidentally match inside a
  // longer one. Each of tags/keywords/countries below is matched as an OR
  // across the whole list (any match keeps the row), via json_each over the
  // *requested* list rather than building one `?N` placeholder per value --
  // that keeps the query text (and its positional param count) fixed
  // regardless of how many comma-separated values were passed.
  const countries = csvParam(c.req.query('country'));
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM trade_policy_actions
     WHERE (?1 = '[]' OR EXISTS (SELECT 1 FROM json_each(?1) je WHERE tag = je.value))
       AND (?2 = '[]' OR EXISTS (SELECT 1 FROM json_each(?2) je WHERE title LIKE '%' || je.value || '%' OR abstract LIKE '%' || je.value || '%'))
       AND (?3 = '[]' OR EXISTS (SELECT 1 FROM json_each(?3) je WHERE countries LIKE '%"' || je.value || '"%'))
     ORDER BY publication_date DESC, document_number DESC LIMIT ?4`
  )
    .bind(JSON.stringify(tags), JSON.stringify(keywords), JSON.stringify(countries), limit)
    .all<PulseAction>();
  return c.json({ actions: results });
});

// Backs About.tsx's per-source coverage claim ("tracked here since...") with
// a real MIN() over each source's own table, instead of a guessed date --
// this project's standing rule against inventing figures applies just as
// much to a date as to a dollar amount.
policyRoute.get('/coverage', async (c) => {
  const [fedReg, news, bySource] = await Promise.all([
    c.env.DB.prepare(`SELECT MIN(publication_date) AS min_date FROM trade_policy_actions`).first<{ min_date: string | null }>(),
    c.env.DB.prepare(`SELECT MIN(published_at) AS min_date FROM world_news`).first<{ min_date: string | null }>(),
    c.env.DB.prepare(
      `SELECT meta.source AS source, MIN(ms.obs_date) AS min_date
       FROM market_series ms JOIN market_series_meta meta ON meta.series_id = ms.series_id
       GROUP BY meta.source`
    ).all<{ source: string; min_date: string }>(),
  ]);
  const bySourceMap: Record<string, string> = {};
  for (const row of bySource.results) bySourceMap[row.source] = row.min_date;
  return c.json({
    federal_register: fedReg?.min_date ?? null,
    // world_news.published_at is a full ISO timestamp, not a bare date like
    // every other source's obs_date/publication_date -- trimmed to match so
    // About.tsx doesn't show a stray time-of-day for this one entry alone.
    news: news?.min_date ? news.min_date.slice(0, 10) : null,
    yahoo_finance: bySourceMap['Yahoo Finance'] ?? null,
    ecb_fx: bySourceMap['Frankfurter (ECB reference rates)'] ?? null,
    bls: bySourceMap['U.S. Bureau of Labor Statistics'] ?? null,
    imf_cofer: bySourceMap['IMF COFER'] ?? null,
  });
});

policyRoute.get('/tempo', async (c) => {
  // Default (24) preserves every existing caller's behavior unchanged --
  // /home calls this unparameterized. Clamped so a bad query string can't
  // request an unbounded scan.
  const months = clampInt(c.req.query('months'), { default: 24, min: 6, max: 120 });
  const since = (() => {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - months);
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
policyRoute.get('/summary', async (c) => {
  // Every query below reads a different slice of already-populated tables and
  // none depends on another's result -- run them all concurrently rather than
  // paying for the sum of ~12 D1 round trips on this endpoint (which /home
  // also calls internally on every page load).
  const trendP = c.env.DB.prepare(
    `SELECT
       SUM(CASE WHEN publication_date >= date('now', '-30 days') THEN 1 ELSE 0 END) AS last_30d,
       SUM(CASE WHEN publication_date < date('now', '-30 days') THEN 1 ELSE 0 END) AS prior_30d
     FROM trade_policy_actions
     WHERE publication_date >= date('now', '-60 days')`
  ).first<{ last_30d: number; prior_30d: number }>();

  // A second, longer comparison window -- 90 vs. prior 90 days -- smooths
  // over the noise of any single busy or quiet week that the 30-day figure
  // above is more exposed to. Same shape, same "no baseline yet" handling.
  const trend90P = c.env.DB.prepare(
    `SELECT
       SUM(CASE WHEN publication_date >= date('now', '-90 days') THEN 1 ELSE 0 END) AS last_90d,
       SUM(CASE WHEN publication_date < date('now', '-90 days') THEN 1 ELSE 0 END) AS prior_90d
     FROM trade_policy_actions
     WHERE publication_date >= date('now', '-180 days')`
  ).first<{ last_90d: number; prior_90d: number }>();

  const leadingTagP = c.env.DB.prepare(
    `SELECT tag, COUNT(*) AS n FROM trade_policy_actions
     WHERE publication_date >= date('now', '-30 days')
     GROUP BY tag ORDER BY n DESC LIMIT 1`
  ).first<{ tag: string; n: number }>();

  // Same (program, legal_basis, rate_type) grouping as /active-measures --
  // "new" means the real-world measure itself took effect recently, not
  // that a row was touched by a refresh (these are never auto-refreshed,
  // see src/scheduled.ts's header comment).
  const totalP = c.env.DB.prepare(`SELECT COUNT(*) AS n FROM trade_policy_actions`).first<{ n: number }>();

  const newMeasuresP = c.env.DB.prepare(
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
  const agencyBreakdownP = c.env.DB.prepare(
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
  const countryBreakdownP = c.env.DB.prepare(
    `SELECT je.value AS country, COUNT(*) AS n
     FROM trade_policy_actions, json_each(countries) je
     WHERE publication_date >= date('now', '-30 days') AND countries IS NOT NULL AND countries != '[]'
     GROUP BY country ORDER BY n DESC LIMIT 40`
  ).all<{ country: string; n: number }>();

  // "Open for comment" = comments_close_on is set and hasn't passed --
  // directly answers the one question a trade attorney or affected company
  // actually needs a fast answer to: what can I still weigh in on right now.
  const openForCommentP = c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM trade_policy_actions WHERE comments_close_on >= date('now')`
  ).first<{ n: number }>();

  // Real tariff exposure by country, from tariff_overlays -- a genuinely
  // different (and more decision-relevant) question than countryBreakdown
  // above, which only counts how often a country's name appears in document
  // text. Section 301's forced-labor determination is the one program here
  // that's both country-specific AND broad (Chapters 1-97, not one product
  // category), so it's the only one used to rank/size bars; Section 338
  // (Canada) and the Section 232 metals country caps are real but narrower
  // (3 HTS chapters; steel/aluminum/copper only) or a *reduction* rather than
  // added pressure, so they're returned as separate notes instead of being
  // folded into one misleadingly-precise "total rate" number.
  const activeOverlay = `effective_date <= date('now') AND (expiration_date IS NULL OR expiration_date >= date('now'))`;
  const forcedLaborP = c.env.DB.prepare(
    `SELECT country_scope AS country, rate_pct AS ratePct, source_url AS sourceUrl, data_as_of AS asOf
     FROM tariff_overlays WHERE program = 'sec301_forced_labor' AND ${activeOverlay}
     ORDER BY rate_pct DESC, country_scope`
  ).all<{ country: string; ratePct: number; sourceUrl: string; asOf: string }>();
  const canadaExtraP = c.env.DB.prepare(
    `SELECT country_scope AS country, MAX(rate_pct) AS ratePct, MIN(source_url) AS sourceUrl
     FROM tariff_overlays WHERE program = 'sec338_canada' AND ${activeOverlay} GROUP BY country_scope`
  ).all<{ country: string; ratePct: number; sourceUrl: string }>();
  const metalsCapP = c.env.DB.prepare(
    `SELECT country_scope AS country, rate_pct AS ratePct, source_url AS sourceUrl
     FROM tariff_overlays WHERE program = 'sec232_metals_country_cap' AND ${activeOverlay}
     ORDER BY country_scope`
  ).all<{ country: string; ratePct: number; sourceUrl: string }>();
  const metalsBaselineP = c.env.DB.prepare(
    `SELECT MAX(rate_pct) AS n FROM tariff_overlays
     WHERE program IN ('sec232_steel','sec232_aluminum','sec232_copper') AND country_scope IS NULL AND ${activeOverlay}`
  ).first<{ n: number | null }>();

  const [
    trend,
    trend90,
    leadingTag,
    total,
    newMeasures,
    agencyBreakdown,
    countryBreakdown,
    openForComment,
    forcedLabor,
    canadaExtra,
    metalsCap,
    metalsBaseline,
  ] = await Promise.all([
    trendP,
    trend90P,
    leadingTagP,
    totalP,
    newMeasuresP,
    agencyBreakdownP,
    countryBreakdownP,
    openForCommentP,
    forcedLaborP,
    canadaExtraP,
    metalsCapP,
    metalsBaselineP,
  ]);

  const last30 = trend?.last_30d ?? 0;
  const prior30 = trend?.prior_30d ?? 0;
  const trendPct = prior30 > 0 ? Math.round(((last30 - prior30) / prior30) * 100) : null;

  const last90 = trend90?.last_90d ?? 0;
  const prior90 = trend90?.prior_90d ?? 0;
  const trendPct90 = prior90 > 0 ? Math.round(((last90 - prior90) / prior90) * 100) : null;

  return c.json({
    last30,
    prior30,
    trendPct,
    last90,
    prior90,
    trendPct90,
    leadingTag: leadingTag?.tag ?? null,
    leadingTagCount: leadingTag?.n ?? 0,
    leadingTagShare: last30 > 0 && leadingTag ? Math.round((leadingTag.n / last30) * 100) : null,
    newMeasures90d: newMeasures?.n ?? 0,
    totalTracked: total?.n ?? 0,
    openForComment: openForComment?.n ?? 0,
    agencyBreakdown: agencyBreakdown.results.map((r) => ({ agency: r.agency, count: r.n })),
    countryBreakdown: countryBreakdown.results.map((r) => ({ country: r.country, count: r.n })),
    countryTariffs: {
      forcedLabor: forcedLabor.results,
      extra: canadaExtra.results.map((r) => ({
        country: r.country,
        ratePct: r.ratePct,
        program: 'Section 338',
        note: 'alcoholic beverages, dairy and motor vehicles only',
        sourceUrl: r.sourceUrl,
      })),
      capped: metalsCap.results.map((r) => ({
        country: r.country,
        ratePct: r.ratePct,
        standardPct: metalsBaseline?.n ?? null,
        program: 'Section 232 country cap',
        note: 'steel, aluminum and copper only',
        sourceUrl: r.sourceUrl,
      })),
    },
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
policyRoute.get('/active-measures', async (c) => {
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
