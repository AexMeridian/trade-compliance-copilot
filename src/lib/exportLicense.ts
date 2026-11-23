// The export license decision, kept apart from the route so it can be tested against every destination and ECCN without a database or a
// model call. Inputs are what the earlier steps established (denied-party hard stop, the destination's coverage status, the selected
// ECCN and its reasons for control, the destination's Country Chart rows); the output is the license result and the sentence that explains it.
import type { CountryChartRow, CountryCoverageRow } from './db.js';

/** 'Possible exception: verify' = a license is required by the chart and the ECCN lists an exception, but its country-group and paragraph conditions are not checked here. */
export type LicenseRequirement = 'NLR' | 'License Required' | 'Possible exception: verify' | 'Insufficient Data';

export interface LicenseInput {
  country: string;
  hardStop: boolean;
  coverage: Pick<CountryCoverageRow, 'status' | 'notes'> | null;
  /** The selected ECCN (null when none was selected) with its parsed lists. */
  eccn: { eccn: string; reasonsForControl: string[]; licenseExceptions: string[] } | null;
  chartRows: Pick<CountryChartRow, 'reason_for_control'>[];
  /** Reason-for-control families (NS, CB, ...) this app has chart data for. A family outside this set is "not verified", not "not controlled". Defaults to NS. */
  verifiedReasons?: ReadonlySet<string>;
  /** True only when the Commerce Control List loaded here is the whole list. While it is partial, "EAR99" or "no match" cannot be confirmed and the
   * result is never NLR. Defaults to false. */
  cclComplete?: boolean;
  /** The destination's Country Groups (15 CFR 740 Supp. 1), e.g. ["A:1", "B"]; omitted when not loaded. Only named in notes: the conditions an ECCN sets by group are paragraph-specific and are not decided here. */
  countryGroups?: readonly string[];
}

/** The loaded table counts as the whole Commerce Control List only at or above this many ECCNs. Part 774 Supp. 1 has about 636 (the roughly 3,000 figure
 * counts paragraphs within them), so a table that stopped short of most of the list stays "partial". */
export const CCL_COMPLETE_MIN_ENTRIES = 600;

/** Appended to every "no license required" result: a complete Commerce Control List settles only the item's classification, not who receives it or what it is for. */
export const PART_744_CAVEAT =
  ' This does not clear the transaction: Part 744 end-use and end-user controls (for example military end use, certain entities and weapons-related end uses) and any embargo, denied-party or OFAC restriction still apply and are only partly screened here.';

/** Destinations whose embargo still lets EAR99 items go under License Exception SPP (15 CFR 746.9(b)(1), since 2025-09-02). */
export const EAR99_SPP_DESTINATIONS: ReadonlySet<string> = new Set(['SY']);

export interface LicenseDecision {
  requirement: LicenseRequirement;
  note: string;
  /** The reason-for-control that the Country Chart marks for this destination, when one matched. */
  matchedReason: string | null;
}

/** "NS2" = NS Column 2 for the whole entry; "NS1?" = only some paragraphs; "RS?" = set by country group or outside the chart; "NS" = legacy, no column. */
export function parseReason(r: string): { family: string; column: string | null; conditional: boolean } {
  const m = /^([A-Z]{2})(\d+)?(\?)?$/.exec(r.trim());
  if (!m) return { family: r.trim(), column: null, conditional: true };
  return { family: m[1], column: m[2] ?? null, conditional: m[3] === '?' };
}

const NOT_CONFIRMED_PARTIAL =
  'This app carries only a handful of the roughly 3,000 Commerce Control List entries, so it cannot confirm that no entry applies. Classify the item against the full list (15 CFR Part 774) before relying on this.';

// For an encryption item the first questions are mass-market status and License Exception ENC, before any chart result: say so on every
// decision for 5A002, 5D002 and 5E002 (except a denied-party hard stop, which no exception overrides).
const ENCRYPTION_ECCN_RE = /^5[ADE]002/i;
const ENCRYPTION_NOTE =
  ' Encryption item: first check whether it qualifies as mass market (15 CFR 740.17(b)(1), then classified 5A992/5D992) and whether License Exception ENC (15 CFR 740.17) applies to this destination and end user; this app does not check either.';

