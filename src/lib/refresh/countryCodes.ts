// Real countries from the World Bank country list, with the lookups the other indicator feeds need: UN voting and UNESCO data
// use three-letter codes, Nobel data uses country names, and everything the site stores is keyed by two-letter code.
// Aggregates such as "World" or "Euro area" carry region id "NA" and are dropped.
import { USER_AGENT } from './userAgent.js';

export interface CountryCodes {
  /** Two-letter codes of real countries. */
  iso2: Set<string>;
  iso3ToIso2: Map<string, string>;
  /** Lower-cased World Bank names, plus the aliases other feeds use, to two-letter codes. */
  nameToIso2: Map<string, string>;
}

// Names other feeds use that differ from the World Bank's. Lower case, without a leading "the".
const NAME_ALIASES: Record<string, string> = {
  usa: 'US', 'united states of america': 'US', russia: 'RU', 'south korea': 'KR', 'north korea': 'KP', 'czech republic': 'CZ', czechia: 'CZ',
  netherlands: 'NL', 'turkey': 'TR', turkiye: 'TR', 'syria': 'SY', 'egypt': 'EG', 'iran': 'IR', 'venezuela': 'VE', 'yemen': 'YE', 'laos': 'LA',
  'slovakia': 'SK', 'kyrgyzstan': 'KG', 'gambia': 'GM', 'bahamas': 'BS', 'congo (democratic republic)': 'CD', 'vietnam': 'VN', 'hong kong': 'HK',
  'macao': 'MO', 'north macedonia': 'MK', 'myanmar': 'MM', 'cabo verde': 'CV', 'eswatini': 'SZ', 'ivory coast': 'CI', 'east timor': 'TL',
  'democratic republic of the congo': 'CD', 'saint lucia': 'LC', 'faroe islands (denmark)': 'FO',
  // The United Nations' formal names, as the humanitarian funding feed spells them.
  'bolivia, plurinational state of': 'BO', 'iran, islamic republic of': 'IR', "korea, democratic people's republic of": 'KP', 'korea, republic of': 'KR',
  "lao people's democratic republic": 'LA', 'moldova, republic of': 'MD', 'tanzania, united republic of': 'TZ', 'venezuela, bolivarian republic of': 'VE',
  'occupied palestinian territory': 'PS', 'congo': 'CG', 'somalia': 'SO',
  // Parts of the United Kingdom, which the Nobel feed lists as places of birth.
  scotland: 'GB', 'northern ireland': 'GB', england: 'GB', wales: 'GB',
};

// Lower case, accents removed, no leading "the", so "Türkiye" and "Turkiye" or "Côte d'Ivoire" and "Cote d'Ivoire" meet.
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/^the\s+/, '').trim();

export function parseCountryCodes(body: unknown): CountryCodes {
  if (!Array.isArray(body) || !Array.isArray(body[1])) throw new Error('World Bank country list shape changed -- expected [meta, rows]');
  const out: CountryCodes = { iso2: new Set(), iso3ToIso2: new Map(), nameToIso2: new Map() };
  for (const r of body[1] as { id?: string; iso2Code?: string; name?: string; region?: { id?: string } }[]) {
    if (!r?.iso2Code || !/^[A-Z]{2}$/.test(r.iso2Code) || !r.region?.id || r.region.id === 'NA') continue;
    out.iso2.add(r.iso2Code);
    if (r.id && /^[A-Z]{3}$/.test(r.id)) out.iso3ToIso2.set(r.id, r.iso2Code);
    if (r.name) out.nameToIso2.set(norm(r.name), r.iso2Code);
  }
  for (const [name, code] of Object.entries(NAME_ALIASES)) if (out.iso2.has(code)) out.nameToIso2.set(name, code);
  return out;
}

export function codeForName(codes: CountryCodes, name: string): string | undefined {
  return codes.nameToIso2.get(norm(name));
}

export async function fetchCountryCodes(): Promise<CountryCodes> {
  const res = await fetch('https://api.worldbank.org/v2/country?format=json&per_page=400', { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from the World Bank country list`);
  const codes = parseCountryCodes(await res.json());
  if (codes.iso2.size < 150) throw new Error('World Bank country list came back too short');
  return codes;
}
