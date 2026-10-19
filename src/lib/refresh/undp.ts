// Human development indicators from the UNDP Human Development Report Office's composite-indices time series (one CSV, no key,
// CC BY 3.0 IGO: commercial reuse with credit, a link to the licence and a note of any changes). One row per country with a column
// per year ("hdi_2023", "gii_2023", "mys_2023"). Only the human development index, the gender inequality index and mean years of
// schooling are kept.
import type { Env } from '../../types/env.js';
import type { SeriesByCountry } from '../power/compute.js';
import { changeGate } from './changeGate.js';
import { fetchCountryCodes } from './countryCodes.js';
import { getText, upsertIndicators } from './indicatorStore.js';
import type { RefreshResult } from './types.js';
import { splitCsvLine } from './unVoting.js';

const URL = 'https://hdr.undp.org/sites/default/files/2025_HDR/HDR25_Composite_indices_complete_time_series.csv';
const KEEP_POINTS = 12;
const PREFIXES = { hdi: 'hdi', gii: 'gii', mys: 'mys' } as const;
export type UndpSeries = Record<keyof typeof PREFIXES, SeriesByCountry>;

/** Wide CSV (a column per year) -> one series per measure, real countries only. */
export function parseUndp(csv: string, iso3ToIso2: Map<string, string>): UndpSeries {
  const lines = csv.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) throw new Error('UNDP file is empty');
  const header = splitCsvLine(lines[0]).map((h) => h.trim());
  const iso3Col = header.indexOf('iso3');
  if (iso3Col < 0) throw new Error('UNDP file shape changed -- expected an iso3 column');
  const yearCols: { measure: keyof typeof PREFIXES; year: number; col: number }[] = [];
  header.forEach((h, col) => {
    const m = /^(hdi|gii|mys)_(\d{4})$/.exec(h);
    if (m) yearCols.push({ measure: m[1] as keyof typeof PREFIXES, year: Number(m[2]), col });
  });
  if (yearCols.length === 0) throw new Error('UNDP file shape changed -- no hdi_YYYY columns');

  const out: UndpSeries = { hdi: {}, gii: {}, mys: {} };
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const cc = iso3ToIso2.get((cells[iso3Col] ?? '').trim());
    if (!cc) continue;
    for (const { measure, year, col } of yearCols) {
      const raw = (cells[col] ?? '').trim();
      const v = raw === '' || raw === '..' ? NaN : Number(raw);
      if (Number.isFinite(v)) (out[measure][cc] ??= []).push([year, Math.round(v * 10_000) / 10_000]);
    }
  }
  for (const m of Object.values(out)) {
    for (const cc of Object.keys(m)) {
      m[cc].sort((a, b) => a[0] - b[0]);
      if (m[cc].length > KEEP_POINTS) m[cc] = m[cc].slice(-KEEP_POINTS);
    }
  }
  return out;
}

export async function refreshUndp(env: Env): Promise<RefreshResult> {
  const [codes, csv] = await Promise.all([fetchCountryCodes(), getText(URL, 45_000)]);
  const data = parseUndp(csv, codes.iso3ToIso2);
  if (Object.keys(data.hdi).length < 150) throw new Error(`UNDP returned ${Object.keys(data.hdi).length} countries with an index, expected at least 150`);

  const gate = await changeGate(env, 'undp_hdr', JSON.stringify(data));
  if (gate.unchanged) return { source: 'undp_hdr', rows: 0, unchanged: true };
  const rows = await upsertIndicators(
    env,
    new Map([
      ['hdi', { code: 'hdi', data: data.hdi }],
      ['gii', { code: 'gii', data: data.gii }],
      ['mean_schooling', { code: 'mys', data: data.mys }],
    ]),
  );
  await gate.commit();
  return { source: 'undp_hdr', rows };
}
