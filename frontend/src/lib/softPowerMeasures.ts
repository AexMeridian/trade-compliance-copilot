import type { AfroOpinion, OpinionResponse, PowerIndicator } from './api';
import type { AtlasMeasure } from '../components/MeasureAtlas';
import { formatValue } from './powerFormat';
import { surveysFor } from '../components/AttitudesPanel';

// Building the maps' measures from the data the site already serves: indicator series (every country's latest value) and the
// opinion readings. Nothing is estimated: a country with no reading is simply absent from `values`.

export function atlasFromIndicator(ind: PowerIndicator): AtlasMeasure {
  return {
    id: ind.id,
    label: ind.label,
    kind: 'sequential',
    values: Object.fromEntries(ind.distribution),
    format: (v) => formatValue(ind.unit, v),
    asOf: ind.latestYear ? String(ind.latestYear) : null,
  };
}

const lead = (v: number, a: string, b: string, unit: string) => (v === 0 ? 'Even' : v > 0 ? `${a} ahead by ${v} ${unit}` : `${b} ahead by ${-v} ${unit}`);

/** Pew: favorable view of the U.S. minus favorable view of China, in points, for countries polled on both that year. */
export function atlasOpinionGap(data: OpinionResponse, year: number): AtlasMeasure | null {
  const { us, cn } = surveysFor(data, year);
  if (!us || !cn) return null;
  const values: Record<string, number> = {};
  for (const [cc, u] of Object.entries(us.favorable)) {
    const c = cn.favorable[cc];
    if (c !== undefined) values[cc] = u - c;
  }
  return {
    id: 'pew-gap',
    label: `Favorable view of the U.S. minus China, ${year}`,
    kind: 'diverging',
    values,
    format: (v) => lead(v, 'U.S.', 'China', 'points'),
    diverging: { left: 'favorable to China', right: 'favorable to the U.S.', near: 7, edge: 20 },
    asOf: `Spring ${year}`,
  };
}

/** Afrobarometer: share saying U.S. influence is positive minus share saying China's is, in points. */
export function atlasAfricaGap(a: AfroOpinion): AtlasMeasure {
  const values = Object.fromEntries(Object.entries(a.countries).map(([cc, v]) => [cc, v.us.pos - v.cn.pos]));
  return {
    id: 'afro-gap',
    label: 'Influence rated positive: U.S. minus China',
    kind: 'diverging',
    values,
    format: (v) => lead(v, 'U.S.', 'China', 'points'),
    diverging: { left: 'positive on China', right: 'positive on the U.S.', near: 5, edge: 15 },
    asOf: 'Afrobarometer Round 10, 2024-25',
  };
}