/** For the "verify" items that depend on country group, says which groups the destination is in so the reader can apply the entry's own wording. No decision is made from it. */
function groupsSentence(groups: readonly string[] | undefined, verify: string[]): string {
  if (!groups || !verify.some((v) => /country group/.test(v))) return '';
  return groups.length > 0
    ? ` The destination is in Country Group${groups.length > 1 ? 's' : ''} ${groups.join(', ')} (15 CFR 740 Supp. 1); apply the entry's own country-group wording to that.`
    : ' The destination is in none of the Country Groups this app has loaded (15 CFR 740 Supp. 1); apply the country-group wording in the ECCN entry.';
}

export function decideExportLicense(input: LicenseInput): LicenseDecision {
  const decision = decideCore(input);
  if (!input.hardStop && input.eccn && ENCRYPTION_ECCN_RE.test(input.eccn.eccn)) return { ...decision, note: decision.note + ENCRYPTION_NOTE };
  return decision;
}

function decideCore(input: LicenseInput): LicenseDecision {
  const { country, hardStop, coverage, eccn, chartRows } = input;
  const reasons = eccn?.reasonsForControl ?? [];
  const noControl = !eccn || eccn.eccn === 'EAR99' || reasons.length === 0;
  const cclComplete = input.cclComplete === true;

  if (hardStop) {
    return {
      requirement: 'License Required',
      note: 'Overridden by a true match in Module 3 against a denied or blocked-party list (BIS Entity List/Denied Persons List, UN Security Council list, or OFAC SDN), determinative regardless of ECCN. See the screening open issues for which list.',
      matchedReason: null,
    };
  }
  // Checked before the EAR99 shortcut: a destination under a comprehensive embargo (Part 746: Cuba, Iran, North Korea, Syria) is not
  // "NLR" just because the item is EAR99.
  if (coverage?.status === 'comprehensive_embargo') {
    if (EAR99_SPP_DESTINATIONS.has(country) && noControl) {
      return {
        requirement: 'Possible exception: verify',
        note: `Destination "${country}" is under an EAR embargo (${coverage.notes ?? coverage.status}). A license is required unless License Exception SPP (15 CFR 740.5, 746.9(b)(1)) covers this EAR99 item. This app cannot confirm the item is EAR99 or that SPP's conditions and the Part 744 end-use/end-user rules are met: verify before shipping.`,
        matchedReason: null,
      };
    }
    return {
      requirement: 'License Required',
      note: `Destination "${country}" is subject to a comprehensive EAR embargo (${coverage.notes ?? coverage.status}): a license (from BIS and/or OFAC, depending on the destination) is required regardless of ECCN${EAR99_SPP_DESTINATIONS.has(country) ? ' for items on the Commerce Control List' : ', including EAR99 items'}. Do not ship without confirming the exact authorization with BIS and OFAC.`,
      matchedReason: null,
    };
  }
  // Russia/Belarus: Part 746 extends licensing to many EAR99 items by HTS code (Supplements 2, 4 and 6), a list this app does not carry.
  if (coverage?.status === 'broad_restriction_746_5' && noControl) {
    return {
      requirement: 'Insufficient Data',
      note: `Destination "${country}" is subject to near-comprehensive EAR restrictions (${coverage.notes ?? coverage.status}) that reach many EAR99 items by HTS code (Supplements 2, 4 and 6 to 15 CFR Part 746). This app does not carry those lists, so it cannot conclude No License Required. Check them directly.`,
      matchedReason: null,
    };
  }
  if (noControl) {
    if (!cclComplete) {
      return {
        requirement: 'Insufficient Data',
        note: `Cannot confirm: the product matched EAR99 or no carried entry. ${NOT_CONFIRMED_PARTIAL} Standard embargo, denied-party and end-use screening still applies.`,
        matchedReason: null,
      };
    }
    return {
      requirement: 'NLR',
      note:
        (eccn
          ? 'The item is EAR99 (not on the Commerce Control List): No License Required under the Country Chart for a standard commercial export.'
          : 'No entry on the Commerce Control List matched this item, which supports treating it as EAR99 (No License Required under the Country Chart). That is a classification judgment to confirm against 15 CFR Part 774, not a finding.') +
        PART_744_CAVEAT,
      matchedReason: null,
    };
  }
  if (!coverage || coverage.status === 'not_curated') {
    return {
      requirement: 'Insufficient Data',
      note: `Destination "${country}" is not in this app's curated Commerce Country Chart coverage. Cannot determine license requirement automatically. Consult 15 CFR 738 Supp. 1 directly.`,
      matchedReason: null,
    };
  }
  if (coverage.status === 'broad_restriction_746_5') {
    return {
      requirement: 'License Required',
      note: `Destination "${country}" is subject to a near-comprehensive EAR restriction (${coverage.notes ?? coverage.status}): license required regardless of the specific reason-for-control match.`,
      matchedReason: null,
    };
  }

  // Compare each reason on its Country Chart column, not on its family: 1C350 is CB Column 2, and an ally marked only for CB Column 1 is not
  // marked for it. A reason that applies only to some paragraphs, is set by country group, or has no chart column cannot be settled here.
  const marks = new Set(chartRows.map((r) => r.reason_for_control));
  const markedFamilies = new Set(chartRows.map((r) => r.reason_for_control.replace(/\d+$/, '')));
  const verified = new Set([...(input.verifiedReasons ?? ['NS'])]);
  const hits: string[] = [];
  const verify: string[] = [];
  for (const raw of reasons) {
    const { family, column, conditional } = parseReason(raw);
    const label = column ? `${family} Column ${column}` : family;
    if (column !== null) {
      if (marks.has(`${family}${column}`)) (conditional ? verify : hits).push(conditional ? `${label} (applies only to some paragraphs)` : label);
      else if (!verified.has(family)) verify.push(`${label} (chart not loaded for this app)`);
      // else: the chart carries this column and does not mark it for this destination
    } else if (conditional) {
      verify.push(`${family} (set by country group or outside the Country Chart, or only some paragraphs)`);
    } else if (markedFamilies.has(family)) {
      verify.push(`${family} (column not recorded; the chart marks a column of it for this destination)`);
    } else if (!verified.has(family)) {
      verify.push(`${family} (chart not loaded for this app)`);
    }
  }

  if (hits.length > 0) {
    const exceptions = eccn!.licenseExceptions;
    const extra = verify.length > 0 ? ` Also verify: ${verify.join('; ')}.${groupsSentence(input.countryGroups, verify)}` : '';
    return {
      requirement: exceptions.length > 0 ? 'Possible exception: verify' : 'License Required',
      note: `Destination "${country}" is marked on the Commerce Country Chart for ${hits.join(', ')}, which this ECCN is controlled for across the entire entry: a license is required.${extra} ${
        exceptions.length > 0
          ? `Possible exception${exceptions.length > 1 ? 's' : ''}: ${exceptions.join(', ')}. This app has not checked the country group, paragraph or other eligibility conditions in 15 CFR Part 740, so verify before relying on one.`
          : 'A list-based license exception may still exist in the ECCN entry or Part 740; this app does not model them.'
      }`,
      matchedReason: hits[0],
    };
  }
  if (verify.length > 0) {
    return {
      requirement: 'Insufficient Data',
      note: `Cannot confirm for "${country}": this ECCN has controls this app cannot settle on the Country Chart alone: ${verify.join('; ')}.${groupsSentence(input.countryGroups, verify)} Check the ECCN entry and 15 CFR 738 Supp. 1 for this destination.`,
      matchedReason: null,
    };
  }
  if (!cclComplete) {
    return {
      requirement: 'Insufficient Data',
      note: `None of this ECCN's chart columns (${reasons.join(', ')}) is marked for "${country}", but this app cannot confirm the classification. ${NOT_CONFIRMED_PARTIAL}`,
      matchedReason: null,
    };
  }
  return {
    requirement: 'NLR',
    note: `Destination "${country}" has curated Commerce Country Chart coverage, but none of its marked reasons-for-control match this ECCN's reasons_for_control (${reasons.join(', ')}): No License Required under the Country Chart.${PART_744_CAVEAT}`,
    matchedReason: null,
  };
}
