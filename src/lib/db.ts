import type { Env } from '../types/env.js';

// Common low-signal words in plain-English product descriptions. Left in,
// they win bm25 ties against the one or two genuinely distinctive terms
// (e.g. a query for a "vacuum-insulated ... bottle for household use" can
// get out-ranked by unrelated rows that happen to also say "household" and
// "use" while never mentioning vacuum vessels at all) -- stripping them
// measurably improved retrieval during this build's golden-case testing.
const FTS_STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'for', 'with', 'without', 'in', 'on', 'at', 'to', 'from',
  'is', 'are', 'be', 'as', 'by', 'that', 'this', 'it', 'its', 'other', 'not', 'used', 'use', 'uses',
  'having', 'containing', 'consisting', 'such', 'each', 'all', 'any', 'single', 'unit', 'sold',
  'household', 'general', 'purpose', 'made', 'designed', 'whether',
]);

/** Turns free-text into a permissive FTS5 MATCH expression: quoted terms OR'd
 * together (so a query matches rows containing ANY of the meaningful words,
 * ranked by bm25 -- appropriate for a plain-English product description where
 * requiring every word to match would too easily return zero candidates).
 * Stopwords are dropped so common filler doesn't dilute bm25 ranking away
 * from the few genuinely distinctive terms in a short description. */
export function toFtsQuery(text: string): string {
  const terms = ftsTerms(text);
  if (terms.length === 0) return '""'; // matches nothing
  return terms.map((t) => `"${t}"`).join(' OR ');
}

function ftsTerms(text: string): string[] {
  const terms = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !FTS_STOPWORDS.has(t));
  return terms.length === 0 ? [] : [...new Set(terms)];
}

export interface HtsCandidateRow {
  id: number;
  htsno: string;
  description: string;
  indent: number;
  superior_id: number | null;
  units: string;
  general_rate: string;
  special_rate: string;
  other_rate: string;
  footnotes: string;
  chapter: string;
  revision: string;
  source_url: string;
  source_tier: number;
  last_updated: string;
  score: number;
}

/** Runs one bm25-ranked MATCH against an FTS table, returning content-table rowids. */
async function ftsMatchIds(env: Env, ftsTable: string, whereExtra: string, fts: string, limit: number): Promise<number[]> {
  const { results } = await env.DB.prepare(
    `SELECT ${ftsTable}.rowid AS id FROM ${ftsTable} ${whereExtra}
     WHERE ${ftsTable} MATCH ?1 ORDER BY bm25(${ftsTable}) LIMIT ?2`
  )
    .bind(fts, limit)
    .all<{ id: number }>();
  return results.map((r) => r.id);
}

/**
 * A plain OR'd bm25 query alone systematically buries the single best match
 * for a query's one truly distinctive word beneath rows that merely match
 * two-or-more of its common words (e.g. a "vacuum-insulated ... bottle"
 * query can rank dozens of unrelated "Of stainless steel" rows above the
 * heading that actually says "vacuum flasks and other vacuum vessels" --
 * bm25's length normalization and per-term summation both favor matching
 * more terms over matching one rare, on-topic term). Fix: run the combined
 * OR query first for broad recall, then also run each individual query term
 * on its own and take its own top matches, so the best candidate for a rare
 * distinctive word always makes the final candidate set. This is a general
 * retrieval fix (a standard way to keep a common term's document frequency
 * from swamping a rarer, more on-topic one's), not a per-case patch -- and
 * the total is capped so a long description can't balloon the candidate set.
 */
async function mergedFtsCandidateIds(
  env: Env,
  ftsTable: string,
  whereExtra: string,
  query: string,
  limit: number,
  perTermLimit = 15
): Promise<number[]> {
  const orderedIds: number[] = [];
  const seen = new Set<number>();
  const addAll = (ids: number[]) => {
    for (const id of ids) {
      if (!seen.has(id)) {
        seen.add(id);
        orderedIds.push(id);
      }
    }
  };

  addAll(await ftsMatchIds(env, ftsTable, whereExtra, toFtsQuery(query), limit));
  for (const term of ftsTerms(query)) {
    addAll(await ftsMatchIds(env, ftsTable, whereExtra, `"${term}"`, perTermLimit));
  }
  // A generous safety ceiling only, not a tight budget -- each per-term slice
  // must keep its own full headroom (e.g. reaching a distinctive term's 13th-
  // ranked match) rather than lose it to an early term's results filling a
  // small shared cap first. Dedup already keeps the typical case well below
  // this; capped at 80 (not higher) because D1/SQLite bind params top out at
  // ?100 and the id list is later used as an IN(...) parameter list.
  return orderedIds.slice(0, 80);
}

