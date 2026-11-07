// CBP user fees charged on a formal import entry, separate from duty: the Merchandise Processing Fee (MPF) and the Harbor Maintenance Fee
// (HMF). The MPF rate is set by statute (19 U.S.C. 58c) and restated in 19 CFR 24.23; its minimum and maximum per entry are adjusted each
// fiscal year (October 1) by a Federal Register notice. The dollar limits below come from carrier and broker notices of CBP's adjustments
// (source tier 2), not from the CBP notice itself, which could not be fetched when they were entered. The schedule ends with the last
// fiscal year it covers; past that date this module returns no dollar figure and says so, instead of reusing an old limit.
// The watcher in curatedWatch.ts raises an alert when a new "customs user fees" notice is published.

export const MPF_RATE_PCT = 0.3464;
export const HMF_RATE_PCT = 0.125;
/** A shipment valued above this is a formal entry (19 CFR 143.21); at or below it the MPF is a flat informal-entry fee set in the annual notice. */
export const FORMAL_ENTRY_THRESHOLD_USD = 2500;
/** Section 321 low-value shipments (19 CFR 10.151) pay no MPF. */
export const DE_MINIMIS_USD = 800;

interface FeePeriod {
  from: string; // inclusive, YYYY-MM-DD
  to: string; // inclusive
  mpfMin: number;
  mpfMax: number;
}

export const FEE_SCHEDULE: FeePeriod[] = [
  { from: '2025-10-01', to: '2026-09-30', mpfMin: 33.58, mpfMax: 651.5 }, // fiscal year 2026
  { from: '2026-10-01', to: '2027-09-30', mpfMin: 34.58, mpfMax: 670.86 }, // fiscal year 2027
];

/** The date through which the fee schedule above has been checked; the watcher compares newer user-fee notices against it. */
export const FEE_DATA_AS_OF = '2026-11-03';

export const FEE_SOURCES = {
  rule: 'https://www.law.cornell.edu/cfr/text/19/24.23',
  hmf: 'https://www.law.cornell.edu/cfr/text/19/24.24',
};

export interface EntryFeeLine {
  label: string;
  /** Null when the fee cannot be computed (the reason is in `basis`) or is conditional on facts the user has not given. */
  amount_usd: number | null;
  basis: string;
}

export interface EntryFeeInput {
  valueUsd: number | null;
  /** YYYY-MM-DD, normally today. */
  date: string;
  country: string;
  usmcaQualifies: boolean | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeEntryFees(input: EntryFeeInput): EntryFeeLine[] {
  const { valueUsd, date, country, usmcaQualifies } = input;
  if (valueUsd === null) {
    return [{ label: 'Merchandise processing fee (MPF)', amount_usd: null, basis: `Enter a declared value to estimate it: ${MPF_RATE_PCT}% of value, within a yearly minimum and maximum per entry.` }];
  }
  const lines: EntryFeeLine[] = [];
  const period = FEE_SCHEDULE.find((p) => date >= p.from && date <= p.to);
  const usmcaExempt = usmcaQualifies === true && (country === 'CA' || country === 'MX');

  if (valueUsd <= DE_MINIMIS_USD) {
    lines.push({ label: 'Merchandise processing fee (MPF)', amount_usd: 0, basis: 'A shipment at or under $800 that qualifies for Section 321 pays no MPF. Confirm it qualifies (see the de minimis note).' });
  } else if (usmcaExempt) {
    lines.push({ label: 'Merchandise processing fee (MPF)', amount_usd: 0, basis: 'Goods originating under USMCA are exempt from the MPF (19 CFR 24.23(c)(3)).' });
  } else if (valueUsd <= FORMAL_ENTRY_THRESHOLD_USD) {
    lines.push({
      label: 'Merchandise processing fee (MPF)',
      amount_usd: null,
      basis: 'A shipment at or under $2,500 is usually an informal entry, which pays a small flat MPF set in the annual CBP notice. This app does not carry that amount.',
    });
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
        usmcaQualifies === null && (country === 'CA' || country === 'MX') ? ' This is zero if the goods qualify under USMCA.' : ''
      }`,
    });
  }

  lines.push({
    label: 'Harbor maintenance fee (HMF)',
    amount_usd: null,
    basis: `Charged at ${HMF_RATE_PCT}% of value only on cargo arriving by sea at a U.S. port (19 CFR 24.24); not added because the mode of transport is not known. That would be ${round2((valueUsd * HMF_RATE_PCT) / 100).toFixed(2)} dollars on this value.`,
  });
  return lines;
}
