// Global Trade Alert (globaltradealert.org) -- an independent (University of
// St. Gallen-affiliated) database of countries' own trade-policy
// interventions, free for non-commercial use (CC BY-NC 4.0), covering 60+
// jurisdictions since 2009. This is the one external source in this app that
// is NOT a government API: it's third-party research data, and every surface
// that shows it says so explicitly (see CountryDetail.tsx's panel copy).
//
// Requires a free self-serve API key (globaltradealert.org/api-access) --
// set as GLOBAL_TRADE_ALERT_API_KEY. Unlike BLS, there is no keyless tier:
// without a key this refresh simply no-ops, the same pattern markets.ts uses
// for MARKET_QUOTES="off".
//
// Request/response contract verified against the project's own published
// docs (github.com/global-trade-alert/docs, .api/gta-data.md and
// .api/gta-value-mappings.md) before writing this, not guessed:
//   POST https://api.globaltradealert.org/api/v1/data/
//   Authorization: APIKey <key>
//   { limit, offset, sorting, request_data: { <filters> } }
// `affected`/`implementer` filters take UN/ISO-3166-1 *numeric* jurisdiction
// codes (840 = United States), not ISO alpha-2 -- confirmed directly against
// several known values in gta-value-mappings.md (China=156, Germany=276,
// Mexico=484, etc., which are the standard ISO 3166-1 numeric codes).
//
// Scope: interventions that (a) affect the United States, (b) were
// implemented by one of a curated list of major U.S. trading partners (the
// same set this app already gives dedicated tariff/export-control attention
// to), and (c) are evaluated Red or Amber -- GTA's own two "discriminatory
// against foreign commercial interests" ratings (gta_evaluation 1/2 in
// gta-value-mappings.md) -- i.e. a foreign government's own restrictive/
// retaliatory measures, not liberalising ones (3). Bounded to the last 3
// years: GTA's own archive goes back to 2009, but this app surfaces "what's
// happening now," not the full historical record.
//
// The `implementer` filter isn't just relevance filtering -- it's load-
// bearing: live-tested against the real endpoint, filtering on `affected:
// [840]` alone (no implementer scope) returns 1000+ rows for just the last
// ~8 months (every minor/subnational measure anywhere that happens to touch
// the U.S.), hitting this free key's own discovered rate limit of 1000 total
// output entries per 24h in a single call. Scoping to major partners cuts
// this to a manageable, genuinely "handful of partners" dataset and leaves
// headroom under that daily cap for the rest of this key's 24h window.
import type { Env } from '../../types/env.js';
import { sqlString, sqlJson, buildInsertStatements } from '../refresh/sql.js';
import type { RefreshResult } from '../refresh/types.js';
import { changeGate } from '../refresh/changeGate.js';

const API_URL = 'https://api.globaltradealert.org/api/v1/data/';
const REQUEST_TIMEOUT_MS = 15_000;
const US_NUMERIC_CODE = 840;
const HARMFUL_EVALUATIONS = [1, 2]; // Red, Amber
export const YEARS_BACK = 3;
const REQUEST_LIMIT = 200; // well under the 1000-entries/24h cap this key hit in testing

// GTA jurisdiction numeric IDs (ISO 3166-1 numeric -- confirmed against
// github.com/global-trade-alert/docs' .api/gta-value-mappings.md) for the
// major U.S. trading partners this app already tracks tariff/export-control
// data for. Deliberately a short, named list, not every GTA jurisdiction --
// see the header comment above for why breadth here isn't free.
const MAJOR_PARTNER_IDS = [
  156, // China
  484, // Mexico
  124, // Canada
  276, // Germany
  392, // Japan
  410, // Republic of Korea
  699, // India
  704, // Vietnam
  826, // United Kingdom
  76, // Brazil
  756, // Switzerland
  643, // Russia
  792, // Turkiye
  36, // Australia
];

interface GtaJurisdiction {
  id: number;
  name: string;
  iso: string;
}

interface GtaRecord {
  intervention_id: number;
  state_act_title: string;
  intervention_url: string;
  state_act_url: string;
  gta_evaluation: string;
  implementing_jurisdictions: GtaJurisdiction[];
  implementing_jurisdiction_groups?: { name: string }[];
  intervention_type: string;
  mast_chapter: string;
  date_announced: string | null;
  date_implemented: string | null;
  date_removed: string | null;
  is_in_force: number;
}

export async function refreshGlobalTradeAlert(env: Env): Promise<RefreshResult> {
  if (!env.GLOBAL_TRADE_ALERT_API_KEY) {
    return { source: 'gta', rows: 0 };
  }

  const since = new Date();
  since.setUTCFullYear(since.getUTCFullYear() - YEARS_BACK);

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `APIKey ${env.GLOBAL_TRADE_ALERT_API_KEY}` },
    body: JSON.stringify({
      limit: REQUEST_LIMIT,
      offset: 0,
      sorting: '-date_announced',
      request_data: {
        affected: [US_NUMERIC_CODE],
        implementer: MAJOR_PARTNER_IDS,
        gta_evaluation: HARMFUL_EVALUATIONS,
        // The docs' own example shows an open end-date as `""`, but the live
        // API rejects that (400: "List of dates in `%Y-%m-%d` format
        // expected") and only accepts `null` -- verified against the real
        // endpoint, not assumed from the example.
        announcement_period: [since.toISOString().slice(0, 10), null],
      },
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Global Trade Alert fetch failed: HTTP ${res.status}`);
  const records = (await res.json()) as GtaRecord[];

  if (records.length === 0) {
    // Could be a legitimate empty window, but a full-reload table can't tell
    // "genuinely nothing happened" apart from "something broke upstream" --
    // same rule as every other full-reload job here: abort rather than wipe
    // a real table down to zero rows on an ambiguous empty response.
    throw new Error('Global Trade Alert refresh produced zero records -- aborting without touching gta_interventions');
  }

  const gate = await changeGate(env, 'gta', JSON.stringify(records));
  if (gate.unchanged) return { source: 'gta', rows: 0, unchanged: true };

  const now = new Date().toISOString();
  const rows = records.map(
    (r) =>
      `(${r.intervention_id}, ${sqlString(r.state_act_title)}, ${sqlString(r.intervention_url)}, ${sqlString(r.state_act_url)}, ` +
      `${sqlString(r.gta_evaluation)}, ${sqlJson(r.implementing_jurisdictions)}, ${sqlJson(r.implementing_jurisdiction_groups ?? null)}, ` +
      `${sqlString(r.intervention_type)}, ${sqlString(r.mast_chapter)}, ${sqlString(r.date_announced)}, ${sqlString(r.date_implemented)}, ` +
      `${sqlString(r.date_removed)}, ${r.is_in_force ? 1 : 0}, ${sqlString(now)})`
  );

  const statements = buildInsertStatements(
    `INSERT INTO gta_interventions (intervention_id, state_act_title, intervention_url, state_act_url, gta_evaluation, implementing_jurisdictions, implementing_jurisdiction_groups, intervention_type, mast_chapter, date_announced, date_implemented, date_removed, is_in_force, last_synced_at) VALUES`,
    rows,
    150
  );

  await env.DB.batch([env.DB.prepare('DELETE FROM gta_interventions'), ...statements.map((s) => env.DB.prepare(s))]);

  await gate.commit();
  return { source: 'gta', rows: records.length };
}
