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

export function parseCountries(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