export async function searchHts(env: Env, query: string, limit = 25): Promise<HtsCandidateRow[]> {
  const ids = await mergedFtsCandidateIds(env, 'hts_search', `JOIN hts_lines h ON h.id = hts_search.rowid AND h.htsno != ''`, query, limit);
  if (ids.length === 0) return [];
  const placeholders = ids.map((_, i) => `?${i + 1}`).join(',');
  const { results } = await env.DB.prepare(
    `SELECT id, htsno, description, indent, superior_id, units, general_rate, special_rate,
            other_rate, footnotes, chapter, revision, source_url, source_tier, last_updated, 0 as score
     FROM hts_lines WHERE id IN (${placeholders})`
  )
    .bind(...ids)
    .all<HtsCandidateRow>();
  // Preserve retrieval-order ranking (the SQL IN() clause does not).
  const byId = new Map(results.map((r) => [r.id, r]));
  const ordered = ids.map((id) => byId.get(id)).filter((r): r is HtsCandidateRow => !!r);
  // Real headroom beyond what's already matched, so children actually get pulled in
  // (a cap equal to the current count would make expandWithChildren's gate a no-op).
  return expandWithChildren(env, ordered, ordered.length + 15);
}

/**
 * HTS subheading/statistical-suffix rows often carry terse own-text ("Seed",
 * "Other", "Other household") that doesn't repeat the product name from
 * higher up the hierarchy, so a plain-text FTS match can land on the wrong
 * row within a group of siblings that are only distinguishable in context.
 * E.g. for a plain (non-child's) wooden dining chair, the only leaf whose own
 * text contains "chair" is "9401.69.60.01 Chairs for children, including
 * highchairs" -- its actual sibling "9401.69.60.11 Other household" (the
 * correct answer) has no literal term overlap with the query at all. Two
 * expansions fix this, both via the existing superior_id column (cheap, and
 * keeps the grounding guarantee -- still only real D1 rows): pull each
 * matched row's direct CHILDREN (e.g. a matched heading like "1201 Soybeans"
 * surfacing its subheadings 1201.10/1201.90), and pull each matched row's
 * SIBLINGS (other rows sharing its own superior_id) so a match on one leaf in
 * a terse group brings the rest of that group -- the live GRI choice set --
 * along with it.
 */
async function expandWithChildren(env: Env, rows: HtsCandidateRow[], cap: number): Promise<HtsCandidateRow[]> {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const groupIds = new Set<number>();
  for (const r of rows) {
    groupIds.add(r.id); // pull children of this row
    if (r.superior_id !== null) groupIds.add(r.superior_id); // pull siblings of this row
  }
  if (groupIds.size === 0) return rows;

  const idList = [...groupIds].slice(0, 90); // D1 bind-param ceiling (?1..?100)
  const placeholders = idList.map((_, i) => `?${i + 1}`).join(',');
  const { results: related } = await env.DB.prepare(
    `SELECT id, htsno, description, indent, superior_id, units, general_rate, special_rate,
            other_rate, footnotes, chapter, revision, source_url, source_tier, last_updated, 0 as score
     FROM hts_lines WHERE superior_id IN (${placeholders}) AND htsno != ''`
  )
    .bind(...idList)
    .all<HtsCandidateRow>();

  for (const r of related) {
    if (byId.size >= cap) break;
    if (!byId.has(r.id)) byId.set(r.id, r);
  }
  return [...byId.values()];
}

