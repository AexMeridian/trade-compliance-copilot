// Edge-cache keys built only from the query parameters an endpoint really reads, each reduced to the value the endpoint
// itself would use. Reordered, repeated, junk or out-of-range parameters therefore share one entry, so a client cannot mint
// unlimited cache keys (each miss reads thousands of database rows). The handlers apply the same limits, so the key always
// describes the response.
import { TOPICS } from './topic.js';
import { clampInt } from '../../routes/pulse/util.js';
import { isKnownCountryName, isNameOfCountry, KNOWN_COUNTRY_CODES } from './country.js';

/** Largest list offset anyone can ask for; the longest list (sanctions) is paged well inside this. */
export const MAX_OFFSET = 10_000;

type Param = (raw: string | null, all: URLSearchParams) => string | null;

const intParam = (def: number, min: number, max?: number): Param => (raw) => String(clampInt(raw ?? undefined, { default: def, min, max }));
const oneOf = (allowed: readonly string[]): Param => (raw) => (raw && allowed.includes(raw) ? raw : null);
const slug: Param = (raw) => (raw && /^[A-Za-z0-9_]{1,40}$/.test(raw) ? raw : null);
const code: Param = (raw) => {
  const c = raw?.toUpperCase();
  return c && /^[A-Z]{2}$/.test(c) && KNOWN_COUNTRY_CODES.has(c) ? c : null;
};
const countryName: Param = (raw) => (raw && isKnownCountryName(raw) ? raw.trim().toLowerCase() : null);
// A display name is only meaningful for the code it names, so it is part of the key only when it is that code's name.
const nameFor = (codeParam: string): Param => (raw, all) => {
  const c = code(all.get(codeParam), all);
  return c && raw && isNameOfCountry(c, raw) ? raw.trim().toLowerCase() : null;
};
const codeList: Param = (raw) => {
  if (!raw) return null;
  const list = raw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  return list.length > 0 && list.length <= 12 && list.every((c) => KNOWN_COUNTRY_CODES.has(c)) ? list.join(',') : null;
};

const NEWS_CATEGORIES = ['Trade & Supply Chain', 'Markets & Currency', 'Elections & Politics', 'Official'];
const paging = { limit: intParam(50, 1, 200), offset: intParam(0, 0, MAX_OFFSET) };

// Endpoint (the path after /api/pulse/) -> the parameters it reads. Anything not listed is dropped from the key.
export const KEY_PARAMS: Record<string, Record<string, Param>> = {
  tariffs: { program: slug, country: slug, ...paging },
  sanctions: { country: countryName, list: oneOf(['sdn', 'csl']), ...paging },
  gta: { country: (raw) => (raw && raw.length <= 60 ? raw : null), ...paging },
  wro: { country: code, status: oneOf(['Active']), ...paging },
  // A valid `countries` group wins over `country` and `name` in the handler, so they are not part of the key then.
  connections: {
    country: (raw, all) => (codeList(all.get('countries'), all) ? null : code(raw, all)),
    countries: codeList,
    name: (raw, all) => (codeList(all.get('countries'), all) ? null : nameFor('country')(raw, all)),
    days: intParam(60, 7, 180),
    topic: oneOf(TOPICS),
  },
  related: { kind: oneOf(['action', 'news']), id: (raw) => (raw && raw.length <= 80 ? raw : null), days: intParam(14, 1, 60) },
  convergence: { days: intParam(60, 7, 90), limit: intParam(8, 1, 20) },
  'recent-listings': { days: intParam(30, 7, 90) },
  markets: { days: intParam(70, 30, 430) },
  news: { limit: intParam(30, 1, 60), category: oneOf(NEWS_CATEGORIES) },
  tempo: { months: intParam(24, 6, 120) },
};

/** The key for a request to `/api/pulse/<endpoint>`: origin and path plus only the endpoint's own, normalized parameters. */
export function pulseCacheKey(endpoint: string): (url: URL) => string {
  const spec = KEY_PARAMS[endpoint] ?? {};
  return (url) => {
    const params = url.searchParams;
    const parts: string[] = [];
    for (const name of Object.keys(spec).sort()) {
      const v = spec[name](params.get(name), params);
      if (v !== null) parts.push(`${name}=${encodeURIComponent(v)}`);
    }
    return `${url.origin}${url.pathname}${parts.length ? `?${parts.join('&')}` : ''}`;
  };
}

/** Key for /country/:code: the code in the path (validated before this runs) and the display name only when it is that country's. */
export function countryCacheKey(url: URL): string {
  const c = url.pathname.split('/').pop()?.toUpperCase() ?? '';
  const name = url.searchParams.get('name');
  return `${url.origin}${url.pathname.toUpperCase()}${name && isNameOfCountry(c, name) ? `?name=${encodeURIComponent(name.trim().toLowerCase())}` : ''}`;
}
