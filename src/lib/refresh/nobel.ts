// Nobel laureates by country, from the Nobel Prize API (CC0, no key). The full laureate list is about 4 MB and changes once a year
// in October, so the job first asks for a single laureate (which returns the total count) and only downloads everything when the
// count has changed since the last load.
import type { Env } from '../../types/env.js';
import type { SeriesByCountry } from '../power/compute.js';
import { changeGate } from './changeGate.js';
import { codeForName, fetchCountryCodes, type CountryCodes } from './countryCodes.js';
import { getJson, upsertIndicators } from './indicatorStore.js';
import type { RefreshResult } from './types.js';

const API = 'https://api.nobelprize.org/2.1/laureates';
const PAGE = 1000;

interface Place {
  countryNow?: { en?: string };
}
export interface Laureate {
  birth?: { place?: Place };
  nobelPrizes?: { awardYear?: string; affiliations?: Place[] }[];
}

/** Counts laureates by present-day birth country, and prizes by the present-day country of each laureate's institution. */
export function countNobel(laureates: Laureate[], codes: CountryCodes): { born: SeriesByCountry; affiliated: SeriesByCountry; unmapped: string[] } {
  const born = new Map<string, number>();
  const affiliated = new Map<string, number>();
  const unmapped = new Set<string>();
  let latest = 0;
  const code = (name: string | undefined) => {
    if (!name) return undefined;
    const cc = codeForName(codes, name);
    if (!cc) unmapped.add(name);
    return cc;
  };
  for (const l of laureates) {
    const b = code(l.birth?.place?.countryNow?.en);
    if (b) born.set(b, (born.get(b) ?? 0) + 1);
    for (const p of l.nobelPrizes ?? []) {
      latest = Math.max(latest, Number(p.awardYear) || 0);
      const countries = new Set((p.affiliations ?? []).map((a) => code(a.countryNow?.en)).filter((c): c is string => !!c));
      for (const c of countries) affiliated.set(c, (affiliated.get(c) ?? 0) + 1);
    }
  }
  const toSeries = (m: Map<string, number>): SeriesByCountry => Object.fromEntries([...m].map(([cc, n]) => [cc, [[latest, n]]]));
  return { born: toSeries(born), affiliated: toSeries(affiliated), unmapped: [...unmapped].sort() };
}

export async function refreshNobel(env: Env): Promise<RefreshResult> {
  const head = (await getJson(`${API}?limit=1`)) as { meta?: { count?: number } };
  const total = head.meta?.count;
  if (typeof total !== 'number' || !Number.isInteger(total) || total < 900) throw new Error('Nobel API shape changed -- expected meta.count');
  const gate = await changeGate(env, 'nobel', String(total));
  if (gate.unchanged) return { source: 'nobel', rows: 0, unchanged: true };

  const codes = await fetchCountryCodes();
  const laureates: Laureate[] = [];
  for (let offset = 0; offset < total; offset += PAGE) {
    const page = (await getJson(`${API}?limit=${PAGE}&offset=${offset}`, 45_000)) as { laureates?: Laureate[] };
    if (!Array.isArray(page.laureates)) throw new Error('Nobel API shape changed -- expected laureates[]');
    laureates.push(...page.laureates);
  }
  if (laureates.length < total * 0.98) throw new Error(`Nobel API returned ${laureates.length} of ${total} laureates`);

  const { born, affiliated, unmapped } = countNobel(laureates, codes);
  if (unmapped.length) console.warn(`Nobel countries not matched to a code: ${unmapped.join(', ')}`);
  const rows = await upsertIndicators(
    env,
    new Map([
      ['nobel_born', { code: 'born', data: born }],
      ['nobel_affiliated', { code: 'affiliated', data: affiliated }],
    ]),
  );
  await gate.commit();
  return { source: 'nobel', rows };
}
