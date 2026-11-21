// CBP user fees charged on an import entry, separate from duty: the Merchandise Processing Fee (MPF) and the Harbor Maintenance Fee
// (HMF). The MPF rate is set by statute (19 U.S.C. 58c) and restated in 19 CFR 24.23; its minimum and maximum per entry, and the flat
// informal-entry amounts, are adjusted each fiscal year (October 1) by a Federal Register notice. The fiscal year 2027 limits and
// informal-entry amounts are from CBP Dec. 26-14, Federal Register notice 2026-15530, published 2026-07-31
// (https://www.federalregister.gov/d/2026-15530), a primary source. The fiscal year 2026 limits were entered from broker summaries of the
// prior notice (source tier 2), and the FY2026 informal amounts are not carried. The schedule ends with the last fiscal year it covers; past
// that date this module returns no dollar figure and says so, instead of reusing an old limit.
// The watcher in curatedWatch.ts raises an alert when a new "customs user fees" notice is published.

export const MPF_RATE_PCT = 0.3464;
export const HMF_RATE_PCT = 0.125;
/** A shipment valued above this is a formal entry (19 CFR 143.21); at or below it the MPF is a flat informal-entry fee set in the annual notice. */
export const FORMAL_ENTRY_THRESHOLD_USD = 2500;

/**
 * Section 321 de minimis ($800, 19 U.S.C. 1321) is suspended for all shipments from all countries by all modes since 2025-08-29 (EO 14324,
 * restated in EO 14388 of 2026-02-20); CBP made the suspension indefinite in a rule published 2026-06-24 (Federal Register 2026-12670), and
 * the statute itself ends the exemption on 2027-07-01. So no shipment is treated as exempt from duty or the MPF here.
 */
export const DE_MINIMIS_STATUTORY_END = '2027-07-01';
export function deMinimisNote(entryDate: string): string {
  return entryDate >= DE_MINIMIS_STATUTORY_END
    ? 'Section 321 de minimis treatment ($800) was repealed by statute effective 2027-07-01. Every shipment requires an entry and pays duty and the MPF.'
    : 'Section 321 de minimis treatment is suspended for all shipments from all countries since 2025-08-29 (EO 14324; indefinite suspension in the CBP rule of 2026-06-24, Federal Register 2026-12670), and the statute ends it on 2027-07-01. No shipment is treated as exempt from duty or the MPF, whatever its value. A low-value shipment needs an entry (informal at $2,500 or less) and pays duty plus the informal-entry MPF.';
}

interface FeePeriod {
  from: string; // inclusive, YYYY-MM-DD
  to: string; // inclusive
  mpfMin: number;
  mpfMax: number;
  /** Flat MPF for an informal entry ($2,500 or less): electronic, manual, and CBP-prepared. Absent where the notice was not read. */
  informal?: { automated: number; manual: number; cbpPrepared: number };
}

export const FEE_SCHEDULE: FeePeriod[] = [
  { from: '2025-10-01', to: '2026-09-30', mpfMin: 33.58, mpfMax: 651.5 }, // fiscal year 2026
  { from: '2026-10-01', to: '2027-09-30', mpfMin: 34.58, mpfMax: 670.86, informal: { automated: 2.77, manual: 8.3, cbpPrepared: 12.45 } }, // fiscal year 2027
];

/** The date through which the fee schedule above has been checked; the watcher compares newer user-fee notices against it. */
export const FEE_DATA_AS_OF = '2026-11-03';

export const FEE_SOURCES = {
  rule: 'https://www.law.cornell.edu/cfr/text/19/24.23',
  hmf: 'https://www.law.cornell.edu/cfr/text/19/24.24',
  notice: 'https://www.federalregister.gov/d/2026-15530',
};

export type TransportMode = 'ocean' | 'air' | 'land' | 'unknown';
export const TRANSPORT_MODES: readonly TransportMode[] = ['ocean', 'air', 'land', 'unknown'];

export interface EntryFeeLine {
  label: string;
  /** Null when the fee cannot be computed (the reason is in `basis`) or is conditional on facts the user has not given. */
  amount_usd: number | null;
  basis: string;
}