export interface ScheduleBCandidateRow {
  id: number;
  code: string;
  description: string;
  hs6: string;
  chapter: string;
  edition: string;
  source_url: string;
  source_tier: number;
  last_updated: string;
  score: number;
}

export async function getHtsLineByCode(env: Env, htsno: string): Promise<HtsCandidateRow | null> {
  const row = await env.DB.prepare(`SELECT *, 0 as score FROM hts_lines WHERE htsno = ?1`).bind(htsno).first<HtsCandidateRow>();
  return row ?? null;
}

async function getHtsLineById(env: Env, id: number): Promise<HtsCandidateRow | null> {
  const row = await env.DB.prepare(`SELECT *, 0 as score FROM hts_lines WHERE id = ?1`).bind(id).first<HtsCandidateRow>();
  return row ?? null;
}

/**
 * The HTS's own exportList data only carries general/special/other rates on
 * the 8-digit line; 10-digit statistical-suffix lines (the leaves the
 * classifier actually selects, e.g. "8708.10.60.10") are pure reporting
 * breakouts with blank rate columns in the source data. This walks up
 * superior_id until it finds a line with a non-blank general_rate, so the
 * duty stack reads the real applicable rate rather than an empty string.
 * Verified against live HTS data during this build (see dutyStack.ts).
 */
export async function getRateBearingHtsLine(env: Env, htsno: string): Promise<HtsCandidateRow | null> {
  let line = await getHtsLineByCode(env, htsno);
  let hops = 0;
  while (line && line.general_rate.trim() === '' && line.superior_id !== null && hops < 10) {
    line = await getHtsLineById(env, line.superior_id);
    hops++;
  }
  return line;
}

/**
 * Schedule B's own commodity-description text is the real, unedited Census
 * source file -- but Census's descriptions are sometimes terser than the
 * HTS's, to the point a genuinely on-topic line can be missing the one word
 * a query needs (e.g. Schedule B 9617.00.2000's own text is literally "FLASK
 * AND OTHER VESSELS, COMPLETE WITH CASES" -- Census's own file drops "VACUUM"
 * that the parallel HTS heading text includes). Rather than editing Census's
 * text (which the spec says never to do), cross-pollinate: also run the same
 * search against the HTS index and pull in any Schedule B line sharing an
 * HS-6 prefix with a matched HTS row. Schedule B and HTS share the same
 * international HS-6 nomenclature by construction (see hts_schedule_b_xref),
 * so this is a principled use of one schedule's richer text to compensate
 * for the other's terser text at the same HS-6 level -- not a fabrication.
 */
export async function searchScheduleB(env: Env, query: string, limit = 25): Promise<ScheduleBCandidateRow[]> {
  const directIds = await mergedFtsCandidateIds(
    env,
    'schedule_b_search',
    'JOIN schedule_b_lines s ON s.id = schedule_b_search.rowid',
    query,
    limit
  );

  const htsIds = await mergedFtsCandidateIds(env, 'hts_search', `JOIN hts_lines h ON h.id = hts_search.rowid AND h.htsno != ''`, query, limit);
  let hs6ViaHts: string[] = [];
  if (htsIds.length > 0) {
    const placeholders = htsIds.map((_, i) => `?${i + 1}`).join(',');
    const { results: htsRows } = await env.DB.prepare(`SELECT htsno FROM hts_lines WHERE id IN (${placeholders})`)
      .bind(...htsIds)
      .all<{ htsno: string }>();
    hs6ViaHts = [...new Set(htsRows.map((r) => r.htsno.replace(/\./g, '').slice(0, 6)).filter((h) => h.length === 6))];
  }

  // Two independent row-fetch queries, merged in JS, rather than one shared
  // id list capped to fit a single D1 bind-limited IN(...) query -- direct
  // FTS matches alone can already fill such a shared cap (Schedule B has
  // plenty of low-relevance matches on common terms), which would starve the
  // hs6 cross-pollination of any room at all regardless of where the cap is set.
  const directPlaceholders = directIds.map((_, i) => `?${i + 1}`).join(',');
  const directRows =
    directIds.length > 0
      ? (
          await env.DB.prepare(
            `SELECT id, code, description, hs6, chapter, edition, source_url, source_tier, last_updated, 0 as score
             FROM schedule_b_lines WHERE id IN (${directPlaceholders})`
          )
            .bind(...directIds)
            .all<ScheduleBCandidateRow>()
        ).results
      : [];

  const byId = new Map(directRows.map((r) => [r.id, r]));
  if (hs6ViaHts.length > 0) {
    const placeholders = hs6ViaHts.map((_, i) => `?${i + 1}`).join(',');
    const { results: xrefRows } = await env.DB.prepare(
      `SELECT id, code, description, hs6, chapter, edition, source_url, source_tier, last_updated, 0 as score
       FROM schedule_b_lines WHERE hs6 IN (${placeholders})`
    )
      .bind(...hs6ViaHts)
      .all<ScheduleBCandidateRow>();
    for (const r of xrefRows) if (!byId.has(r.id)) byId.set(r.id, r);
  }

  const directOrder = directIds.map((id) => byId.get(id)).filter((r): r is ScheduleBCandidateRow => !!r);
  const xrefOnly = [...byId.values()].filter((r) => !directIds.includes(r.id));
  return [...directOrder, ...xrefOnly];
}

