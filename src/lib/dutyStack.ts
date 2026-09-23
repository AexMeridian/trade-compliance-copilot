// Deterministic duty-stack assembly for the import path of Module 4. Rate
// arithmetic and 232/301/338 stacking/exclusion logic live here as plain
// TypeScript -- never delegated to the LLM, which only narrates the result
// (see src/prompts/determination.ts). This is the one place in the app that
// computes a number that flows into the final landed-cost estimate, so it is
// kept small, synchronous, and easy to audit.

import type { HtsCandidateRow, TariffOverlayRow } from './db.js';
import type { DutyStackLine } from '../types/case.js';

/** Extracts a leading ad-valorem percentage from an HTS rate string like
 * "Free", "2.5%", "9.1¢/kg" (unparseable -> null, flagged for manual review
 * rather than silently treated as 0%). */
export function parseAdValoremRate(raw: string): { pct: number | null; isFree: boolean; raw: string } {
  const trimmed = raw.trim();
  if (trimmed === '' ) return { pct: null, isFree: false, raw: trimmed };
  if (/^free$/i.test(trimmed)) return { pct: 0, isFree: true, raw: trimmed };
  const m = trimmed.match(/^(\d+(?:\.\d+)?)\s*%/);
  if (m) return { pct: parseFloat(m[1]), isFree: false, raw: trimmed };
  return { pct: null, isFree: false, raw: trimmed }; // specific/compound rate (e.g. cents/kg) -- not ad valorem, flag it
}

/** Checks whether a USMCA program symbol (CA for Canada, MX for Mexico)
 * appears as its own token inside an HTS "special" rate parenthetical, e.g.
 * "Free (A,AU,BH,CA,CL,...,MX,...)" -- word-boundary matched so "CA" doesn't
 * false-positive inside a longer symbol. */
export function specialRateHasProgram(specialRate: string, programSymbol: string): boolean {
  const re = new RegExp(`(^|[(,\\s])${programSymbol}([),\\s]|$)`);
  return re.test(specialRate);
}

/** Renders an overlay row's exclusions JSON array (if any) as a single caveat
 * string, so scope-precision caveats (e.g. "chapter-level approximation, not
 * line-item") survive into the report even for lines that DO apply. */
function overlayCaveat(row: TariffOverlayRow): string | null {
  if (!row.exclusions) return null;
  try {
    const arr = JSON.parse(row.exclusions) as string[];
    return arr.length ? arr.join(' ') : null;
  } catch {
    return null;
  }
}

export interface BuildDutyStackResult {
  lines: DutyStackLine[];
  totalPct: number | null; // null if any applicable line has an unparseable (specific/compound) rate
}

