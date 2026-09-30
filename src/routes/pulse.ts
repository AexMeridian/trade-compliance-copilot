import { Hono, type Context } from 'hono';
import type { Env } from '../types/env.js';
import { runPulseSync } from '../lib/pulse/sync.js';
import { MARKET_META, FX_META, refreshQuotes, refreshFx } from '../lib/pulse/markets.js';
import { MACRO_META, refreshMacro } from '../lib/pulse/macro.js';
import { COFER_META, refreshCofer } from '../lib/pulse/cofer.js';
import { refreshNews } from '../lib/pulse/news.js';
import { refreshIfStale } from '../lib/pulse/refreshLazy.js';
import { logRefresh } from '../lib/refresh/log.js';
import type { PulseAction, TempoPoint } from '../lib/pulse/types.js';
import { getRateBearingHtsLine, getApplicableOverlays, getCountryCoverage, getCountryChartRows } from '../lib/db.js';
import { buildDutyStack } from '../lib/dutyStack.js';

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
  // Default (24) preserves every existing caller's behavior unchanged --
  // /home calls this unparameterized. Clamped so a bad query string can't
  // request an unbounded scan.
  const months = Math.min(Math.max(Number(c.req.query('months') ?? 24) || 24, 6), 120);
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
pulseRoute.get('/summary', async (c) => {
  const trend = await c.env.DB.prepare(
    `SELECT
       SUM(CASE WHEN publication_date >= date('now', '-30 days') THEN 1 ELSE 0 END) AS last_30d,
       SUM(CASE WHEN publication_date < date('now', '-30 days') THEN 1 ELSE 0 END) AS prior_30d
     FROM trade_policy_actions
     WHERE publication_date >= date('now', '-60 days')`
  ).first<{ last_30d: number; prior_30d: number }>();

  // A second, longer comparison window -- 90 vs. prior 90 days -- smooths
  // over the noise of any single busy or quiet week that the 30-day figure
  // above is more exposed to. Same shape, same "no baseline yet" handling.
  const trend90 = await c.env.DB.prepare(
    `SELECT
       SUM(CASE WHEN publication_date >= date('now', '-90 days') THEN 1 ELSE 0 END) AS last_90d,
       SUM(CASE WHEN publication_date < date('now', '-90 days') THEN 1 ELSE 0 END) AS prior_90d
     FROM trade_policy_actions
     WHERE publication_date >= date('now', '-180 days')`
  ).first<{ last_90d: number; prior_90d: number }>();

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
  const forcedLabor = await c.env.DB.prepare(
    `SELECT country_scope AS country, rate_pct AS ratePct, source_url AS sourceUrl, data_as_of AS asOf
     FROM tariff_overlays WHERE program = 'sec301_forced_labor' AND ${activeOverlay}
     ORDER BY rate_pct DESC, country_scope`
  ).all<{ country: string; ratePct: number; sourceUrl: string; asOf: string }>();
  const canadaExtra = await c.env.DB.prepare(
    `SELECT country_scope AS country, MAX(rate_pct) AS ratePct, MIN(source_url) AS sourceUrl
     FROM tariff_overlays WHERE program = 'sec338_canada' AND ${activeOverlay} GROUP BY country_scope`
  ).all<{ country: string; ratePct: number; sourceUrl: string }>();
  const metalsCap = await c.env.DB.prepare(
    `SELECT country_scope AS country, rate_pct AS ratePct, source_url AS sourceUrl
     FROM tariff_overlays WHERE program = 'sec232_metals_country_cap' AND ${activeOverlay}
     ORDER BY country_scope`
  ).all<{ country: string; ratePct: number; sourceUrl: string }>();
  const metalsBaseline = await c.env.DB.prepare(
    `SELECT MAX(rate_pct) AS n FROM tariff_overlays
     WHERE program IN ('sec232_steel','sec232_aluminum','sec232_copper') AND country_scope IS NULL AND ${activeOverlay}`
  ).first<{ n: number | null }>();

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

// A small, disclosed sample of real HTS headings that already carry Section
// 232/301/338 overlay coverage -- NOT the full ~31,000-line schedule. Picked
// to span the programs that actually vary by country (metals, autos, plus one
// plain consumer good to show what Section 301's forced-labor determination
// alone looks like on something with no metals/auto exposure). Every code
// below is a real, loaded hts_lines row, verified against the local database
// before being hardcoded here.
const REPRESENTATIVE_HTS: { htsno: string; label: string }[] = [
  { htsno: '7208.10.30.00', label: 'Steel, flat-rolled (Chapter 72)' },
  { htsno: '7601.10.30.00', label: 'Aluminum, unwrought (Chapter 76)' },
  { htsno: '7403.11.00.00', label: 'Copper cathodes (Chapter 74)' },
  { htsno: '8703.23.01', label: 'Passenger vehicles, 1,500-3,000cc (Chapter 87)' },
  { htsno: '8708.10.30', label: 'Motor vehicle bumpers (Chapter 87)' },
  { htsno: '6109.10.00', label: 'Cotton T-shirts (Chapter 61)' },
];

// ---------------------------------------------------------------------------
// Everything real, sourced data this app has about one country, in one call:
// full action history and tempo (not just a 30-day window -- the whole
// dataset is small enough that "all of it" is the honest default for a
// single country's slice), the tariff programs it faces, a bulk duty-stack
// sample across REPRESENTATIVE_HTS (buildDutyStack already exists and is
// already correct -- this just loops it, no new math), export-control chart
// status, and a sanctioned-entity count. Each section is independent, same
// philosophy as /home: one section's failure never blanks the others.
// ---------------------------------------------------------------------------
pulseRoute.get('/country/:code', async (c) => {
  const code = c.req.param('code').toUpperCase();
  // The frontend already resolves code -> full display name from its own
  // label maps (pulseCountries.ts + pulseTariffCountries.ts) before it ever
  // calls this endpoint, so it's passed through rather than duplicated here.
  // Without it, the sanctions text-match below is skipped rather than
  // matched against a bare 2-letter code, which would false-positive
  // constantly against free-text OFAC/BIS address data (e.g. "IN" inside
  // "Inc" or a street name) -- a wrong count is worse than a disclosed gap.
  const countryName = c.req.query('name') || null;
  const activeOverlay = `effective_date <= date('now') AND (expiration_date IS NULL OR expiration_date >= date('now'))`;

  const actions = await c.env.DB.prepare(
    `SELECT * FROM trade_policy_actions WHERE countries LIKE '%"' || ?1 || '"%'
     ORDER BY publication_date DESC, document_number DESC LIMIT 200`
  )
    .bind(code)
    .all<PulseAction>()
    .catch(() => ({ results: [] as PulseAction[] }));

  const tempo = await c.env.DB.prepare(
    `SELECT strftime('%Y-%m', publication_date) AS month, COUNT(*) AS count
     FROM trade_policy_actions, json_each(countries) je
     WHERE je.value = ?1 GROUP BY month ORDER BY month`
  )
    .bind(code)
    .all<TempoPoint>()
    .catch(() => ({ results: [] as TempoPoint[] }));

  const forcedLabor = await c.env.DB.prepare(
    `SELECT rate_pct AS ratePct, source_url AS sourceUrl, data_as_of AS asOf, legal_basis AS legalBasis
     FROM tariff_overlays WHERE program = 'sec301_forced_labor' AND country_scope = ?1 AND ${activeOverlay}`
  )
    .bind(code)
    .first<{ ratePct: number; sourceUrl: string; asOf: string; legalBasis: string }>()
    .catch(() => null);
  const extra = await c.env.DB.prepare(
    `SELECT rate_pct AS ratePct, source_url AS sourceUrl, legal_basis AS legalBasis, data_as_of AS asOf
     FROM tariff_overlays WHERE program = 'sec338_canada' AND country_scope = ?1 AND ${activeOverlay}`
  )
    .bind(code)
    .all<{ ratePct: number; sourceUrl: string; legalBasis: string; asOf: string }>()
    .catch(() => ({ results: [] }));
  const capped = await c.env.DB.prepare(
    `SELECT rate_pct AS ratePct, source_url AS sourceUrl, legal_basis AS legalBasis, data_as_of AS asOf
     FROM tariff_overlays WHERE program = 'sec232_metals_country_cap' AND country_scope = ?1 AND ${activeOverlay}`
  )
    .bind(code)
    .first<{ ratePct: number; sourceUrl: string; legalBasis: string; asOf: string }>()
    .catch(() => null);
  const metalsBaseline = await c.env.DB.prepare(
    `SELECT MAX(rate_pct) AS n FROM tariff_overlays
     WHERE program IN ('sec232_steel','sec232_aluminum','sec232_copper') AND country_scope IS NULL AND ${activeOverlay}`
  )
    .first<{ n: number | null }>()
    .catch(() => null);

  const dutyStack = await Promise.all(
    REPRESENTATIVE_HTS.map(async ({ htsno, label }) => {
      try {
        const hts = await getRateBearingHtsLine(c.env, htsno);
        if (!hts) return { htsno, label, description: null, totalPct: null, lines: [], error: 'This HTS line is not in the loaded schedule.' };
        const overlays = await getApplicableOverlays(c.env, htsno, code);
        const result = buildDutyStack(hts, code, null, overlays);
        return { htsno, label, description: hts.description, totalPct: result.totalPct, lines: result.lines, error: null };
      } catch {
        return { htsno, label, description: null, totalPct: null, lines: [], error: 'Could not compute this line right now.' };
      }
    })
  );

  const coverage = await getCountryCoverage(c.env, code).catch(() => null);
  const chartRows = coverage ? await getCountryChartRows(c.env, code).catch(() => []) : [];

  const sanctions = countryName
    ? await (async () => {
        const [sdn, csl] = await Promise.all([
          c.env.DB.prepare(`SELECT COUNT(*) AS n FROM sdn_entries WHERE addresses LIKE '%' || ?1 || '%'`)
            .bind(countryName)
            .first<{ n: number }>()
            .catch(() => null),
          c.env.DB.prepare(`SELECT COUNT(*) AS n FROM csl_entries WHERE addresses LIKE '%' || ?1 || '%'`)
            .bind(countryName)
            .first<{ n: number }>()
            .catch(() => null),
        ]);
        return {
          sdnCount: sdn?.n ?? null,
          cslCount: csl?.n ?? null,
          note: 'Text match on the OFAC/BIS address field, not a normalized country code -- see the full sanctions list for exact hits.',
        };
      })()
    : { sdnCount: null, cslCount: null, note: 'No country name provided, so this was skipped rather than matched against a bare 2-letter code.' };

  return c.json({
    code,
    actions: actions.results,
    tempo: tempo.results,
    tariffs: {
      forcedLabor: forcedLabor ? { ratePct: forcedLabor.ratePct, sourceUrl: forcedLabor.sourceUrl, asOf: forcedLabor.asOf, legalBasis: forcedLabor.legalBasis } : null,
      extra: extra.results.map((r) => ({ ratePct: r.ratePct, sourceUrl: r.sourceUrl, legalBasis: r.legalBasis, asOf: r.asOf, note: 'alcoholic beverages, dairy and motor vehicles only' })),
      capped: capped ? { ratePct: capped.ratePct, standardPct: metalsBaseline?.n ?? null, sourceUrl: capped.sourceUrl, legalBasis: capped.legalBasis, note: 'steel, aluminum and copper only' } : null,
    },
    dutyStack,
    exportControl: {
      status: coverage?.status ?? 'not_curated',
      notes: coverage?.notes ?? null,
      sourceUrl: coverage?.source_url ?? null,
      lastUpdated: coverage?.last_updated ?? null,
      rows: chartRows,
    },
    sanctions,
  });
});

// ---------------------------------------------------------------------------
// Raw browsers over data the app otherwise only ever shows pre-aggregated:
// /tariffs is every individual tariff_overlays row (vs. /active-measures'
// per-program rollup and /summary's three-slice countryTariffs), /sanctions
// is a country-filterable SDN/CSL browser (this data has never been queried
// by country anywhere else in the app), /export-control-chart is the full
// Commerce Country Chart curation (vs. one country at a time via
// /country/:code). Plain pagination, no new aggregation logic.
// ---------------------------------------------------------------------------
pulseRoute.get('/tariffs', async (c) => {
  const program = c.req.query('program') || null;
  const country = c.req.query('country') || null;
  const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 50) || 50, 1), 200);
  const offset = Math.max(Number(c.req.query('offset') ?? 0) || 0, 0);

  const where = `(?1 IS NULL OR program = ?1) AND (?2 IS NULL OR country_scope = ?2)`;
  const { results } = await c.env.DB.prepare(
    `SELECT program, hts_pattern, country_scope, rate_pct, rate_type, legal_basis, effective_date, expiration_date, source_url, source_tier, data_as_of
     FROM tariff_overlays WHERE ${where}
     ORDER BY program, country_scope, hts_pattern LIMIT ?3 OFFSET ?4`
  )
    .bind(program, country, limit, offset)
    .all();
  const total = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM tariff_overlays WHERE ${where}`).bind(program, country).first<{ n: number }>();
  const programs = await c.env.DB.prepare(`SELECT DISTINCT program FROM tariff_overlays ORDER BY program`).all<{ program: string }>();

  return c.json({ rows: results, total: total?.n ?? 0, limit, offset, programs: programs.results.map((r) => r.program) });
});

pulseRoute.get('/sanctions', async (c) => {
  // Same country-name-text-match caveat as /country/:code's sanctions
  // section: addresses.country is free text from OFAC/BIS source data, not a
  // normalized ISO code, so this matches a full country name, not a code.
  const countryName = c.req.query('country') || null;
  const list = c.req.query('list'); // 'sdn' | 'csl' | omitted = both
  const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 50) || 50, 1), 200);
  const offset = Math.max(Number(c.req.query('offset') ?? 0) || 0, 0);

  const sdnWhere = countryName ? `WHERE addresses LIKE '%' || ?1 || '%'` : '';
  const cslWhere = countryName ? `WHERE addresses LIKE '%' || ?1 || '%'` : '';
  const bind = countryName ? [countryName] : [];

  const sdn =
    !list || list === 'sdn'
      ? await (async () => {
          const { results } = await c.env.DB.prepare(
            `SELECT id, primary_name AS name, entity_type, programs, addresses, source_url FROM sdn_entries ${sdnWhere}
             ORDER BY primary_name LIMIT ?${bind.length + 1} OFFSET ?${bind.length + 2}`
          )
            .bind(...bind, limit, offset)
            .all();
          const total = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM sdn_entries ${sdnWhere}`)
            .bind(...bind)
            .first<{ n: number }>();
          return { rows: results.map((r) => ({ ...r, list: 'SDN' as const })), total: total?.n ?? 0 };
        })()
      : { rows: [], total: 0 };

  const csl =
    !list || list === 'csl'
      ? await (async () => {
          const { results } = await c.env.DB.prepare(
            `SELECT id, name, source_list, license_requirement, addresses, source_url FROM csl_entries ${cslWhere}
             ORDER BY name LIMIT ?${bind.length + 1} OFFSET ?${bind.length + 2}`
          )
            .bind(...bind, limit, offset)
            .all();
          const total = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM csl_entries ${cslWhere}`)
            .bind(...bind)
            .first<{ n: number }>();
          return { rows: results.map((r) => ({ ...r, list: 'CSL' as const })), total: total?.n ?? 0 };
        })()
      : { rows: [], total: 0 };

  return c.json({
    sdn: { rows: sdn.rows, total: sdn.total },
    csl: { rows: csl.rows, total: csl.total },
    limit,
    offset,
    note: countryName
      ? 'Text match on the OFAC/BIS address field, not a normalized country code.'
      : 'No country filter applied -- showing entries in name order.',
  });
});

// Full history, not the 430-day window /markets caps everything else to --
// COFER's real story (the dollar's declining reserve share) plays out over
// decades, not months, and this series is only ~110 rows total, so there's
// no reason to cap it.
pulseRoute.get('/cofer', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT obs_date, value FROM market_series WHERE series_id = 'COFER:USD_SHARE' ORDER BY obs_date`
  ).all<{ obs_date: string; value: number }>();
  return c.json({ points: results.map((r) => [r.obs_date, r.value]) });
});

