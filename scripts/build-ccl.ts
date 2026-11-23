// Builds the Commerce Control List (15 CFR Part 774, Supplement No. 1, about 640 ECCNs) into migrations from the official eCFR text, because the
// Worker (free plan) cannot parse the 2 MB XML itself.
//
//   npx tsx scripts/build-ccl.ts                 report whether the published list differs from data/ccl.json (exit 1 if it does)
//   npx tsx scripts/build-ccl.ts --write         also write data/ccl.json and the next numbered migration files (D1-sized chunks)
//   npx tsx scripts/build-ccl.ts --write --first 72   number the migration files from 0072 (the initial load) instead of the next free number
//   npx tsx scripts/build-ccl.ts --xml part774.xml --as-of 2026-11-19   read a saved copy of the eCFR XML instead of downloading it
//
// Run weekly by .github/workflows/ccl-pr.yml, which opens a pull request when --write produced a change. No model, no secrets. The nine ECCNs hand-checked
// in migration 0032 keep their reasons, exceptions and description (origin 'hand_verified'); only their published-text columns are refreshed.

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parseCcl, type CclRow } from '../src/lib/cclParse.js';
import { HAND_VERIFIED_REASONS } from '../src/lib/cclVerified.js';

const SNAPSHOT = 'data/ccl.json';
const SOURCE_URL = 'https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-774/appendix-Supplement%20No.%201%20to%20Part%20774';
const MAX_STATEMENT = 60_000; // D1 limits a statement to 100 KB
const MAX_FILE = 1_200_000; // the list-sync migrations are about 1.5 MB each

interface Snapshot {
  asOf: string;
  amended: string;
  entries: CclRow[];
}

const args = process.argv.slice(2);
const write = args.includes('--write');
const argVal = (flag: string) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const sq = (s: string) => `'${s.replace(/'/g, "''")}'`;

