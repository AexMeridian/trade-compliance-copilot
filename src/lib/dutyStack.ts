// Deterministic duty-stack assembly for the import path of Module 4. Rate
// arithmetic and 232/301/338 stacking/exclusion logic live here as plain
// TypeScript -- never delegated to the LLM, which only narrates the result
// (see src/prompts/determination.ts). This is the one place in the app that
// computes a number that flows into the final landed-cost estimate, so it is
// kept small, synchronous, and easy to audit.

import type { HtsCandidateRow, TariffOverlayRow } from './db.js';
import type { DutyStackLine } from '../types/case.js';

/** The two USMCA member countries besides the U.S. itself. Shared so this
 * file's and determination.ts's "is USMCA even relevant here" checks can't
 * drift out of sync with each other. */
export const USMCA_COUNTRIES = new Set(['CA', 'MX']);

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

/** Finds the rate that applies to one program symbol inside an HTS "special"
 * column, which is a list of "<rate> (<symbols>)" groups, e.g.
 * "Free (A,AU,CO,S,SG)" or "3.4% (S) Free (AU,CO)". Returns null if the
 * symbol isn't listed in any group; pct is null if its group's rate isn't a
 * plain ad-valorem/Free value (flagged, never guessed). parseAdValoremRate
 * alone can't do this: it reads only the leading rate, so it returns null
 * for "Free (...)" and the wrong group's rate for multi-group strings. */
export function specialRateForSymbol(specialRate: string, symbol: string): { pct: number | null; raw: string } | null {
  const groupRe = /([^()]*?)\s*\(([^)]*)\)/g;
  for (const m of specialRate.matchAll(groupRe)) {
    const symbols = m[2].split(',').map((x) => x.trim());
    if (!symbols.includes(symbol)) continue;
    const raw = m[1].trim();
    return { pct: parseAdValoremRate(raw).pct, raw };
  }
  return null;
}

/** One-to-one U.S. free trade agreements, each with its own program symbol in
 * the HTS special column (General Note 3(c)). Deliberately excludes the
 * multi-country programs (GSP "A", AGOA "D", CBI "E", CAFTA-DR "P"), whose
 * eligible-country lists change and are not in this app's data. */
export const FTA_SYMBOL_FOR_COUNTRY: Record<string, string> = {
  AU: 'AU', BH: 'BH', CL: 'CL', CO: 'CO', IL: 'IL', JO: 'JO',
  KR: 'KR', MA: 'MA', OM: 'OM', PA: 'PA', PE: 'PE', SG: 'SG',
};

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
  const isUsmcaCountry = USMCA_COUNTRIES.has(country);
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
    // 'S+' (Canada/Mexico differ) is looked up when plain 'S' isn't listed.
    const specialRate = specialRateForSymbol(hts.special_rate ?? '', 'S') ?? specialRateForSymbol(hts.special_rate ?? '', 'S+') ?? { pct: null, raw: '' };
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

  // Other free trade agreements: show the preferential rate this line lists
  // for the origin country, but do NOT apply it to the total. Claiming an FTA
  // rate means the goods meet that agreement's rules of origin, and this app
  // only evaluates origin for USMCA -- so applying it would silently assert
  // something unverified. The total stays at the rate the importer pays
  // unless they prove preference; the line tells them the saving exists.
  const ftaSymbol = FTA_SYMBOL_FOR_COUNTRY[country];
  if (ftaSymbol) {
    const fta = specialRateForSymbol(hts.special_rate ?? '', ftaSymbol);
    if (fta) {
      lines.push({
        layer: `HTS Column 1 Special (${ftaSymbol} free trade agreement)`,
        rate_pct: fta.pct,
        rate_type: fta.pct === null ? 'specific_or_compound' : 'ad_valorem',
        legal_basis: `19 U.S.C. 1202, HTSUS Column 1 Special, program symbol "${ftaSymbol}"`,
        effective_date: hts.revision,
        applies: false,
        reason_if_not_applied: "Not included in the total: the preferential rate applies only if the goods meet this agreement's rules of origin, which this app does not evaluate.",
        caveat: `If the goods qualify and the importer claims the "${ftaSymbol}" preference at entry, the Column 1 General duty above is replaced by this rate. Confirm qualification with a licensed customs broker.`,
        source: htsProvenance,
      });
    }
  }

  // Section 301 China tariff actions (Lists 1-4A and later modifications) are
  // product-specific and have changed repeatedly; this app carries no
  // verified list for them (no sec301_china rows are seeded). Rather than
  // omit the layer and let a China-origin good read as fully priced, say so
  // explicitly. rate_pct is null and applies is false, so the total is not
  // poisoned -- determination.ts separately forces review for this case.
  if (country === 'CN' && !overlays.some((o) => o.program === 'sec301_china')) {
    lines.push({
      layer: 'Section 301 (China tariff actions) -- NOT EVALUATED',
      rate_pct: null,
      rate_type: 'ad_valorem',
      legal_basis: 'Section 301 of the Trade Act of 1974; USTR China action Lists 1-4A and later modifications',
      effective_date: hts.revision,
      applies: false,
      reason_if_not_applied: 'This app has no verified Section 301 China product lists loaded, so it cannot say whether this HTS line is covered or at what rate.',
      caveat: 'Goods of China are often subject to an additional Section 301 duty (historically 7.5%-100% depending on the product and list). The total below does NOT include it. Check this HTS code against the current USTR lists / HTSUS Chapter 99 before relying on the estimate.',
      source: null,
    });
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
