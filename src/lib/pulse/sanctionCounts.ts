import { extractCountries } from './country.js';
import { MAX_FOCUS_COUNTRIES } from './links.js';

// How many listed parties have an address in each country, across the OFAC SDN, BIS/State
// consolidated screening, UN Security Council and UK sanctions lists. Addresses are free text
// (the sources carry no country code), so this is the same address-text match the sanctions
// browser uses, and is labelled that way wherever it is shown.

export interface PartyCountryCount {
  country: string;
  count: number;
}

/** One entry per listed party: the text to search for country names (addresses, nationality). */
export function tallyCountries(partyTexts: string[]): PartyCountryCount[] {
  const counts = new Map<string, number>();
  for (const text of partyTexts) {
    // A party whose text names many countries is a roundup (e.g. a long list of branches),
    // not evidence about any one of them -- same rule as the cross-topic links.
    const found = extractCountries(text);
    if (found.length === 0 || found.length > MAX_FOCUS_COUNTRIES) continue;
    for (const code of found) {
      if (code === 'US') continue; // this measure is about parties abroad
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }
  return [...counts.entries()].map(([country, count]) => ({ country, count })).sort((a, b) => b.count - a.count || a.country.localeCompare(b.country));
}