export async function getCrossReferenceForHts(env: Env, htsno: string, limit = 10): Promise<string[]> {
  const { results } = await env.DB.prepare(
    `SELECT DISTINCT schedule_b_code FROM hts_schedule_b_xref WHERE hts_htsno = ?1 LIMIT ?2`
  )
    .bind(htsno, limit)
    .all<{ schedule_b_code: string }>();
  return results.map((r) => r.schedule_b_code);
}

export async function getCrossReferenceForScheduleB(env: Env, code: string, limit = 10): Promise<string[]> {
  const { results } = await env.DB.prepare(
    `SELECT DISTINCT hts_htsno FROM hts_schedule_b_xref WHERE schedule_b_code = ?1 LIMIT ?2`
  )
    .bind(code, limit)
    .all<{ hts_htsno: string }>();
  return results.map((r) => r.hts_htsno);
}

export interface UsmcaRuleRow {
  id: number;
  hts_chapter: string;
  heading_pattern: string;
  rule_type: string;
  tariff_shift_text: string | null;
  rvc_threshold_pct: number | null;
  rvc_method: string | null;
  de_minimis_pct: number | null;
  citation: string;
  source_url: string;
  source_tier: number;
  last_updated: string;
  notes: string | null;
}

/** Finds the most specific curated USMCA rule for a resolved HTS/Schedule-B code:
 * tries the longest heading_pattern prefix match first, falling back to the bare
 * chapter. Returns null (never a guess) if nothing is curated for this heading. */
export async function findUsmcaRule(env: Env, code: string): Promise<UsmcaRuleRow | null> {
  const digits = code.replace(/\./g, '');
  const chapter = digits.slice(0, 2);
  const { results } = await env.DB.prepare(`SELECT * FROM usmca_rules WHERE hts_chapter = ?1`)
    .bind(chapter)
    .all<UsmcaRuleRow>();
  if (results.length === 0) return null;
  // Prefer the row whose heading_pattern is the longest prefix of the code's digits.
  const scored = results
    .map((r) => ({ r, plen: digits.startsWith(r.heading_pattern) ? r.heading_pattern.length : -1 }))
    .filter((x) => x.plen >= 0)
    .sort((a, b) => b.plen - a.plen);
  return scored.length ? scored[0].r : null;
}

export interface EccnCandidateRow {
  id: number;
  eccn: string;
  category: string;
  product_group: string;
  description: string;
  reasons_for_control: string;
  license_exceptions: string;
  citation: string;
  source_url: string;
  source_tier: number;
  last_updated: string;
  score: number;
}

/**
 * Same per-term retrieval fix as searchHts/searchScheduleB (see the comment
 * on mergedFtsCandidateIds): a combined OR query alone can bury the one row
 * that matches a rare, on-topic word beneath rows matching several common
 * ones. The curated ECCN table is tiny (a handful of rows), so this mostly
 * just guarantees full recall rather than changing rankings in practice --
 * but it costs nothing and keeps retrieval logic consistent across every
 * classification-style search in this file rather than leaving one table on
 * the older, known-lossier query shape. No sibling/child expansion here:
 * unlike hts_lines, eccn_entries has no hierarchy to expand into.
 */
