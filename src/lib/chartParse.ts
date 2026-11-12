// Reads the Commerce Country Chart (15 CFR Part 738, Supplement No. 1) from the eCFR's XML into one record per country and marked column.
// The table is a single HTML-style table: one header row with the reason families, one with the column ids (CB 1, CB 2, ... AT 2), then one row
// per country with an X where a license is required for that reason. Rows with fewer cells are footnotes. Pure: no network, so it is tested
// against a fixture; scripts/sync-country-chart.ts does the download.

export const CHART_COLUMNS = ['CB1', 'CB2', 'CB3', 'NP1', 'NP2', 'NS1', 'NS2', 'MT1', 'RS1', 'RS2', 'FC1', 'CC1', 'CC2', 'CC3', 'AT1', 'AT2'] as const;
export type ChartColumn = (typeof CHART_COLUMNS)[number];

export const FAMILY_NAME: Record<string, string> = {
  CB: 'Chemical and Biological Weapons',
  NP: 'Nuclear Nonproliferation',
  NS: 'National Security',
  MT: 'Missile Technology',
  RS: 'Regional Stability',
  FC: 'Firearms Convention',
  CC: 'Crime Control',
  AT: 'Anti-Terrorism',
};

export const columnLabel = (col: string) => `${FAMILY_NAME[col.slice(0, 2)] ?? col.slice(0, 2)}, Column ${col.slice(2)}`;

export interface ChartRow {
  name: string;
  marked: ChartColumn[];
}

const clean = (html: string) =>
  html
    .replace(/<br\s*\/?>(<\/br>)?/gi, ' ')
    .replace(/<sup>[\s\S]*?<\/sup>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#?\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Parses the first table in the supplement's XML. Throws if the header is not the expected 16 columns, so a changed layout stops the import. */
export function parseCountryChart(xml: string): ChartRow[] {
  const start = xml.indexOf('<TABLE');
  const end = xml.indexOf('</TABLE>', start);
  if (start < 0 || end < 0) throw new Error('No table found in the Country Chart XML');
  const rows = [...xml.slice(start, end).matchAll(/<TR>([\s\S]*?)<\/TR>/g)].map((m) => [...m[1].matchAll(/<T[DH][^>]*>([\s\S]*?)<\/T[DH]>/g)].map((c) => clean(c[1])));
  const header = rows.find((r) => r.length === 16 && r[0].replace(/\s/g, '') === 'CB1');
  if (!header) throw new Error('Country Chart column header row not found');
  const ids = header.map((h) => h.replace(/\s/g, ''));
  if (ids.join(',') !== CHART_COLUMNS.join(',')) throw new Error(`Country Chart columns changed: ${ids.join(',')}`);
  const out: ChartRow[] = [];
  for (const r of rows) {
    if (r.length !== 17 || r === header) continue;
    out.push({ name: r[0], marked: CHART_COLUMNS.filter((_, i) => r[i + 1].toUpperCase() === 'X') });
  }
  if (out.length < 150) throw new Error(`Only ${out.length} countries parsed from the Country Chart; expected about 200`);
  return out;
}