export interface EntryFeeInput {
  valueUsd: number | null;
  /** YYYY-MM-DD, the date of entry. */
  date: string;
  country: string;
  usmcaQualifies: boolean | null;
  /** How the goods arrive. The HMF applies to ocean cargo only; absent or 'unknown' leaves it unstated. */
  transportMode?: TransportMode | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeEntryFees(input: EntryFeeInput): EntryFeeLine[] {
  const { valueUsd, date, country, usmcaQualifies } = input;
  const mode = input.transportMode ?? 'unknown';
  if (valueUsd === null) {
    return [{ label: 'Merchandise processing fee (MPF)', amount_usd: null, basis: `Enter a declared value to estimate it: ${MPF_RATE_PCT}% of value, within a yearly minimum and maximum per entry (a flat fee at $2,500 or less).` }];
  }
  const lines: EntryFeeLine[] = [];
  const period = FEE_SCHEDULE.find((p) => date >= p.from && date <= p.to);
  const usmcaExempt = usmcaQualifies === true && (country === 'CA' || country === 'MX');
  const usmcaMaybe = usmcaQualifies === null && (country === 'CA' || country === 'MX');

  if (usmcaExempt) {
    lines.push({ label: 'Merchandise processing fee (MPF)', amount_usd: 0, basis: 'Goods originating under USMCA are exempt from the MPF (19 CFR 24.23(c)(3)).' });
  } else if (valueUsd <= FORMAL_ENTRY_THRESHOLD_USD) {
    if (period?.informal) {
      const f = period.informal;
      lines.push({
        label: 'Merchandise processing fee (MPF), informal entry',
        amount_usd: f.automated,
        basis: `An entry of $2,500 or less pays a flat MPF: $${f.automated.toFixed(2)} if filed electronically, $${f.manual.toFixed(2)} if filed manually, $${f.cbpPrepared.toFixed(2)} if CBP prepares the entry (fiscal year ${period.to.slice(0, 4)}, CBP Dec. 26-14, Federal Register 2026-15530). The electronic amount is shown.${
          usmcaMaybe ? ' This is zero if the goods qualify under USMCA.' : ''
        }`,
      });
    } else {
      lines.push({
        label: 'Merchandise processing fee (MPF), informal entry',
        amount_usd: null,
        basis: "An entry of $2,500 or less pays a flat MPF set in the annual CBP notice. This app carries those amounts only for fiscal year 2027 (entries from 2026-10-01 to 2027-09-30); check CBP's current notice for the entry date given.",
      });
    }
  } else if (!period) {
    lines.push({
      label: 'Merchandise processing fee (MPF)',
      amount_usd: null,
      basis: `The yearly MPF minimum and maximum are only known through ${FEE_SCHEDULE[FEE_SCHEDULE.length - 1].to}. The rate is ${MPF_RATE_PCT}%; apply the limits in CBP's current notice.`,
    });
  } else {
    const raw = (valueUsd * MPF_RATE_PCT) / 100;
    const amount = round2(Math.min(period.mpfMax, Math.max(period.mpfMin, raw)));
    lines.push({
      label: 'Merchandise processing fee (MPF)',
      amount_usd: amount,
      basis: `${MPF_RATE_PCT}% of value, held between ${period.mpfMin.toFixed(2)} and ${period.mpfMax.toFixed(2)} dollars per entry (fiscal year ${period.to.slice(0, 4)}).${
        usmcaMaybe ? ' This is zero if the goods qualify under USMCA.' : ''
      }`,
    });
  }

  const hmf = round2((valueUsd * HMF_RATE_PCT) / 100);
  if (mode === 'ocean') {
    lines.push({ label: 'Harbor maintenance fee (HMF)', amount_usd: hmf, basis: `${HMF_RATE_PCT}% of the value of cargo arriving by sea at a U.S. port (19 CFR 24.24).` });
  } else if (mode === 'air' || mode === 'land') {
    lines.push({ label: 'Harbor maintenance fee (HMF)', amount_usd: 0, basis: `Not charged: the HMF applies only to cargo arriving by sea (19 CFR 24.24), and this shipment arrives by ${mode}.` });
  } else {
    lines.push({
      label: 'Harbor maintenance fee (HMF)',
      amount_usd: null,
      basis: `Charged at ${HMF_RATE_PCT}% of value only on cargo arriving by sea at a U.S. port (19 CFR 24.24); not added because the mode of transport was not given. That would be ${hmf.toFixed(2)} dollars on this value if it arrives by ocean.`,
    });
  }
  return lines;
}
