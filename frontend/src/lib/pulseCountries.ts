import type { PulseCountryDetail } from '../types/pulse';
import { WORLD_NAME_FOR } from './worldCountries';

// Every country the globe can actually select now gets a display label, not
// just the ~33 this app has U.S. trade-policy data for -- sourced from
// worldCountries.ts's crosswalk (itself copied verbatim from the bundled
// map data), so this table can't drift out of sync with what the globe
// shows on hover. 'US' is left out on purpose: no action or headline is ever
// tagged with it, and every place that names the U.S. does so with its own
// hardcoded "United States" text rather than this table. 'EU' isn't a real
// country (it has no numeric id in the map data) -- it means "a document
// named the European Union itself", so it's added back by hand.
//
// Naming policy: full, current English short names in the style the United Nations uses, never
// the map file's abbreviations ("Dem. Rep. Congo", "Macedonia"). Naming a place here is for
// identification only and does not imply recognition of its status; that line is repeated on
// the About and Methodology pages. Overrides below replace the map's own label.
const NAME_OVERRIDES: Record<string, string> = {
  BA: 'Bosnia and Herzegovina',
  SB: 'Solomon Islands',
  CF: 'Central African Republic',
  CG: 'Republic of the Congo',
  CD: 'Democratic Republic of the Congo',
  DO: 'Dominican Republic',
  GQ: 'Equatorial Guinea',
  FK: 'Falkland Islands (Malvinas)',
  TF: 'French Southern Territories',
  SS: 'South Sudan',
  EH: 'Western Sahara',
  SZ: 'Eswatini',
  TR: 'Türkiye',
  MK: 'North Macedonia',
  PS: 'State of Palestine',
};

export const COUNTRY_LABELS: Record<string, string> = {
  ...Object.fromEntries(Object.entries(WORLD_NAME_FOR).filter(([code]) => code !== 'US')),
  ...NAME_OVERRIDES,
  EU: 'European Union',
};

// A country doesn't have its own attributed exchange rate unless the U.S.
// tracks a direct pair against it (see src/lib/pulse/markets.ts's FX_META,
// which now covers every currency Frankfurter/the ECB actually publishes a
// reference rate for) -- Eurozone countries share the EUR pair rather than
// each having their own, which is disclosed wherever this is shown, not
// hidden. A country whose own currency isn't on that list (it floats
// against something other than the ones the ECB tracks, or this app simply
// has no mapping yet) shows no FX tile rather than a guessed one. Shared by
// CountryDetail.tsx and PulseCountryCard.tsx rather than duplicated.
export const CURRENCY_FOR: Record<string, string> = {
  DE: 'EUR',
  FR: 'EUR',
  IT: 'EUR',
  CN: 'CNY',
  JP: 'JPY',
  MX: 'MXN',
  CA: 'CAD',
  GB: 'GBP',
  IN: 'INR',
  KR: 'KRW',
  AU: 'AUD',
  BR: 'BRL',
  CH: 'CHF',
  CZ: 'CZK',
  DK: 'DKK',
  HK: 'HKD',
  HU: 'HUF',
  ID: 'IDR',
  IL: 'ILS',
  IS: 'ISK',
  MY: 'MYR',
  NO: 'NOK',
  NZ: 'NZD',
  PH: 'PHP',
  PL: 'PLN',
  RO: 'RON',
  SE: 'SEK',
  SG: 'SGD',
  TH: 'THB',
  TR: 'TRY',
  ZA: 'ZAR',
};

// A country's own stock index, or (where this app doesn't track one) a
// single globally-recognized public company headquartered there -- both are
// real tiles already in src/lib/pulse/markets.ts's MARKET_META, just not
// previously tied to a country. Only the handful this app actually tracks;
// every other country simply shows no private-sector tile rather than a
// guessed or unrelated one. Used by PulseCountryCard.tsx.
export const MARKET_TILE_FOR: Record<string, string> = {
  JP: '^N225', // Nikkei 225
  DE: '^GDAXI', // DAX
  GB: '^FTSE', // FTSE 100
  CN: '000001.SS', // Shanghai Composite
  HK: '^HSI', // Hang Seng
  TW: 'TSM', // no Taiwanese index tracked -- TSMC is this app's closest real bellwether for Taiwan
  KR: '^KS11', // KOSPI
  IN: '^NSEI', // NIFTY 50
  BR: '^BVSP', // Bovespa
};

// Shared between CountryDetail.tsx (the full country page) and
// PulseCountryCard.tsx (the globe's quick-look card), so the wording stays
// identical in both places.
export const STATUS_LABEL: Record<PulseCountryDetail['exportControl']['status'], string> = {
  curated: 'Verified export-control status',
  comprehensive_embargo: 'Comprehensively embargoed',
  broad_restriction_746_5: 'Near-comprehensive license requirement',
  not_curated: 'Not yet verified by this app',
};

export function parseCountries(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
