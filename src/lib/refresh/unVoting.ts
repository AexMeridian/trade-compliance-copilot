// UN General Assembly ideal points (Bailey, Strezhnev and Voeten, 2017), Harvard Dataverse, CC0. One estimate per country per
// session (= year) from 1946; the site keeps 2000 onward. Distances from the United States, China and Russia are worked out
// when requested (src/lib/power/compute.ts), so only the positions are stored.
import type { Env } from '../../types/env.js';
import type { SeriesByCountry } from '../power/compute.js';
import { changeGate } from './changeGate.js';
import { fetchCountryCodes } from './countryCodes.js';
import { getText, upsertIndicators } from './indicatorStore.js';
import type { RefreshResult } from './types.js';

export const IDEAL_POINTS_URL = 'https://dataverse.harvard.edu/api/access/datafile/14098429';
const FIRST_YEAR = 2000;

/** Splits one CSV line, honoring double-quoted fields (country names can contain commas). */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

export function parseIdealPoints(csv: string, iso3ToIso2: Map<string, string>): SeriesByCountry {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  const header = splitCsvLine(lines[0] ?? '');
  const iIso = header.indexOf('iso3c');
  const iPoint = header.indexOf('IdealPointFP');
  const iYear = header.indexOf('year');
  if (iIso < 0 || iPoint < 0 || iYear < 0) throw new Error('UN ideal-point file changed -- expected iso3c, IdealPointFP and year columns');
  const out: SeriesByCountry = {};
  for (const line of lines.slice(1)) {
    const f = splitCsvLine(line);
    const cc = iso3ToIso2.get(f[iIso]);
    const year = Number(f[iYear]);
    const value = Number(f[iPoint]);
    if (!cc || !Number.isInteger(year) || year < FIRST_YEAR || !Number.isFinite(value)) continue;
    (out[cc] ??= []).push([year, Math.round(value * 1000) / 1000]);
  }
  for (const cc of Object.keys(out)) out[cc].sort((a, b) => a[0] - b[0]);
  return out;
}

export async function refreshUnVoting(env: Env): Promise<RefreshResult> {
  const [codes, csv] = await Promise.all([fetchCountryCodes(), getText(IDEAL_POINTS_URL, 45_000)]);
  const data = parseIdealPoints(csv, codes.iso3ToIso2);
  if (Object.keys(data).length < 150) throw new Error(`UN ideal points returned ${Object.keys(data).length} countries, expected at least 150`);
  for (const ref of ['US', 'CN', 'RU']) if (!data[ref]) throw new Error(`UN ideal points have no ${ref} row, so distances cannot be computed`);

  const gate = await changeGate(env, 'un_voting', JSON.stringify(data));
  if (gate.unchanged) return { source: 'un_voting', rows: 0, unchanged: true };
  const rows = await upsertIndicators(env, new Map([['un_ideal_point', { code: 'IdealPointFP', data }]]));
  await gate.commit();
  return { source: 'un_voting', rows };
}
