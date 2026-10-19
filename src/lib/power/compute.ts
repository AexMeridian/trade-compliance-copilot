// Pure helpers for the Power profile: nothing here touches the network or the database, so the arithmetic is unit-tested.
import { INDICATORS, sourceFor, type IndicatorDef } from './indicators.js';

export type Series = [year: number, value: number][];
export type SeriesByCountry = Record<string, Series>;

/** A country's latest figure is ranked only if it is within this many years of the newest figure any country has. */
export const STALE_YEARS = 5;

export interface Standing {
  value: number;
  year: number;
  /** 1 = the highest value among ranked countries. */
  rank: number;
  of: number;
}

export interface IndicatorView {
  id: string;
  label: string;
  unit: IndicatorDef['unit'];
  dimension: IndicatorDef['dimension'];
  definition: string;
  caveat: string;
  higherIs: string;
  sourceCode: string;
  source: { name: string; url: string };
  /** Newest year any country reports. */
  latestYear: number | null;
  standings: Record<string, Standing | null>;
  series: Record<string, Series>;
  /** Every ranked country's latest value, sorted ascending, for the dot plot. */
  distribution: [country: string, value: number][];
}

/** Parses a stored data_json blob; a corrupt or empty row yields no data, never an error. */
export function parseStored(json: string | null | undefined): SeriesByCountry {
  if (!json) return {};
  try {
    const raw = JSON.parse(json) as Record<string, unknown>;
    const out: SeriesByCountry = {};
    for (const [cc, pts] of Object.entries(raw)) {
      if (!Array.isArray(pts)) continue;
      const clean = pts.filter((p): p is [number, number] => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
      if (clean.length) out[cc] = clean;
    }
    return out;
  } catch {
    return {};
  }
}

function latest(series: Series | undefined): [number, number] | null {
  if (!series?.length) return null;
  return series[series.length - 1];
}

/** Ranks every country on its newest value and returns the standing of each requested country (null where it has no usable figure). */
export function buildIndicatorView(def: IndicatorDef, data: SeriesByCountry, requested: string[]): IndicatorView {
  const newest = new Map<string, [number, number]>();
  let latestYear = 0;
  for (const [cc, s] of Object.entries(data)) {
    const l = latest(s);
    if (!l) continue;
    newest.set(cc, l);
    if (l[0] > latestYear) latestYear = l[0];
  }
  const ranked = [...newest.entries()].filter(([, [y]]) => y >= latestYear - STALE_YEARS);
  ranked.sort((a, b) => b[1][1] - a[1][1] || a[0].localeCompare(b[0]));
  const rankOf = new Map(ranked.map(([cc], i) => [cc, i + 1]));

  const standings: Record<string, Standing | null> = {};
  const series: Record<string, Series> = {};
  for (const cc of requested) {
    series[cc] = data[cc] ?? [];
    const l = newest.get(cc);
    const rank = rankOf.get(cc);
    standings[cc] = l && rank ? { value: l[1], year: l[0], rank, of: ranked.length } : null;
  }
  return {
    id: def.id,
    label: def.label,
    unit: def.unit,
    dimension: def.dimension,
    definition: def.definition,
    caveat: def.caveat,
    higherIs: def.higherIs,
    sourceCode: def.code,
    source: sourceFor(def),
    latestYear: latestYear || null,
    standings,
    series,
    distribution: ranked.map(([cc, [, v]]) => [cc, v] as [string, number]).reverse(),
  };
}

/** Keeps two-letter codes only, drops repeats, caps the count and sorts, so equivalent requests share one cache entry. */
export function normalizeCountries(raw: string | undefined | null, max = 4): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(',')) {
    const cc = part.trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(cc)) seen.add(cc);
  }
  return [...seen].sort().slice(0, max);
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** The value in `series` for `year`, or failing that the newest earlier year no more than STALE_YEARS back. */
function valueAtOrBefore(series: Series | undefined, year: number): number | undefined {
  if (!series) return undefined;
  for (let i = series.length - 1; i >= 0; i--) if (series[i][0] <= year && year - series[i][0] <= STALE_YEARS) return series[i][1];
  return undefined;
}

/**
 * Adds the series that are calculated from stored ones: each country's gap from the United States, China and Russia in
 * General Assembly voting (same-year positions), and refugees per 1,000 residents (World Bank population, nearest year).
 * Nothing here is estimated: a country-year missing either input is simply absent.
 */
export function deriveRows(rows: Map<string, SeriesByCountry>): Map<string, SeriesByCountry> {
  const out = new Map(rows);
  const positions = rows.get('un_ideal_point');
  const population = rows.get('population');
  const refugees = rows.get('refugees_hosted');
  const humanitarian = rows.get('humanitarian_given');
  for (const def of INDICATORS) {
    if (def.provider !== 'derived') continue;
    const series: SeriesByCountry = {};
    if (def.reference && positions?.[def.reference]) {
      const ref = new Map(positions[def.reference]);
      for (const [cc, pts] of Object.entries(positions)) {
        if (cc === def.reference) continue;
        const gaps = pts.filter(([y]) => ref.has(y)).map(([y, v]) => [y, round3(Math.abs(v - ref.get(y)!))] as [number, number]);
        if (gaps.length) series[cc] = gaps;
      }
    } else if (def.id === 'humanitarian_per_person' && humanitarian && population) {
      for (const [cc, pts] of Object.entries(humanitarian)) {
        const per: Series = [];
        for (const [y, usd] of pts) {
          const pop = valueAtOrBefore(population[cc], y);
          if (pop && pop > 0) per.push([y, Math.round((usd / pop) * 100) / 100]);
        }
        if (per.length) series[cc] = per;
      }
    } else if (def.id === 'refugees_per_1000' && refugees && population) {
      for (const [cc, pts] of Object.entries(refugees)) {
        const per: Series = [];
        for (const [y, n] of pts) {
          const pop = valueAtOrBefore(population[cc], y);
          if (pop && pop > 0) per.push([y, round3((n / pop) * 1000)]);
        }
        if (per.length) series[cc] = per;
      }
    }
    out.set(def.id, series);
  }
  return out;
}

export function buildPowerView(rows: Map<string, SeriesByCountry>, requested: string[]): IndicatorView[] {
  return INDICATORS.filter((def) => !def.hidden).map((def) => buildIndicatorView(def, rows.get(def.id) ?? {}, requested));
}
