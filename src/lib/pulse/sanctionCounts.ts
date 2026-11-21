import { extractCountries } from './country.js';
import { MAX_FOCUS_COUNTRIES } from './links.js';

// How many listed parties have an address in each country, across the OFAC SDN, BIS/State
// consolidated screening, UN Security Council and UK sanctions lists. Addresses are free text
// (the sources carry no country code), so this is the same address-text match the sanctions
// browser uses, and is labelled that way wherever it is shown.

export type SanctionList = 'sdn' | 'csl' | 'un' | 'uk';

export interface PartyCountryCount {
  country: string;
  count: number;
}

export interface PartyCountryCountBySource extends PartyCountryCount {
  /** The same count split by list. A party on several lists is counted once per list, so these add up to `count`. */
  bySource: Record<SanctionList, number>;
}

/** "Hong Kong, China" and "Macau, China" name one place, not two: keep the territory and drop the trailing China so China is not also credited. */
export function foldChinaTerritories(text: string): string {
  return text.replace(/\b(Hong Kong|Macau|Macao)(\s+S\.?A\.?R\.?)?\s*,?\s*(?:the\s+)?(?:People'?s Republic of )?China\b/gi, '$1');
}

function countOne(text: string): string[] {
  // A party whose text names many countries is a roundup (e.g. a long list of branches),
  // not evidence about any one of them -- same rule as the cross-topic links.
  const found = extractCountries(foldChinaTerritories(text));
  if (found.length === 0 || found.length > MAX_FOCUS_COUNTRIES) return [];
  return found.filter((code) => code !== 'US'); // this measure is about parties abroad
}

/** One entry per listed party: the text to search for country names (addresses, nationality). */
export function tallyCountries(partyTexts: string[]): PartyCountryCount[] {
  const counts = new Map<string, number>();
  for (const text of partyTexts) {
    for (const code of countOne(text)) counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return [...counts.entries()].map(([country, count]) => ({ country, count })).sort((a, b) => b.count - a.count || a.country.localeCompare(b.country));
}

/** Same tally, kept separate per list so OFAC sanctions are not blurred with Commerce/State export-control listings. */
export function tallyBySource(lists: Record<SanctionList, string[]>): PartyCountryCountBySource[] {
  const out = new Map<string, PartyCountryCountBySource>();
  for (const list of Object.keys(lists) as SanctionList[]) {
    for (const text of lists[list]) {
      for (const code of countOne(text)) {
        const row = out.get(code) ?? { country: code, count: 0, bySource: { sdn: 0, csl: 0, un: 0, uk: 0 } };
        row.count++;
        row.bySource[list]++;
        out.set(code, row);
      }
    }
  }
  return [...out.values()].sort((a, b) => b.count - a.count || a.country.localeCompare(b.country));
}
