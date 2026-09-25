// Best-effort, text-derived country tagging -- NOT authoritative jurisdiction
// data. The Federal Register API has no country field on a document; this
// regexes the title/abstract for country names instead. Verified against
// real synced titles before writing this (antidumping/CVD titles follow
// consistent USITC/Commerce nomenclature, e.g. "Certain Brake Drums From
// the People's Republic of China", "... From Canada, the People's Republic
// of China, India, the Republic of Korea, and Mexico") -- both bare short
// names and official long-form names appear in the same title, sometimes in
// the same list, so each entry matches both. Deliberately conservative: only
// full country names/well-known long forms, no 2-3 letter abbreviations
// (too many false-positive risks in free text), and no country whose name
// collides with something else common in this domain (e.g. "Georgia" the
// country is omitted -- indistinguishable from the U.S. state in this text).
// A document naming zero, one, or several countries is all expected --
// this is a coverage aid, not a claim that every action has a country.
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

const COUNTRY_PATTERNS: { code: string; pattern: RegExp }[] = [
  { code: 'CN', pattern: /\b(?:People'?s Republic of China|China)\b/i },
  { code: 'VN', pattern: /\b(?:Socialist Republic of Vietnam|Vietnam)\b/i },
  { code: 'KR', pattern: /\b(?:Republic of Korea|South Korea)\b/i },
  { code: 'MX', pattern: /\bMexico\b/i },
  { code: 'CA', pattern: /\bCanada\b/i },
  { code: 'IN', pattern: /\bIndia\b/i },
  { code: 'ID', pattern: /\bIndonesia\b/i },
  { code: 'MY', pattern: /\bMalaysia\b/i },
  { code: 'OM', pattern: /\b(?:Sultanate of Oman|Oman)\b/i },
  { code: 'IT', pattern: /\bItaly\b/i },
  { code: 'JP', pattern: /\bJapan\b/i },
  { code: 'DE', pattern: /\b(?:Federal Republic of Germany|Germany)\b/i },
  { code: 'BR', pattern: /\b(?:Federative Republic of Brazil|Brazil)\b/i },
  { code: 'TW', pattern: /\bTaiwan\b/i },
  { code: 'TH', pattern: /\b(?:Kingdom of Thailand|Thailand)\b/i },
  { code: 'TR', pattern: /\b(?:Republic of T[uü]rkiye|T[uü]rkiye|Turkey)\b/i },
  { code: 'UA', pattern: /\bUkraine\b/i },
  { code: 'RU', pattern: /\b(?:Russian Federation|Russia)\b/i },
  { code: 'IR', pattern: /\b(?:Islamic Republic of Iran|Iran)\b/i },
  { code: 'KP', pattern: /\b(?:Democratic People'?s Republic of Korea|North Korea)\b/i },
  { code: 'CU', pattern: /\bCuba\b/i },
  { code: 'SY', pattern: /\b(?:Syrian Arab Republic|Syria)\b/i },
  { code: 'VE', pattern: /\bVenezuela\b/i },
  { code: 'BY', pattern: /\bBelarus\b/i },
  { code: 'MM', pattern: /\b(?:Myanmar|Burma)\b/i },
  { code: 'AF', pattern: /\bAfghanistan\b/i },
  { code: 'GB', pattern: /\b(?:United Kingdom|U\.K\.)\b/ },
  { code: 'FR', pattern: /\bFrance\b/i },
  { code: 'CH', pattern: /\b(?:Swiss Confederation|Switzerland)\b/i },
  { code: 'IL', pattern: /\bIsrael\b/i },
  { code: 'SA', pattern: /\b(?:Kingdom of Saudi Arabia|Saudi Arabia)\b/i },
  { code: 'AE', pattern: /\bUnited Arab Emirates\b/i },
  { code: 'EU', pattern: /\bEuropean Union\b/i },
];

export function extractCountries(text: string): string[] {
  const hits: string[] = [];
  for (const { code, pattern } of COUNTRY_PATTERNS) {
    if (pattern.test(text)) hits.push(code);
  }
  return hits;
}