export async function searchEccn(env: Env, query: string, limit = 15): Promise<EccnCandidateRow[]> {
  const ids = await mergedFtsCandidateIds(env, 'eccn_search', 'JOIN eccn_entries e ON e.id = eccn_search.rowid', query, limit);
  if (ids.length === 0) return [];
  const placeholders = ids.map((_, i) => `?${i + 1}`).join(',');
  const { results } = await env.DB.prepare(
    `SELECT id, eccn, category, product_group, description, reasons_for_control,
            license_exceptions, citation, source_url, source_tier, last_updated, 0 as score
     FROM eccn_entries WHERE id IN (${placeholders})`
  )
    .bind(...ids)
    .all<EccnCandidateRow>();
  const byId = new Map(results.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is EccnCandidateRow => !!r);
}

export async function getEccnByCode(env: Env, code: string): Promise<EccnCandidateRow | null> {
  const row = await env.DB.prepare(`SELECT *, 0 as score FROM eccn_entries WHERE eccn = ?1`)
    .bind(code)
    .first<EccnCandidateRow>();
  return row ?? null;
}

export interface CountryChartRow {
  country_code: string;
  reason_for_control: string;
  control_level: string;
  source_url: string;
  source_tier: number;
  last_updated: string;
}

export interface CountryCoverageRow {
  country_code: string;
  country_name: string;
  status: 'curated' | 'comprehensive_embargo' | 'broad_restriction_746_5' | 'not_curated';
  notes: string | null;
  source_url: string;
  source_tier: number;
  last_updated: string;
}

export async function getCountryCoverage(env: Env, countryCode: string): Promise<CountryCoverageRow | null> {
  const row = await env.DB.prepare(`SELECT * FROM country_chart_coverage WHERE country_code = ?1`)
    .bind(countryCode)
    .first<CountryCoverageRow>();
  return row ?? null; // absence => implicitly 'not_curated', per migration 0003's documented default
}

export async function getCountryChartRows(env: Env, countryCode: string): Promise<CountryChartRow[]> {
  const { results } = await env.DB.prepare(`SELECT * FROM country_chart WHERE country_code = ?1`)
    .bind(countryCode)
    .all<CountryChartRow>();
  return results;
}

export interface TariffOverlayRow {
  id: number;
  program: string;
  hts_pattern: string;
  country_scope: string | null;
  rate_pct: number | null;
  rate_type: string;
  legal_basis: string;
  effective_date: string;
  expiration_date: string | null;
  exclusions: string | null;
  stacking_rule: string | null;
  source_url: string;
  source_tier: number;
  last_updated: string;
  data_as_of: string;
}

/** Every overlay whose hts_pattern is a prefix of the resolved code (or '%')
 * AND whose country_scope is null, '%', or matches the given country. Rate/
 * cap arithmetic is applied by the caller (src/routes/determination.ts), not
 * here -- this is pure data retrieval. */
export async function getApplicableOverlays(
  env: Env,
  htsno: string,
  countryCode: string | null
): Promise<TariffOverlayRow[]> {
  const digits = htsno.replace(/\./g, '');
  const { results } = await env.DB.prepare(`SELECT * FROM tariff_overlays`).all<TariffOverlayRow>();
  return results.filter((r) => {
    const patternMatches = r.hts_pattern === '%' || digits.startsWith(r.hts_pattern);
    const countryMatches =
      r.country_scope === null ||
      r.country_scope === '%' ||
      (countryCode !== null && r.country_scope === countryCode);
    return patternMatches && countryMatches;
  });
}

export interface PartyCandidateRow {
  source: 'SDN' | 'CSL';
  entity_id: number;
  matched_via: 'primary_name' | 'alias';
  name: string;
  name_normalized: string;
}