export function buildDutyStack(
  hts: HtsCandidateRow,
  country: string,
  usmcaQualifies: boolean | null,
  overlays: TariffOverlayRow[]
): BuildDutyStackResult {
  const lines: DutyStackLine[] = [];
  let unparseable = false;
  let total = 0;

  // USMCA's HTS Special Program Indicator is "S" (or "S+" where Canada and
  // Mexico are treated differently, e.g. certain agricultural TRQ/staging and
  // textile TPL goods) -- NOT country-specific "CA"/"MX" symbols, which were
  // the pre-2020 NAFTA convention and do not appear in the current schedule.
  // Verified against the live HTS data during this build: no Chapter 87 line
  // carries a "CA" token in its special_rate column at all.
  const isUsmcaCountry = country === 'CA' || country === 'MX';
  const programSymbol = isUsmcaCountry ? 'S' : null;
  const hasDifferentialSymbol = specialRateHasProgram(hts.special_rate ?? '', 'S+');
  const specialApplies =
    usmcaQualifies === true &&
    isUsmcaCountry &&
    programSymbol !== null &&
    (specialRateHasProgram(hts.special_rate ?? '', 'S') || hasDifferentialSymbol);

  const generalRate = parseAdValoremRate(hts.general_rate ?? '');
  const htsProvenance = { source_url: hts.source_url, source_tier: hts.source_tier as 1 | 2 | 3, last_updated: hts.last_updated };

  if (specialApplies) {
    const specialRate = parseAdValoremRate(hts.special_rate ?? '');
    lines.push({
      layer: 'HTS Column 1 General',
      rate_pct: generalRate.pct,
      rate_type: 'ad_valorem',
      legal_basis: '19 U.S.C. 1202, HTSUS Column 1 General',
      effective_date: hts.revision,
      applies: false,
      reason_if_not_applied: 'Superseded by USMCA preferential rate (Column 1 Special) -- see next line.',
      caveat: null,
      source: htsProvenance,
    });
    lines.push({
      layer: 'HTS Column 1 Special (USMCA)',
      rate_pct: specialRate.pct,
      rate_type: specialRate.pct === null ? 'specific_or_compound' : 'ad_valorem',
      legal_basis: `19 U.S.C. 1202, HTSUS Column 1 Special, program symbol "${programSymbol}" (USMCA)`,
      effective_date: hts.revision,
      applies: true,
      reason_if_not_applied: null,
      caveat: hasDifferentialSymbol
        ? 'This line carries the "S+" indicator, meaning Canada and Mexico can receive different rates (e.g. agricultural TRQ/staging, textile TPL) -- the parsed rate may not be accurate for both countries; verify against General Note 3(c)(i) for the specific country.'
        : null,
      source: htsProvenance,
    });
    if (specialRate.pct === null) unparseable = true;
    else total += specialRate.pct;
  } else {
    lines.push({
      layer: 'HTS Column 1 General',
      rate_pct: generalRate.pct,
      rate_type: generalRate.pct === null ? 'specific_or_compound' : 'ad_valorem',
      legal_basis: '19 U.S.C. 1202, HTSUS Column 1 General',
      effective_date: hts.revision,
      applies: true,
      reason_if_not_applied: null,
      caveat: null,
      source: htsProvenance,
    });
    if (generalRate.pct === null) unparseable = true;
    else total += generalRate.pct;
    if (usmcaQualifies === true && isUsmcaCountry) {
      lines.push({
        layer: 'HTS Column 1 Special (USMCA)',
        rate_pct: null,
        rate_type: 'ad_valorem',
        legal_basis: `19 U.S.C. 1202, HTSUS Column 1 Special`,
        effective_date: hts.revision,
        applies: false,
        reason_if_not_applied: `Module 2 found USMCA qualification, but this HTS line's Special rate column does not list program symbol "${programSymbol}" -- verify manually.`,
        caveat: null,
        source: htsProvenance,
      });
    }
  }

  // Section 232 metals: apply baseline, then cap if a per-country cap row exists.
  const metalsPrograms = ['sec232_steel', 'sec232_aluminum', 'sec232_copper'];
  const metalsBaseline = overlays.find((o) => metalsPrograms.includes(o.program));
  const metalsCap = overlays.find((o) => o.program === 'sec232_metals_country_cap');
  if (metalsBaseline) {
    const cappedPct =
      metalsCap && metalsBaseline.rate_pct !== null && metalsCap.rate_pct !== null
        ? Math.min(metalsBaseline.rate_pct, metalsCap.rate_pct)
        : metalsBaseline.rate_pct;
    const wasCapped = metalsCap && cappedPct !== metalsBaseline.rate_pct;
    lines.push({
      layer: `Section 232 (${metalsBaseline.program.replace('sec232_', '')})${wasCapped ? ' -- country cap applied' : ''}`,
      rate_pct: cappedPct,
      rate_type: metalsBaseline.rate_type,
      legal_basis: wasCapped ? `${metalsBaseline.legal_basis}; capped per ${metalsCap!.legal_basis}` : metalsBaseline.legal_basis,
      effective_date: metalsBaseline.effective_date,
      applies: true,
      reason_if_not_applied: null,
      caveat: overlayCaveat(metalsBaseline),
      source: { source_url: metalsBaseline.source_url, source_tier: metalsBaseline.source_tier as 1 | 2 | 3, last_updated: metalsBaseline.last_updated, data_as_of: metalsBaseline.data_as_of },
    });
    if (cappedPct === null) unparseable = true;
    else total += cappedPct;
  }

  // Section 232 autos / autos_parts
  for (const program of ['sec232_autos', 'sec232_autos_parts']) {
    const row = overlays.find((o) => o.program === program);
    if (!row) continue;
    lines.push({
      layer: `Section 232 (${program === 'sec232_autos' ? 'autos' : 'auto parts'})`,
      rate_pct: row.rate_pct,
      rate_type: row.rate_type,
      legal_basis: row.legal_basis,
      effective_date: row.effective_date,
      applies: true,
      reason_if_not_applied: null,
      caveat: overlayCaveat(row),
      source: { source_url: row.source_url, source_tier: row.source_tier as 1 | 2 | 3, last_updated: row.last_updated, data_as_of: row.data_as_of },
    });
    if (row.rate_pct === null) unparseable = true;
    else total += row.rate_pct;
  }

  // Section 301 forced labor
  const sec301 = overlays.find((o) => o.program === 'sec301_forced_labor');
  if (sec301) {
    lines.push({
      layer: 'Section 301 (forced-labor determination)',
      rate_pct: sec301.rate_pct,
      rate_type: sec301.rate_type,
      legal_basis: sec301.legal_basis,
      effective_date: sec301.effective_date,
      applies: true,
      reason_if_not_applied: null,
      caveat: overlayCaveat(sec301),
      source: { source_url: sec301.source_url, source_tier: sec301.source_tier as 1 | 2 | 3, last_updated: sec301.last_updated, data_as_of: sec301.data_as_of },
    });
    if (sec301.rate_pct === null) unparseable = true;
    else total += sec301.rate_pct;
  }

  // Section 338 (Canada) -- explicit anti-stacking with Section 232.
  const sec338 = overlays.find((o) => o.program === 'sec338_canada');
  const alreadyUnder232 = Boolean(metalsBaseline) || overlays.some((o) => o.program === 'sec232_autos' || o.program === 'sec232_autos_parts');
  if (sec338) {
    if (alreadyUnder232) {
      lines.push({
        layer: 'Section 338 (Canada)',
        rate_pct: null,
        rate_type: sec338.rate_type,
        legal_basis: sec338.legal_basis,
        effective_date: sec338.effective_date,
        applies: false,
        reason_if_not_applied: 'Good is already dutiable under Section 232 -- Section 338 excludes goods already covered by Section 232 (anti-stacking rule).',
        caveat: overlayCaveat(sec338),
        source: { source_url: sec338.source_url, source_tier: sec338.source_tier as 1 | 2 | 3, last_updated: sec338.last_updated, data_as_of: sec338.data_as_of },
      });
    } else {
      lines.push({
        layer: 'Section 338 (Canada)',
        rate_pct: sec338.rate_pct,
        rate_type: sec338.rate_type,
        legal_basis: sec338.legal_basis,
        effective_date: sec338.effective_date,
        applies: true,
        reason_if_not_applied: null,
        caveat: overlayCaveat(sec338),
        source: { source_url: sec338.source_url, source_tier: sec338.source_tier as 1 | 2 | 3, last_updated: sec338.last_updated, data_as_of: sec338.data_as_of },
      });
      if (sec338.rate_pct === null) unparseable = true;
      else total += sec338.rate_pct;
      // Applies regardless of USMCA qualification -- no special-casing needed here,
      // since we only branch on 232 exclusion above, exactly per the sourced rule.
    }
  }

  return { lines, totalPct: unparseable ? null : Math.round(total * 100) / 100 };
}
