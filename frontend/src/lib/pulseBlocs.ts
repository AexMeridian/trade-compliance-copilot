// Real, public alliance/bloc membership -- not derived from any feed data,
// not fabricated. Facts, not opinions: each list is who is formally a member,
// as of the date below, cited to its own founding/joining document. Every
// country the globe can select (lib/worldCountries.ts) has a code to use
// here now, so these lists are no longer constrained by which countries this
// app happens to have U.S. trade-policy data for -- a country absent from a
// bloc here is simply not a member of it, not "opposed" to it; there is no
// invented "rival bloc" or score, only membership. 'US' is left out of every
// list on purpose, same convention as COUNTRY_LABELS: it is never one of the
// "other countries" this app tags, so it's never a code here either, even
// where the U.S. is a real member (G7, G20, NATO, USMCA).
//
// As of: 2026-09-26.
//   NATO -- 32 members since Sweden's March 2024 accession (nato.int); 31
//     listed here plus the always-implicit US.
//   G7 -- Canada, France, Germany, Italy, Japan, UK, US; the EU also
//     participates in every G7 summit without being a member state (g7.org).
//   G20 -- the 19 member countries plus the EU (g20.org). The African Union
//     joined as a member in 2023, but has no ISO country code of its own and
//     is commonly abbreviated "AU" -- the same code this app already uses
//     for Australia -- so it's left out rather than risk that collision;
//     there is no synthetic marker for it the way 'EU' is for the European
//     Union.
//   BRICS -- founding five (Brazil, Russia, India, China, South Africa,
//     2010). The 2024 expansion (Egypt, Ethiopia, Iran, UAE, Saudi Arabia) is
//     left out to avoid disputed/partial membership as of this date -- Iran
//     and the UAE are tracked countries but not counted as BRICS members
//     here.
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
  NATO: [
    'AL', 'BE', 'BG', 'CA', 'HR', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS', 'IT', 'LV', 'LT', 'LU', 'ME',
    'NL', 'MK', 'NO', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'TR', 'GB',
  ],
  G7: ['CA', 'FR', 'DE', 'IT', 'JP', 'GB', 'EU'],
  G20: ['AR', 'AU', 'BR', 'CA', 'CN', 'FR', 'DE', 'IN', 'ID', 'IT', 'JP', 'MX', 'RU', 'SA', 'ZA', 'KR', 'TR', 'GB', 'EU'],
  BRICS: ['BR', 'RU', 'IN', 'CN', 'ZA'],
  USMCA: ['CA', 'MX'],
};

// NATO's own "partners across the globe" program (nato.int) -- a real,
// named relationship, but a different kind of fact than formal membership
// above, so it gets its own array rather than being forced into the Bloc
// union. As of 2026-10-01: Australia, Colombia, Iraq, Japan, Mongolia, New
// Zealand, Pakistan, Republic of Korea. Afghanistan is left out: NATO's own
// page notes that partnership is currently suspended.
export const PARTNER_COUNTRIES: string[] = ['AU', 'CO', 'IQ', 'JP', 'MN', 'NZ', 'PK', 'KR'];

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
