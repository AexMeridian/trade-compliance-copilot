// Scientific co-authorship, from OpenAlex (api.openalex.org: keyless, data under CC0). For each partner country, one request asks how
// many works have at least one author based there, broken down by the other authors' countries; one more request gives every
// country's total. A country's share is its co-authored works with the partner divided by its own total. It is a bilateral tie in
// knowledge: who a country's researchers work with.
import type { Env } from '../../types/env.js';
import type { SeriesByCountry } from '../power/compute.js';
import { changeGate } from './changeGate.js';
import { fetchCountryCodes } from './countryCodes.js';
import { upsertIndicators } from './indicatorStore.js';
import { USER_AGENT } from './userAgent.js';
import type { RefreshResult } from './types.js';

const API = 'https://api.openalex.org/works';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * One OpenAlex request, polite and patient. OpenAlex answers HTTP 429 to anonymous callers that send several requests at once (the cause of this job's
 * "critical" status in /api/pulse/data-status), and prefers callers that identify themselves with a `mailto` (the "polite pool", much higher limits).
 * So: the address is added when OPENALEX_MAILTO is set, and a 429 or 5xx is retried after the server's Retry-After (capped) or a growing pause.
 */
export async function openAlexJson(url: string, mailto?: string, attempts = 4, pause: (ms: number) => Promise<void> = sleep): Promise<unknown> {
  const full = mailto ? `${url}${url.includes('?') ? '&' : '?'}mailto=${encodeURIComponent(mailto)}` : url;
  let last = '';
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const res = await fetch(full, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(30_000) });
    if (res.ok) return res.json();
    last = `HTTP ${res.status} from api.openalex.org`;
    if (res.status !== 429 && res.status < 500) break;
    const retryAfter = Number(res.headers.get('retry-after'));
    await pause(Math.min(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1500 * attempt, 8000));
  }
  throw new Error(last);
}
/** Partner countries and the indicator each one produces. */
export const PARTNERS: { cc: string; id: string }[] = [
  { cc: 'US', id: 'coauthor_us' },
  { cc: 'CN', id: 'coauthor_cn' },
  { cc: 'RU', id: 'coauthor_ru' },
  { cc: 'GB', id: 'coauthor_gb' },
];
/** A country with fewer works than this in the window is left out: a handful of papers makes a share meaningless. */
export const MIN_WORKS = 1000;

/** group_by response -> { country code: works }. Keys look like "https://openalex.org/countries/US". */
export function parseGroups(body: unknown): Map<string, number> {
  const groups = (body as { group_by?: unknown })?.group_by;
  if (!Array.isArray(groups)) throw new Error('OpenAlex response shape changed -- expected { group_by: [...] }');
  const out = new Map<string, number>();
  for (const g of groups as { key?: string; count?: number }[]) {
    const cc = /\/countries\/([A-Z]{2})$/.exec(g?.key ?? '')?.[1];
    if (cc && typeof g.count === 'number' && Number.isFinite(g.count)) out.set(cc, g.count);
  }
  return out;
}

/** Share (percent, one decimal) of each country's works that it co-authored with the partner. The partner itself is skipped. */
export function shares(totals: Map<string, number>, withPartner: Map<string, number>, partner: string, endYear: number, countries: Set<string>): SeriesByCountry {
  const out: SeriesByCountry = {};
  for (const [cc, total] of totals) {
    if (cc === partner || !countries.has(cc) || total < MIN_WORKS) continue;
    const n = withPartner.get(cc);
    if (n === undefined) continue; // the breakdown lists the top 200 countries; a missing one has no reading, not zero
    out[cc] = [[endYear, Math.round((n / total) * 1000) / 10]];
  }
  return out;
}

export async function refreshOpenAlex(env: Env): Promise<RefreshResult> {
  const last = new Date().getUTCFullYear() - 1; // the last full year
  const window = `publication_year:${last - 4}-${last}`;
  // One request at a time: five at once is what OpenAlex rate-limited.
  const codes = await fetchCountryCodes();
  const totalsBody = await openAlexJson(`${API}?filter=${window}&group_by=authorships.countries`, env.OPENALEX_MAILTO);
  const partnerBodies: unknown[] = [];
  for (const p of PARTNERS) {
    await sleep(300);
    partnerBodies.push(await openAlexJson(`${API}?filter=authorships.countries:${p.cc},${window}&group_by=authorships.countries`, env.OPENALEX_MAILTO));
  }
  const totals = parseGroups(totalsBody);
  if (totals.size < 100) throw new Error(`OpenAlex returned ${totals.size} countries, expected at least 100`);

  const series = new Map<string, { code: string; data: SeriesByCountry }>();
  PARTNERS.forEach((p, i) => {
    const data = shares(totals, parseGroups(partnerBodies[i]), p.cc, last, codes.iso2);
    if (Object.keys(data).length < 80) throw new Error(`OpenAlex co-authorship with ${p.cc} covers ${Object.keys(data).length} countries, expected at least 80`);
    series.set(p.id, { code: `openalex:${p.cc}`, data });
  });

  const gate = await changeGate(env, 'openalex', JSON.stringify([...series.entries()]));
  if (gate.unchanged) return { source: 'openalex', rows: 0, unchanged: true };
  const rows = await upsertIndicators(env, series);
  await gate.commit();
  return { source: 'openalex', rows };
}
