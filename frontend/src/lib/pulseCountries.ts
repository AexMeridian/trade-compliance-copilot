import type { PulseCountryDetail } from '../types/pulse';

// Mirrors src/lib/pulse/country.ts's COUNTRY_LABELS on the backend -- same
// duplicate-not-import convention as pulse/case types across the
// Worker/frontend boundary. Display labels only; the extraction itself
// (best-effort, text-derived, not authoritative) happens once server-side
// at sync time.
export const COUNTRY_LABELS: Record<string, string> = {
  CN: 'China',
  VN: 'Vietnam',
  KR: 'South Korea',
  MX: 'Mexico',
  CA: 'Canada',
  IN: 'India',
  ID: 'Indonesia',
  MY: 'Malaysia',
  OM: 'Oman',
  IT: 'Italy',
  JP: 'Japan',
  DE: 'Germany',
  BR: 'Brazil',
  TW: 'Taiwan',
  TH: 'Thailand',
  TR: 'Turkey',
  UA: 'Ukraine',
  RU: 'Russia',
  IR: 'Iran',
  KP: 'North Korea',
  CU: 'Cuba',
  SY: 'Syria',
  VE: 'Venezuela',
  BY: 'Belarus',
  MM: 'Myanmar',
  AF: 'Afghanistan',
  GB: 'United Kingdom',
  FR: 'France',
  CH: 'Switzerland',
  IL: 'Israel',
  SA: 'Saudi Arabia',
  AE: 'United Arab Emirates',
  EU: 'European Union',
};

// A country doesn't have its own attributed exchange rate unless the U.S.
// tracks a direct pair against it (see src/lib/pulse/markets.ts's FX_META) --
// Eurozone countries share the EUR pair rather than each having their own,
// which is disclosed wherever this is shown, not hidden. Shared by
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
