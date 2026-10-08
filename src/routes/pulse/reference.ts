import { Hono } from 'hono';
import type { Env } from '../../types/env.js';
import type { PulseApp } from './util.js';
import { clampInt } from './util.js';

export const referenceRoute: PulseApp = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Raw browsers over data the app otherwise only ever shows pre-aggregated:
// /tariffs is every individual tariff_overlays row (vs. /active-measures'
// per-program rollup and /summary's three-slice countryTariffs), /sanctions
// is a country-filterable SDN/CSL browser (this data has never been queried
// by country anywhere else in the app), /export-control-chart is the full
// Commerce Country Chart curation (vs. one country at a time via
// /country/:code). Plain pagination, no new aggregation logic.
// ---------------------------------------------------------------------------
referenceRoute.get('/tariffs', async (c) => {
  const program = c.req.query('program') || null;
  const country = c.req.query('country') || null;
  const limit = clampInt(c.req.query('limit'), { default: 50, min: 1, max: 200 });
  const offset = clampInt(c.req.query('offset'), { default: 0, min: 0 });

  const where = `(?1 IS NULL OR program = ?1) AND (?2 IS NULL OR country_scope = ?2)`;
  const [{ results }, total, programs] = await Promise.all([
    c.env.DB.prepare(
      `SELECT program, hts_pattern, country_scope, rate_pct, rate_type, legal_basis, effective_date, expiration_date, source_url, source_tier, data_as_of
       FROM tariff_overlays WHERE ${where}
       ORDER BY program, country_scope, hts_pattern LIMIT ?3 OFFSET ?4`
    )
      .bind(program, country, limit, offset)
      .all(),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM tariff_overlays WHERE ${where}`).bind(program, country).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT DISTINCT program FROM tariff_overlays ORDER BY program`).all<{ program: string }>(),
  ]);

  return c.json({ rows: results, total: total?.n ?? 0, limit, offset, programs: programs.results.map((r) => r.program) });
});

