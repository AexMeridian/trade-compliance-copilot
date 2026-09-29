// Real, public alliance/bloc membership -- not derived from any feed data,
// not fabricated. Facts, not opinions: each list is who is formally a member,
// as of the date below, cited to its own founding/joining document. A short
// list of blocs relevant to U.S. influence abroad, limited to countries this
// app already tracks in lib/pulseCountries.ts (COUNTRY_LABELS) -- a country
// absent from a bloc here is simply not a member of it, not "opposed" to it;
// there is no invented "rival bloc" or score, only membership.
//
// As of: 2026-09-26.
//   NATO -- 32 members since Sweden's March 2024 accession (nato.int).
//   G7 -- Canada, France, Germany, Italy, Japan, UK, US; the EU also
//     participates in every G7 summit without being a member state (g7.org).
//   G20 -- the 19 member countries plus the EU and African Union (g20.org).
//   BRICS -- founding five (Brazil, Russia, India, China, South Africa,
//     2010); South Africa is not in COUNTRY_LABELS, so only 4 of 5 show here.
//     The 2024 expansion (Egypt, Ethiopia, Iran, UAE, Saudi Arabia) is left
//     out to avoid disputed/partial membership as of this date -- Iran and
//     the UAE are tracked countries but not counted as BRICS members here.
//   USMCA -- the U.S.-Mexico-Canada Agreement, in force since 2020, the
//     successor to NAFTA (ustr.gov).
export type Bloc = 'NATO' | 'G7' | 'G20' | 'BRICS' | 'USMCA';

export const BLOC_LABELS: Record<Bloc, string> = {
  NATO: 'NATO',
  G7: 'G7',
  G20: 'G20',
  BRICS: 'BRICS',
  USMCA: 'USMCA',
};

export const BLOC_FULL_NAMES: Record<Bloc, string> = {
  NATO: 'North Atlantic Treaty Organization',
  G7: 'Group of Seven',
  G20: 'Group of Twenty',
  BRICS: 'Brazil, Russia, India, China, South Africa',
  USMCA: 'United States-Mexico-Canada Agreement',
};

export const BLOC_MEMBERS: Record<Bloc, string[]> = {
  NATO: ['CA', 'GB', 'FR', 'DE', 'IT', 'TR'],
  G7: ['CA', 'FR', 'DE', 'IT', 'JP', 'GB', 'EU'],
  G20: ['BR', 'CA', 'CN', 'FR', 'DE', 'IN', 'ID', 'IT', 'JP', 'MX', 'RU', 'SA', 'KR', 'TR', 'GB', 'EU'],
  BRICS: ['BR', 'RU', 'IN', 'CN'],
  USMCA: ['CA', 'MX'],
};

const BLOCS: Bloc[] = ['NATO', 'G7', 'G20', 'BRICS', 'USMCA'];

// A country can belong to several blocs at once (Canada is in all five here).
export function blocsFor(code: string): Bloc[] {
  return BLOCS.filter((b) => BLOC_MEMBERS[b].includes(code));
}

// For the globe, one color per country: the most specific/smallest bloc a
// country belongs to, so a bilateral pact (USMCA) outranks a 20-country
// grouping (G20) rather than being hidden by it. A display simplification --
// the Alliances tab lists a country's full membership, not just this one.
const PRIORITY: Bloc[] = ['USMCA', 'G7', 'NATO', 'BRICS', 'G20'];
export function primaryBlocFor(code: string): Bloc | null {
  return PRIORITY.find((b) => BLOC_MEMBERS[b].includes(code)) ?? null;
}
