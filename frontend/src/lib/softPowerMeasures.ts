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
    note: ind.caveat,
  };
}

const lead = (v: number, a: string, b: string, unit: string) => (v === 0 ? 'Even' : v > 0 ? `${a} ahead by ${v} ${unit}` : `${b} ahead by ${-v} ${unit}`);

const medianOf = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Median favorable view of the U.S. and of China over the countries Pew polled on BOTH that year, so the two figures cover the same
 * places. This site's own median of Pew's published country figures (unweighted: each country counts once, whatever its population);
 * it is not a Pew figure and not the world's opinion. Null when fewer than 5 countries were polled on both.
 */
export function commonCountryMedians(data: OpinionResponse, year: number): { us: number; cn: number; n: number } | null {
  const { us, cn } = surveysFor(data, year);
  if (!us || !cn) return null;
  const common = Object.keys(us.favorable).filter((cc) => cn.favorable[cc] !== undefined);
  if (common.length < 5) return null;
  return { us: Math.round(medianOf(common.map((cc) => us.favorable[cc]))), cn: Math.round(medianOf(common.map((cc) => cn.favorable[cc]))), n: common.length };
}

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
    // Pew's margin of error is roughly 3 to 4 points per country per question, so a gap under about 7 points is within what sampling alone can produce.
    diverging: { left: 'favorable to China', right: 'favorable to the U.S.', near: 7, edge: 20 },
    asOf: `Spring ${year}`,
    note: 'About even means within 7 points, roughly the range Pew survey error can produce; far more means 20 points or more. The U.S. was not polled about itself, so it is blank. Only the West Bank and East Jerusalem were polled in Palestine; Gaza was not.',
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
    note: 'Round 10 fieldwork straddles the January 2025 U.S. aid freeze: countries surveyed before and after it are not strictly comparable. About even means within 5 points; far more means 15 or more.',
  };
}