/** FTS5-based candidate shortlist across SDN (entries + aliases) and CSL
 * (entries + aliases) for one input name, already normalized. This is the
 * pre-filter that keeps src/lib/fuzzyMatch.ts's scoring pass bounded -- see
 * the build plan's Workers CPU budget discussion. */
export async function searchPartyCandidates(
  env: Env,
  normalizedName: string,
  limit = 50
): Promise<PartyCandidateRow[]> {
  const fts = toFtsQuery(normalizedName);
  const out: PartyCandidateRow[] = [];

  const sdnPrimary = await env.DB.prepare(
    `SELECT s.id, s.primary_name, s.name_normalized FROM sdn_name_search
     JOIN sdn_entries s ON s.id = sdn_name_search.rowid
     WHERE sdn_name_search MATCH ?1 ORDER BY bm25(sdn_name_search) LIMIT ?2`
  )
    .bind(fts, limit)
    .all<{ id: number; primary_name: string; name_normalized: string }>();
  for (const r of sdnPrimary.results)
    out.push({ source: 'SDN', entity_id: r.id, matched_via: 'primary_name', name: r.primary_name, name_normalized: r.name_normalized });

  const sdnAlias = await env.DB.prepare(
    `SELECT a.sdn_id, a.alias, a.alias_normalized FROM sdn_alias_search
     JOIN sdn_aliases a ON a.id = sdn_alias_search.rowid
     WHERE sdn_alias_search MATCH ?1 ORDER BY bm25(sdn_alias_search) LIMIT ?2`
  )
    .bind(fts, limit)
    .all<{ sdn_id: number; alias: string; alias_normalized: string }>();
  for (const r of sdnAlias.results)
    out.push({ source: 'SDN', entity_id: r.sdn_id, matched_via: 'alias', name: r.alias, name_normalized: r.alias_normalized });

  const cslPrimary = await env.DB.prepare(
    `SELECT c.id, c.name, c.name_normalized FROM csl_name_search
     JOIN csl_entries c ON c.id = csl_name_search.rowid
     WHERE csl_name_search MATCH ?1 ORDER BY bm25(csl_name_search) LIMIT ?2`
  )
    .bind(fts, limit)
    .all<{ id: number; name: string; name_normalized: string }>();
  for (const r of cslPrimary.results)
    out.push({ source: 'CSL', entity_id: r.id, matched_via: 'primary_name', name: r.name, name_normalized: r.name_normalized });

  const cslAlias = await env.DB.prepare(
    `SELECT a.csl_id, a.alias, a.alias_normalized FROM csl_alias_search
     JOIN csl_aliases a ON a.id = csl_alias_search.rowid
     WHERE csl_alias_search MATCH ?1 ORDER BY bm25(csl_alias_search) LIMIT ?2`
  )
    .bind(fts, limit)
    .all<{ csl_id: number; alias: string; alias_normalized: string }>();
  for (const r of cslAlias.results)
    out.push({ source: 'CSL', entity_id: r.csl_id, matched_via: 'alias', name: r.alias, name_normalized: r.alias_normalized });

  return out;
}

export interface SdnEntryRow {
  id: number;
  uid: string;
  primary_name: string;
  entity_type: string | null;
  programs: string;
  dob: string | null;
  place_of_birth: string | null;
  addresses: string;
  remarks: string | null;
  source_url: string;
  source_tier: number;
  last_updated: string;
}

export async function getSdnEntry(env: Env, id: number): Promise<SdnEntryRow | null> {
  return (await env.DB.prepare(`SELECT * FROM sdn_entries WHERE id = ?1`).bind(id).first<SdnEntryRow>()) ?? null;
}

export interface CslEntryRow {
  id: number;
  source_list: string;
  name: string;
  addresses: string | null;
  federal_register_notice: string | null;
  license_requirement: string | null;
  license_policy: string | null;
  start_date: string | null;
  source_url: string;
  source_tier: number;
  last_updated: string;
}

export async function getCslEntry(env: Env, id: number): Promise<CslEntryRow | null> {
  return (await env.DB.prepare(`SELECT * FROM csl_entries WHERE id = ?1`).bind(id).first<CslEntryRow>()) ?? null;
}
