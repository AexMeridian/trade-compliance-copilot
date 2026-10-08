import { Hono } from 'hono';
import type { Env } from '../../types/env.js';
import type { PulseAction, TempoPoint } from '../../lib/pulse/types.js';
import { getRateBearingHtsLine, getApplicableOverlays, getCountryCoverage, getCountryChartRows } from '../../lib/db.js';
import { buildDutyStack } from '../../lib/dutyStack.js';
import type { PulseApp } from './util.js';
import { slimAction } from './util.js';

export const countryRoute: PulseApp = new Hono<{ Bindings: Env }>();

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
countryRoute.get('/country/:code', async (c) => {
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

  // Every section below is an independent read (dutyStack/coverage/sanctions
  // already run their own internal steps concurrently) -- fetched together
  // with Promise.all instead of one D1 round trip at a time, since none of
  // these sections depends on another's result.
  const [actions, tempo, forcedLabor, extra, capped, metalsBaseline, dutyStack, { coverage, chartRows }, sanctions, retaliatoryMeasures, wroFindings, snapshot] = await Promise.all([
    c.env.DB.prepare(
      `SELECT * FROM trade_policy_actions WHERE countries LIKE '%"' || ?1 || '"%'
       ORDER BY publication_date DESC, document_number DESC LIMIT 100`
    )
      .bind(code)
      .all<PulseAction>()
      .catch(() => ({ results: [] as PulseAction[] })),

    c.env.DB.prepare(
      `SELECT strftime('%Y-%m', publication_date) AS month, COUNT(*) AS count
       FROM trade_policy_actions, json_each(countries) je
       WHERE je.value = ?1 GROUP BY month ORDER BY month`
    )
      .bind(code)
      .all<TempoPoint>()
      .catch(() => ({ results: [] as TempoPoint[] })),

    c.env.DB.prepare(
      `SELECT rate_pct AS ratePct, source_url AS sourceUrl, data_as_of AS asOf, legal_basis AS legalBasis
       FROM tariff_overlays WHERE program = 'sec301_forced_labor' AND country_scope = ?1 AND ${activeOverlay}`
    )
      .bind(code)
      .first<{ ratePct: number; sourceUrl: string; asOf: string; legalBasis: string }>()
      .catch(() => null),

    c.env.DB.prepare(
      `SELECT rate_pct AS ratePct, source_url AS sourceUrl, legal_basis AS legalBasis, data_as_of AS asOf
       FROM tariff_overlays WHERE program = 'sec338_canada' AND country_scope = ?1 AND ${activeOverlay}`
    )
      .bind(code)
      .all<{ ratePct: number; sourceUrl: string; legalBasis: string; asOf: string }>()
      .catch(() => ({ results: [] })),

    c.env.DB.prepare(
      `SELECT rate_pct AS ratePct, source_url AS sourceUrl, legal_basis AS legalBasis, data_as_of AS asOf
       FROM tariff_overlays WHERE program = 'sec232_metals_country_cap' AND country_scope = ?1 AND ${activeOverlay}`
    )
      .bind(code)
      .first<{ ratePct: number; sourceUrl: string; legalBasis: string; asOf: string }>()
      .catch(() => null),

    c.env.DB.prepare(
      `SELECT MAX(rate_pct) AS n FROM tariff_overlays
       WHERE program IN ('sec232_steel','sec232_aluminum','sec232_copper') AND country_scope IS NULL AND ${activeOverlay}`
    )
      .first<{ n: number | null }>()
      .catch(() => null),

    Promise.all(
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
    ),

    (async () => {
      const coverage = await getCountryCoverage(c.env, code).catch(() => null);
      const chartRows = coverage ? await getCountryChartRows(c.env, code).catch(() => []) : [];
      return { coverage, chartRows };
    })(),

    countryName
      ? (async () => {
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
      : Promise.resolve({ sdnCount: null, cslCount: null, note: 'No country name provided, so this was skipped rather than matched against a bare 2-letter code.' }),

    countryName
      ? (async () => {
          const [{ results }, total] = await Promise.all([
            c.env.DB.prepare(
              `SELECT intervention_id, state_act_title, intervention_url, gta_evaluation, intervention_type, date_announced
               FROM gta_interventions
               WHERE EXISTS (SELECT 1 FROM json_each(implementing_jurisdictions) je WHERE json_extract(je.value, '$.name') = ?1)
               ORDER BY date_announced DESC LIMIT 10`
            )
              .bind(countryName)
              .all()
              .catch(() => ({ results: [] })),
            c.env.DB.prepare(
              `SELECT COUNT(*) AS n FROM gta_interventions
               WHERE EXISTS (SELECT 1 FROM json_each(implementing_jurisdictions) je WHERE json_extract(je.value, '$.name') = ?1)`
            )
              .bind(countryName)
              .first<{ n: number }>()
              .catch(() => null),
          ]);
          return { rows: results, total: total?.n ?? 0 };
        })()
      : Promise.resolve({ rows: [], total: 0 }),

    (async () => {
      const [{ results }, total] = await Promise.all([
        c.env.DB.prepare(
          `SELECT id, effective_date, merchandise, order_type, status, entity, remarks
           FROM wro_findings WHERE country_code = ?1 ORDER BY effective_date DESC LIMIT 20`
        )
          .bind(code)
          .all()
          .catch(() => ({ results: [] })),
        c.env.DB.prepare(`SELECT COUNT(*) AS n FROM wro_findings WHERE country_code = ?1`)
          .bind(code)
          .first<{ n: number }>()
          .catch(() => null),
      ]);
      return { rows: results, total: total?.n ?? 0 };
    })(),

    // Baseline region/income/capital/population/GDP facts (migration
    // 0022) -- the one section of this response that exists for every
    // country this app's globe can select, not just the ones with U.S.
    // trade-policy history. Missing for a handful of codes the World Bank
    // itself has no entry for (Taiwan, a few small/disputed territories);
    // null here, same as every other "not available" field in this route.
    c.env.DB.prepare(
      `SELECT region, income_level AS incomeLevel, capital_city AS capitalCity, population, population_year AS populationYear,
              gdp_usd AS gdpUsd, gdp_year AS gdpYear, source_url AS sourceUrl, last_updated AS lastUpdated
       FROM country_snapshot WHERE country_code = ?1`
    )
      .bind(code)
      .first<{
        region: string;
        incomeLevel: string;
        capitalCity: string | null;
        population: number | null;
        populationYear: string | null;
        gdpUsd: number | null;
        gdpYear: string | null;
        sourceUrl: string;
        lastUpdated: string;
      }>()
      .catch(() => null),
  ]);

  return c.json({
    code,
    // The query is capped at the newest 100; the monthly tempo counts every action, so its sum is the true total.
    actions: actions.results.map(slimAction),
    actionsTotal: tempo.results.reduce((n, m) => n + m.count, 0),
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
    retaliatoryMeasures: {
      ...retaliatoryMeasures,
      note: countryName
        ? 'Independent research data from Global Trade Alert (globaltradealert.org), not a U.S. government source -- measures this country has taken that GTA evaluates as harmful or likely-harmful to foreign commercial interests, affecting the United States, in roughly the last 3 years. Matched on GTA\'s own jurisdiction name, which can differ slightly from this country\'s display name.'
        : 'No country name provided, so this was skipped rather than matched against a bare 2-letter code.',
    },
    forcedLaborEnforcement: {
      ...wroFindings,
      note: 'CBP Withhold Release Orders & Findings (Section 307, 19 U.S.C. 1307) naming this country -- a different, broader and older program than the DHS UFLPA Entity List, which this app does not ingest in bulk. Includes historical as well as active orders; check the status on each.',
    },
    snapshot: snapshot
      ? {
          region: snapshot.region,
          incomeLevel: snapshot.incomeLevel,
          capitalCity: snapshot.capitalCity,
          population: snapshot.population,
          populationYear: snapshot.populationYear,
          gdpUsd: snapshot.gdpUsd,
          gdpYear: snapshot.gdpYear,
          sourceUrl: snapshot.sourceUrl,
          lastUpdated: snapshot.lastUpdated,
        }
      : null,
  });
});
