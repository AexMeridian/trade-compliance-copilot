// The export license decision, kept apart from the route so it can be tested against every destination and ECCN without a database or a
// model call. Inputs are what the earlier steps established (denied-party hard stop, the destination's coverage status, the selected
// ECCN and its reasons for control, the destination's Country Chart rows); the output is the license result and the sentence that explains it.
import type { CountryChartRow, CountryCoverageRow } from './db.js';

export type LicenseRequirement = 'NLR' | 'License Required' | 'License Exception May Apply' | 'Insufficient Data';

export interface LicenseInput {
  country: string;
  hardStop: boolean;
  coverage: Pick<CountryCoverageRow, 'status' | 'notes'> | null;
  /** The selected ECCN (null when none was selected) with its parsed lists. */
  eccn: { eccn: string; reasonsForControl: string[]; licenseExceptions: string[] } | null;
  chartRows: Pick<CountryChartRow, 'reason_for_control'>[];
  /** Reason-for-control families (NS, CB, ...) this app has verified columns for. A curated destination with no mark for a family outside this set is
   * "not verified", not "not controlled". Defaults to NS and AT. */
  verifiedReasons?: ReadonlySet<string>;
}

/** Anti-terrorism controls are marked only for a handful of embargo-type destinations, so an unmarked ally is reliably unmarked. */
export const ASSUMED_UNMARKED_FAMILIES = ['AT'];

export interface LicenseDecision {
  requirement: LicenseRequirement;
  note: string;
  /** The reason-for-control that the Country Chart marks for this destination, when one matched. */
  matchedReason: string | null;
}

export function decideExportLicense(input: LicenseInput): LicenseDecision {
  const { country, hardStop, coverage, eccn, chartRows } = input;
  const reasons = eccn?.reasonsForControl ?? [];
  const noControl = !eccn || eccn.eccn === 'EAR99' || reasons.length === 0;

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
    return {
      requirement: 'License Required',
      note: `Destination "${country}" is subject to a comprehensive EAR embargo (${coverage.notes ?? coverage.status}): a license (from BIS and/or OFAC, depending on the destination) is required regardless of ECCN, including EAR99 items. Do not ship without confirming the exact authorization with BIS and OFAC.`,
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
    return {
      requirement: 'NLR',
      note: 'EAR99 or no reason-for-control match: No License Required for standard commercial export, subject to standard embargo/denied-party/end-use screening.',
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
  const chartPrefixes = new Set(chartRows.map((r) => r.reason_for_control.replace(/\d+$/, '')));
  const matchedReason = reasons.find((r) => chartPrefixes.has(r)) ?? null;
  if (matchedReason) {
    const exceptions = eccn!.licenseExceptions;
    return {
      requirement: exceptions.length > 0 ? 'License Exception May Apply' : 'License Required',
      note: `Destination "${country}" is marked for reason-for-control "${matchedReason}" on the Commerce Country Chart, matching this ECCN's reasons_for_control. ${
        exceptions.length > 0 ? `License exceptions that may apply: ${exceptions.join(', ')}. Verify eligibility conditions before relying on this.` : 'No license exception is curated for this ECCN in this app.'
      }`,
      matchedReason,
    };
  }
  const verified = new Set([...(input.verifiedReasons ?? ['NS']), ...ASSUMED_UNMARKED_FAMILIES]);
  const unverified = reasons.filter((r) => !verified.has(r));
  if (unverified.length > 0) {
    return {
      requirement: 'Insufficient Data',
      note: `This ECCN is also controlled for ${unverified.join(', ')}, and this app has verified only the ${[...verified].join(' and ')} columns of the Commerce Country Chart for "${country}". It cannot conclude No License Required. Check the ${unverified.join('/')} column for this destination in 15 CFR 738 Supp. 1.`,
      matchedReason: null,
    };
  }
  return {
    requirement: 'NLR',
    note: `Destination "${country}" has curated Commerce Country Chart coverage, but none of its marked reasons-for-control match this ECCN's reasons_for_control (${reasons.join(', ')}): No License Required.`,
    matchedReason: null,
  };
}