referenceRoute.get('/sanctions', async (c) => {
  // Same country-name-text-match caveat as /country/:code's sanctions
  // section: addresses.country is free text from OFAC/BIS source data, not a
  // normalized ISO code, so this matches a full country name, not a code.
  const countryName = c.req.query('country') || null;
  const list = c.req.query('list'); // 'sdn' | 'csl' | omitted = both
  const limit = clampInt(c.req.query('limit'), { default: 50, min: 1, max: 200 });
  const offset = clampInt(c.req.query('offset'), { default: 0, min: 0 });

  const sdnWhere = countryName ? `WHERE addresses LIKE '%' || ?1 || '%'` : '';
  const cslWhere = countryName ? `WHERE addresses LIKE '%' || ?1 || '%'` : '';
  const bind = countryName ? [countryName] : [];

  // SDN and CSL are two independent lists (and each list's own rows/total
  // queries are independent of each other too) -- run all of it concurrently
  // rather than up to 4 D1 round trips in sequence.
  const [sdn, csl] = await Promise.all([
    !list || list === 'sdn'
      ? (async () => {
          const [{ results }, total] = await Promise.all([
            c.env.DB.prepare(
              `SELECT id, primary_name AS name, entity_type, programs, addresses, source_url FROM sdn_entries ${sdnWhere}
               ORDER BY primary_name LIMIT ?${bind.length + 1} OFFSET ?${bind.length + 2}`
            )
              .bind(...bind, limit, offset)
              .all(),
            c.env.DB.prepare(`SELECT COUNT(*) AS n FROM sdn_entries ${sdnWhere}`)
              .bind(...bind)
              .first<{ n: number }>(),
          ]);
          return { rows: results.map((r) => ({ ...r, list: 'SDN' as const })), total: total?.n ?? 0 };
        })()
      : Promise.resolve({ rows: [], total: 0 }),

    !list || list === 'csl'
      ? (async () => {
          const [{ results }, total] = await Promise.all([
            c.env.DB.prepare(
              `SELECT id, name, source_list, license_requirement, addresses, source_url FROM csl_entries ${cslWhere}
               ORDER BY name LIMIT ?${bind.length + 1} OFFSET ?${bind.length + 2}`
            )
              .bind(...bind, limit, offset)
              .all(),
            c.env.DB.prepare(`SELECT COUNT(*) AS n FROM csl_entries ${cslWhere}`)
              .bind(...bind)
              .first<{ n: number }>(),
          ]);
          return { rows: results.map((r) => ({ ...r, list: 'CSL' as const })), total: total?.n ?? 0 };
        })()
      : Promise.resolve({ rows: [], total: 0 }),
  ]);

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

// NATO defense expenditure (% of GDP) -- a small, manually-curated,
// once-a-year reference dataset (see migrations/0018's header comment),
// stored in the same generic market_series tables as every live-fetched
// series but never auto-refreshed. Full history, same reasoning as /cofer.
referenceRoute.get('/nato-defense', async (c) => {
  const [series, meta] = await Promise.all([
    c.env.DB.prepare(`SELECT series_id, obs_date, value FROM market_series WHERE series_id LIKE 'NATO_DEFENSE_PCT:%' ORDER BY series_id, obs_date`).all<{
      series_id: string;
      obs_date: string;
      value: number;
    }>(),
    c.env.DB.prepare(`SELECT series_id, source, source_url, last_fetched_at FROM market_series_meta WHERE series_id LIKE 'NATO_DEFENSE_PCT:%'`).all<{
      series_id: string;
      source: string;
      source_url: string;
      last_fetched_at: string;
    }>(),
  ]);
  const byCountry: Record<string, { points: [string, number][]; source: string; sourceUrl: string; asOf: string }> = {};
  for (const m of meta.results) {
    const code = m.series_id.split(':')[1];
    byCountry[code] = { points: [], source: m.source, sourceUrl: m.source_url, asOf: m.last_fetched_at };
  }
  for (const s of series.results) {
    const code = s.series_id.split(':')[1];
    byCountry[code]?.points.push([s.obs_date, s.value]);
  }
  return c.json({ countries: byCountry });
});

// Full history, not the 430-day window /markets caps everything else to --
// COFER's real story (the dollar's declining reserve share) plays out over
// decades, not months, and this series is only ~110 rows total, so there's
// no reason to cap it.
referenceRoute.get('/cofer', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT obs_date, value FROM market_series WHERE series_id = 'COFER:USD_SHARE' ORDER BY obs_date`
  ).all<{ obs_date: string; value: number }>();
  return c.json({ points: results.map((r) => [r.obs_date, r.value]) });
});

referenceRoute.get('/export-control-chart', async (c) => {
  const [rows, coverage] = await Promise.all([
    c.env.DB.prepare(`SELECT * FROM country_chart ORDER BY country_name, reason_for_control`).all(),
    c.env.DB.prepare(`SELECT * FROM country_chart_coverage ORDER BY country_name`).all(),
  ]);
  return c.json({ rows: rows.results, coverage: coverage.results });
});

// Browsable list of Global Trade Alert interventions -- foreign governments'
// own trade-restrictive measures affecting the U.S. (see globalTradeAlert.ts
// for the exact ingestion scope). `country` matches GTA's own jurisdiction
// name exactly (e.g. "China", "Republic of Korea") -- a text match against a
// separately-curated name field, same disclosed-limitation pattern as
// /sanctions' address-text match, not a normalized code lookup.
referenceRoute.get('/gta', async (c) => {
  const countryName = c.req.query('country') || null;
  const limit = clampInt(c.req.query('limit'), { default: 50, min: 1, max: 200 });
  const offset = clampInt(c.req.query('offset'), { default: 0, min: 0 });

  const where = countryName
    ? `WHERE EXISTS (SELECT 1 FROM json_each(implementing_jurisdictions) je WHERE json_extract(je.value, '$.name') = ?1)`
    : '';
  const bind = countryName ? [countryName] : [];

  const [{ results }, total] = await Promise.all([
    c.env.DB.prepare(
      `SELECT intervention_id, state_act_title, intervention_url, state_act_url, gta_evaluation, implementing_jurisdictions,
              implementing_jurisdiction_groups, intervention_type, mast_chapter, date_announced, date_implemented, date_removed, is_in_force
       FROM gta_interventions ${where}
       ORDER BY date_announced DESC LIMIT ?${bind.length + 1} OFFSET ?${bind.length + 2}`
    )
      .bind(...bind, limit, offset)
      .all(),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM gta_interventions ${where}`)
      .bind(...bind)
      .first<{ n: number }>(),
  ]);

  return c.json({
    rows: results,
    total: total?.n ?? 0,
    limit,
    offset,
    note: 'Independent research data from Global Trade Alert (globaltradealert.org), not a U.S. government source. Limited to measures evaluated as harmful or likely-harmful to foreign commercial interests, affecting the United States, announced in roughly the last 3 years.',
  });
});

// Browsable list of CBP Withhold Release Orders & Findings (Section 307
// forced-labor enforcement) -- see migrations/0017's header comment for why
// this, not the newer DHS UFLPA Entity List, is what this app ingests in
// bulk. `country` matches the ISO alpha-2 code CBP's own CSV already uses,
// same code this app uses everywhere else -- no name-matching caveat needed
// here, unlike /gta.
referenceRoute.get('/wro', async (c) => {
  const country = c.req.query('country')?.toUpperCase() || null;
  const status = c.req.query('status') || null; // 'Active' | omitted = all
  const limit = clampInt(c.req.query('limit'), { default: 50, min: 1, max: 200 });
  const offset = clampInt(c.req.query('offset'), { default: 0, min: 0 });

  const where = `(?1 IS NULL OR country_code = ?1) AND (?2 IS NULL OR status = ?2)`;
  const [{ results }, total] = await Promise.all([
    c.env.DB.prepare(
      `SELECT id, effective_date, country_code, country, merchandise, order_type, industry, status, entity, remarks, source_url
       FROM wro_findings WHERE ${where}
       ORDER BY effective_date DESC LIMIT ?3 OFFSET ?4`
    )
      .bind(country, status, limit, offset)
      .all(),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM wro_findings WHERE ${where}`).bind(country, status).first<{ n: number }>(),
  ]);

  return c.json({
    rows: results,
    total: total?.n ?? 0,
    limit,
    offset,
    note: 'CBP Withhold Release Orders & Findings (Section 307, 19 U.S.C. 1307) -- a different, broader and older program than the DHS UFLPA Entity List, which this app does not ingest in bulk (see dhs.gov/uflpa-entity-list for that specific list).',
  });
});