async function get(url: string): Promise<Response> {
  const res = await fetch(url, { headers: { 'user-agent': 'AexTerminal-data-sync/1.0 (+https://aexterminal.com)' } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res;
}

let xml: string;
let asOf: string;
let amended: string;
const xmlFile = argVal('--xml');
if (xmlFile) {
  xml = readFileSync(xmlFile, 'utf8');
  asOf = argVal('--as-of') ?? new Date().toISOString().slice(0, 10);
  amended = asOf;
} else {
  // The eCFR serves a title only as of a date it has processed, which trails today by a few days; ask it which date that is.
  const titles = (await (await get('https://www.ecfr.gov/api/versioner/v1/titles.json')).json()) as { titles: { number: number; up_to_date_as_of: string }[] };
  const date = titles.titles.find((t) => t.number === 15)?.up_to_date_as_of;
  if (!date) throw new Error('The eCFR did not report an up-to-date date for title 15');
  asOf = date;
  xml = await (await get(`https://www.ecfr.gov/api/versioner/v1/full/${asOf}/title-15.xml?part=774`)).text();
  const versions = (await (await get('https://www.ecfr.gov/api/versioner/v1/versions/title-15.json?part=774')).json()) as { content_versions: { amendment_date: string }[] };
  amended = versions.content_versions.map((v) => v.amendment_date).sort().pop() ?? asOf;
}

const entries = parseCcl(xml, 550).sort((a, b) => a.eccn.localeCompare(b.eccn));
const previous: Snapshot | null = existsSync(SNAPSHOT) ? (JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as Snapshot) : null;
const same = !!previous && JSON.stringify(previous.entries) === JSON.stringify(entries);

const unread = entries.filter((e) => e.reasons.includes('VERIFY'));
console.log(`${entries.length} ECCNs parsed from Part 774 (eCFR as of ${asOf}, last amended ${amended}); ${same ? 'identical to the stored snapshot' : previous ? 'DIFFERENT from the stored snapshot' : 'no stored snapshot yet'}`);
console.log(`${unread.length} entries have no readable Reason for Control (ITAR cross-references and the like) and are stored as "VERIFY", never as uncontrolled: ${unread.map((e) => e.eccn).join(' ')}`);
for (const [eccn, reasons] of Object.entries(HAND_VERIFIED_REASONS)) {
  const e = entries.find((x) => x.eccn === eccn);
  if (!e) console.log(`  hand-verified ${eccn} is no longer in the list: review it`);
  else if ([...e.reasons].sort().join() !== [...reasons].sort().join()) console.log(`  hand-verified ${eccn} kept; parser reads ${e.reasons.join(' ')} vs stored ${reasons.join(' ')}`);
}
if (previous && !same) {
  const old = new Map(previous.entries.map((e) => [e.eccn, e]));
  const now = new Set(entries.map((e) => e.eccn));
  for (const e of entries) {
    const o = old.get(e.eccn);
    if (!o) console.log(`  new: ${e.eccn} ${e.title.slice(0, 70)}`);
    else if (JSON.stringify(o) !== JSON.stringify(e)) console.log(`  changed: ${e.eccn}${o.reasons.join() !== e.reasons.join() ? ` reasons ${o.reasons.join(' ')} -> ${e.reasons.join(' ')}` : ' (text)'}`);
  }
  for (const o of previous.entries) if (!now.has(o.eccn)) console.log(`  removed: ${o.eccn}`);
}
if (same) process.exit(0);
if (!write) process.exit(1);

mkdirSync('data', { recursive: true });
writeFileSync(SNAPSHOT, '{"asOf":' + JSON.stringify(asOf) + ',"amended":' + JSON.stringify(amended) + ',"entries":[\n' + entries.map((e) => JSON.stringify(e)).join(',\n') + '\n]}\n');

const COLS =
  'eccn, category, product_group, title, description, reasons_for_control, license_exceptions, license_exceptions_text, control_text, related_controls, citation, source_url, source_tier, last_updated, origin';
const tuple = (e: CclRow) =>
  `(${[
    sq(e.eccn), sq(e.category), sq(e.productGroup), sq(e.title), sq(e.description), sq(JSON.stringify(e.reasons)), sq(JSON.stringify(e.licenseExceptions)),
    sq(e.exceptionsText), sq(e.controlText), sq(e.relatedControls),
    sq(`15 CFR Part 774, Supplement No. 1, ECCN ${e.eccn} (eCFR text as of ${asOf})`), sq(SOURCE_URL), '1', sq(asOf), sq('ecfr_parse'),
  ].join(', ')})`;
const loaded = entries.filter((e) => !(e.eccn in HAND_VERIFIED_REASONS));
const statements: string[] = [];
let cur: string[] = [];
let curLen = 0;
const flush = () => {
  if (cur.length > 0) statements.push(`INSERT INTO eccn_entries (${COLS}) VALUES\n${cur.join(',\n')};`);
  cur = [];
  curLen = 0;
};
for (const e of loaded) {
  const t = tuple(e);
  if (curLen + t.length > MAX_STATEMENT) flush();
  cur.push(t);
  curLen += t.length + 2;
}
flush();
// The hand-verified rows keep their own reasons, exceptions and description; they gain the published text.
for (const e of entries.filter((x) => x.eccn in HAND_VERIFIED_REASONS)) {
  statements.push(
    `UPDATE eccn_entries SET title = ${sq(e.title)}, control_text = ${sq(e.controlText)}, license_exceptions_text = ${sq(e.exceptionsText)}, related_controls = ${sq(e.relatedControls)} WHERE eccn = ${sq(e.eccn)} AND origin = 'hand_verified';`
  );
}

const files: string[][] = [[]];
let fileLen = 0;
for (const s of statements) {
  if (fileLen + s.length > MAX_FILE && files[files.length - 1].length > 0) {
    files.push([]);
    fileLen = 0;
  }
  files[files.length - 1].push(s);
  fileLen += s.length;
}
const first = argVal('--first') ? Number(argVal('--first')) : Math.max(...readdirSync('migrations').map((f) => Number(f.slice(0, 4)))) + 1;
files.forEach((stmts, i) => {
  const n = String(first + i).padStart(4, '0');
  const header = `-- Commerce Control List (15 CFR Part 774 Supp. No. 1), part ${i + 1} of ${files.length}. eCFR text as of ${asOf}, last amended ${amended}.
-- Generated by scripts/build-ccl.ts (${entries.length} ECCNs; the hand-verified ones from 0032 keep their reasons, exceptions and description). Summaries are not regulatory text.
-- A trailing "?" in reasons_for_control means the control applies only to some paragraphs or is set by country group, so the app says "verify". "VERIFY" means no
-- readable Reason for Control (for example an ITAR cross-reference); it is never treated as uncontrolled.
${i === 0 ? "DELETE FROM eccn_entries WHERE origin = 'ecfr_parse';\n" : ''}`;
  const file = `migrations/${n}_ccl_${asOf.replace(/-/g, '')}_${i + 1}.sql`;
  writeFileSync(file, header + stmts.join('\n') + '\n');
  console.log(`wrote ${file} (${(header + stmts.join('\n')).length} bytes)`);
});
console.log(`wrote ${SNAPSHOT}`);
