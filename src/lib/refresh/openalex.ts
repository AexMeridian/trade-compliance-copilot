// Scientific co-authorship, from OpenAlex (api.openalex.org: keyless, data under CC0). For each partner country, one request asks how
// many works have at least one author based there, broken down by the other authors' countries; one more request gives every
// country's total. A country's share is its co-authored works with the partner divided by its own total. It is a bilateral tie in
// knowledge: who a country's researchers work with.
import type { Env } from '../../types/env.js';
import type { SeriesByCountry } from '../power/compute.js';
import { changeGate } from './changeGate.js';
import { fetchCountryCodes } from './countryCodes.js';
import { getJson, upsertIndicators } from './indicatorStore.js';
import type { RefreshResult } from './types.js';

const API = 'https://api.openalex.org/works';
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
  const [codes, totalsBody, ...partnerBodies] = await Promise.all([
    fetchCountryCodes(),
    getJson(`${API}?filter=${window}&group_by=authorships.countries`, 30_000),
    ...PARTNERS.map((p) => getJson(`${API}?filter=authorships.countries:${p.cc},${window}&group_by=authorships.countries`, 30_000)),
  ]);
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
