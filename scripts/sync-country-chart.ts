// Rebuilds the Commerce Country Chart from the official table (eCFR, 15 CFR Part 738 Supplement No. 1) instead of by hand.
//
//   npx tsx scripts/sync-country-chart.ts            report whether the published chart differs from data/country-chart.json (exit 1 if it does)
//   npx tsx scripts/sync-country-chart.ts --write    also write the new snapshot and the next numbered migration
//
// Run weekly by .github/workflows/data-pr.yml, which opens a pull request when --write produced a change. The owner reads the diff, merges, and
// the deploy applies the migration. No model, no secrets. A column layout or country name it does not recognise stops it instead of guessing.

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parseCountryChart, FAMILY_NAME, type ChartColumn } from '../src/lib/chartParse.js';
import { CHART_NAME_TO_ISO, DISPLAY_NAME } from '../src/lib/chartNames.js';

const SNAPSHOT = 'data/country-chart.json';
const PAGE = 'https://www.ecfr.gov/current/title-15/part-738/appendix-Supplement%20No.%201%20to%20Part%20738';
// Destinations governed by Part 746 rather than by plain chart marks keep their special coverage status; their chart marks are still loaded.
const SPECIAL = new Set(['CU', 'IR', 'KP', 'SY', 'RU', 'BY']);

interface Snapshot {
  amended: string;
  countries: Record<string, { name: string; marked: ChartColumn[] }>;
}

const write = process.argv.includes('--write');
const today = new Date().toISOString().slice(0, 10);
const sq = (s: string) => `'${s.replace(/'/g, "''")}'`;

async function get(url: string): Promise<Response> {
  const res = await fetch(url, { headers: { 'user-agent': 'AexTerminal-data-sync/1.0 (+https://aexterminal.com)' } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res;
}

// The eCFR serves a title only as of a date it has processed, which trails today by a few days; ask it which date that is.
const titles = (await (await get('https://www.ecfr.gov/api/versioner/v1/titles.json')).json()) as { titles: { number: number; up_to_date_as_of: string }[] };
const asOf = titles.titles.find((t) => t.number === 15)?.up_to_date_as_of;
if (!asOf) throw new Error('The eCFR did not report an up-to-date date for title 15');
const xml = await (await get(`https://www.ecfr.gov/api/versioner/v1/full/${asOf}/title-15.xml?part=738&appendix=Supplement%20No.%201%20to%20Part%20738`)).text();
const versions = (await (await get('https://www.ecfr.gov/api/versioner/v1/versions/title-15.json?part=738')).json()) as { content_versions: { amendment_date: string }[] };
const amended = versions.content_versions.map((v) => v.amendment_date).sort().pop() ?? today;

const rows = parseCountryChart(xml);
const unmapped = rows.filter((r) => !(r.name in CHART_NAME_TO_ISO)).map((r) => r.name);
if (unmapped.length > 0) {
  console.error(`Not in src/lib/chartNames.ts, add them: ${unmapped.join(' | ')}`);
  process.exit(2);
}

const countries: Snapshot['countries'] = {};
for (const r of rows) countries[CHART_NAME_TO_ISO[r.name]] = { name: DISPLAY_NAME[r.name] ?? r.name, marked: r.marked };
// The chart's footnote for Liechtenstein: "Refer to Switzerland for licensing requirements for Liechtenstein".
if (countries.LI && countries.LI.marked.length === 0 && countries.CH) countries.LI.marked = [...countries.CH.marked];
const snapshot: Snapshot = { amended, countries: Object.fromEntries(Object.entries(countries).sort(([a], [b]) => a.localeCompare(b))) };

const previous: Snapshot | null = existsSync(SNAPSHOT) ? (JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as Snapshot) : null;
const same = previous && JSON.stringify(previous.countries) === JSON.stringify(snapshot.countries);
console.log(`${Object.keys(snapshot.countries).length} destinations, chart last amended ${amended}; ${same ? 'identical to the stored snapshot' : 'DIFFERENT from the stored snapshot'}`);
if (previous && !same) {
  for (const [iso, c] of Object.entries(snapshot.countries)) {
    const old = previous.countries[iso];
    if (!old) console.log(`  new: ${iso} ${c.name}`);
    else if (old.marked.join() !== c.marked.join()) console.log(`  changed: ${iso} ${c.name}: ${old.marked.join(' ') || '(none)'} -> ${c.marked.join(' ') || '(none)'}`);
  }
}
if (same) process.exit(0);
if (!write) process.exit(1);

mkdirSync('data', { recursive: true });
writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 1) + '\n');

const next = Math.max(...readdirSync('migrations').map((f) => Number(f.slice(0, 4)))) + 1;
const file = `migrations/${String(next).padStart(4, '0')}_country_chart_${amended.replace(/-/g, '')}.sql`;
// The migration is kept compact: D1 limits the size of a statement, so the marks go in as short (country, column) pairs and the names,
// labels and source are filled in by SQL.
const marks: string[] = [];
const coverageValues: string[] = [];
for (const [iso, c] of Object.entries(snapshot.countries)) {
  for (const col of c.marked) marks.push(`(${sq(iso)},${sq(col)})`);
  if (!SPECIAL.has(iso)) coverageValues.push(`(${sq(iso)},${sq(c.name)},'curated',${sq(`From the official Country Chart, last amended ${amended}.`)},${sq(PAGE)},1,${sq(today)})`);
}
const batches = (head: string, values: string[], size: number) =>
  Array.from({ length: Math.ceil(values.length / size) }, (_, i) => `${head}\n${values.slice(i * size, (i + 1) * size).join(',\n')};`).join('\n');
const labelCase = Object.entries(FAMILY_NAME).map(([k, v]) => `WHEN '${k}' THEN '${v}'`).join(' ');
const sql = `-- Commerce Country Chart (15 CFR 738 Supp. 1), loaded from the eCFR on ${today}; chart last amended ${amended}.
-- Generated by scripts/sync-country-chart.ts. Replaces the hand-entered rows, which marked NS1 and NS2 for allies and omitted every other column.
-- Embargoed and Part 746 destinations (${[...SPECIAL].join(', ')}) keep their coverage status.
DELETE FROM country_chart;
DELETE FROM country_chart_coverage WHERE status IN ('curated', 'not_curated');
${batches('INSERT INTO country_chart_coverage (country_code, country_name, status, notes, source_url, source_tier, last_updated) VALUES', coverageValues, 40)}
${marks
  .reduce<string[][]>((acc, m, i) => ((i % 400 === 0 ? acc.push([m]) : acc[acc.length - 1].push(m)), acc), [])
  .map(
    (chunk) =>
      `WITH v(c, r) AS (VALUES ${chunk.join(',')})
INSERT INTO country_chart (country_code, country_name, reason_for_control, control_level, source_url, source_tier, last_updated)
SELECT v.c, cov.country_name, v.r, CASE substr(v.r, 1, 2) ${labelCase} END || ', Column ' || substr(v.r, 3), ${sq(PAGE)}, 1, ${sq(today)}
FROM v JOIN country_chart_coverage cov ON cov.country_code = v.c;`
  )
  .join('\n')}
`;
writeFileSync(file, sql);
console.log(`wrote ${SNAPSHOT} and ${file} (${sql.length} bytes)`);