pulseRoute.get('/export-control-chart', async (c) => {
  const [rows, coverage] = await Promise.all([
    c.env.DB.prepare(`SELECT * FROM country_chart ORDER BY country_name, reason_for_control`).all(),
    c.env.DB.prepare(`SELECT * FROM country_chart_coverage ORDER BY country_name`).all(),
  ]);
  return c.json({ rows: rows.results, coverage: coverage.results });
});

const FX_TTL_MS = 30 * 60_000;
const QUOTES_TTL_MS = 15 * 60_000; // Yahoo data is itself ~15 min delayed
const NEWS_TTL_MS = 30 * 60_000;
const MACRO_TTL_MS = 6 * 60 * 60_000; // BLS publishes monthly; this just bounds the keyless daily-query budget
const COFER_TTL_MS = 24 * 60 * 60_000; // IMF publishes quarterly; this just bounds the keyless daily-query budget

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
  // How many daily points each tile's chart series carries -- default (70,
  // ~3 months) is unchanged for every existing caller; a range selector on
  // the frontend can request more, up to as much as market_series retains.
  const days = Math.min(Math.max(Number(c.req.query('days') ?? 70) || 70, 30), 430);
  const load = () =>
    c.env.DB.prepare(
      `SELECT series_id, obs_date, value FROM market_series
       WHERE obs_date >= date('now', '-430 days')
       ORDER BY series_id, obs_date DESC`
    ).all<SeriesRow>();

  const quotesOn = c.env.MARKET_QUOTES !== 'off';
  let { results } = await load();
  // Wait for the fetch (instead of refreshing in the background) whenever
  // FX, quote or macro data is missing entirely, so a first visit after a
  // deploy isn't served a half-empty page.
  const hasQuotes = !quotesOn || results.some((r) => r.series_id === '^GSPC');
  const hasFx = results.some((r) => r.series_id.startsWith('FX:'));
  const hasMacro = results.some((r) => r.series_id.startsWith('BLS:'));
  const hasCofer = results.some((r) => r.series_id === 'COFER:USD_SHARE');
  await refreshOnDemand(
    c,
    [
      refreshIfStale(c.env, 'fx', FX_TTL_MS, () => refreshFx(c.env)),
      ...(quotesOn ? [refreshIfStale(c.env, 'quotes', QUOTES_TTL_MS, () => refreshQuotes(c.env))] : []),
      refreshIfStale(c.env, 'macro', MACRO_TTL_MS, () => refreshMacro(c.env)),
      refreshIfStale(c.env, 'cofer', COFER_TTL_MS, () => refreshCofer(c.env)),
    ],
    !hasQuotes || !hasFx || !hasMacro || !hasCofer
  );
  if (!hasQuotes || !hasFx || !hasMacro || !hasCofer) ({ results } = await load());

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

  const tiles = [...(quotesOn ? MARKET_META : []), ...MACRO_META, COFER_META].flatMap((m) => {
    const rows = bySeries.get(m.id);
    if (!rows || rows.length === 0) return [];
    const [latest, prev] = rows;
    const change = prev ? latest.value - prev.value : null;
    // Year-over-year, for the monthly macro series: the newest observation at
    // or before 360 days prior to the latest one. Not meaningful for daily
    // market data (a "year ago" stock price is a different kind of fact than
    // "up 3 months"), so only computed for the Macro group.
    let yoyChangePct: number | null = null;
    if (m.group === 'Macro') {
      const edge = new Date(Date.parse(latest.obs_date) - 360 * 86_400_000).toISOString().slice(0, 10);
      const base = rows.find((r) => r.obs_date <= edge);
      if (base && base.obs_date !== latest.obs_date && base.value !== 0 && m.changeMode === 'percent') {
        yoyChangePct = ((latest.value - base.value) / base.value) * 100;
      }
    }
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
        yoyChangePct,
        points: points(rows, days),
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
    recent,
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
