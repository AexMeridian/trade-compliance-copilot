// Accuracy benchmark for party screening's name search and scoring (src/lib/db.ts searchPartyCandidates + src/lib/fuzzyMatch.ts rankCandidates),
// run exactly as src/routes/screening.ts runs them, against the loaded OFAC SDN list. Real listed names are changed the way real input
// changes (word order, a missing word, typos, case and punctuation, a legal suffix) and the test asks whether the listed entry still
// reaches the reviewer's top five. Ordinary names that are not on any list measure how much noise reaches the reviewer.
// A missed listed name is the serious failure: the reviewer never sees it. No model, no network; skips without a seeded local database.
// Run: npx tsx tests/accuracy/screening-benchmark.test.ts

import { searchPartyCandidates } from '../../src/lib/db.js';
import { rankCandidates } from '../../src/lib/fuzzyMatch.js';
import { d1Env, openLocalDb } from './d1shim.js';

const db = openLocalDb();
if (!db) {
  console.log('skip  no local database found');
  process.exit(0);
}
const env = d1Env(db as NonNullable<typeof db>);

// Deterministic pseudo-random choice so every run tests the same names.
let seed = 20261102;
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];

const entries = (db as NonNullable<typeof db>)
  .prepare("SELECT id, primary_name, entity_type FROM sdn_entries WHERE length(primary_name) BETWEEN 8 AND 60 AND primary_name LIKE '% %'")
  .all() as { id: number; primary_name: string; entity_type: string | null }[];
const sample = Array.from({ length: 400 }, () => pick(entries));

const aliases = (db as NonNullable<typeof db>)
  .prepare("SELECT sdn_id, alias FROM sdn_aliases WHERE length(alias) BETWEEN 8 AND 60 AND alias LIKE '% %' ORDER BY random() LIMIT 200")
  .all() as { sdn_id: number; alias: string }[];

const swap = (w: string) => {
  if (w.length < 5) return w;
  const i = 1 + Math.floor(rnd() * (w.length - 3));
  return w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2);
};
const drop = (w: string) => (w.length < 5 ? w : w.slice(0, 1 + Math.floor(rnd() * (w.length - 2))) + w.slice(2 + Math.floor(rnd() * 0)));

type Variant = { kind: string; make: (name: string) => string };
const VARIANTS: Variant[] = [
  { kind: 'exact name', make: (n) => n },
  { kind: 'lower case, no punctuation', make: (n) => n.toLowerCase().replace(/[.,'"()-]/g, '') },
  { kind: 'words reordered', make: (n) => n.split(/\s+/).reverse().join(' ') },
  {
    kind: 'one middle word missing',
    make: (n) => {
      const t = n.split(/\s+/);
      return t.length < 3 ? n : t.filter((_, i) => i !== 1 + Math.floor(rnd() * (t.length - 2))).join(' ');
    },
  },
  {
    kind: 'one typo (swapped letters)',
    make: (n) => {
      const t = n.split(/\s+/);
      const i = Math.floor(rnd() * t.length);
      t[i] = swap(t[i]);
      return t.join(' ');
    },
  },
  {
    kind: 'one letter dropped',
    make: (n) => {
      const t = n.split(/\s+/);
      const i = Math.floor(rnd() * t.length);
      if (t[i].length > 4) {
        const k = 1 + Math.floor(rnd() * (t[i].length - 2));
        t[i] = t[i].slice(0, k) + t[i].slice(k + 1);
      }
      return t.join(' ');
    },
  },
  {
    kind: 'one wrong letter',
    make: (n) => {
      const t = n.split(/\s+/);
      const i = Math.floor(rnd() * t.length);
      if (t[i].length > 4) {
        const k = 1 + Math.floor(rnd() * (t[i].length - 2));
        t[i] = t[i].slice(0, k) + (t[i][k] === 'E' ? 'A' : 'E') + t[i].slice(k + 1);
      }
      return t.join(' ');
    },
  },
  {
    kind: 'one extra letter',
    make: (n) => {
      const t = n.split(/\s+/);
      const i = Math.floor(rnd() * t.length);
      if (t[i].length > 4) {
        const k = 1 + Math.floor(rnd() * (t[i].length - 2));
        t[i] = t[i].slice(0, k) + t[i][k] + t[i].slice(k);
      }
      return t.join(' ');
    },
  },
  { kind: 'legal suffix added', make: (n) => `${n} LLC` },
];
void drop;

async function reaches(input: string, id: number): Promise<boolean> {
  const cands = await searchPartyCandidates(env, input);
  const ranked = rankCandidates(input, cands, { limit: 5, minScore: 0.55 });
  return ranked.some((r) => r.candidate.source === 'SDN' && r.candidate.entity_id === id);
}

const results: Record<string, { n: number; hit: number; misses: string[] }> = {};
for (const v of VARIANTS) results[v.kind] = { n: 0, hit: 0, misses: [] };

for (const e of sample) {
  for (const v of VARIANTS) {
    const input = v.make(e.primary_name);
    const r = results[v.kind];
    r.n++;
    if (await reaches(input, e.id)) r.hit++;
    else if (r.misses.length < 6) r.misses.push(`${e.primary_name}  =>  ${input}`);
  }
}
const aliasRes = { n: 0, hit: 0, misses: [] as string[] };
for (const a of aliases) {
  aliasRes.n++;
  if (await reaches(a.alias, a.sdn_id)) aliasRes.hit++;
  else if (aliasRes.misses.length < 6) aliasRes.misses.push(a.alias);
}

console.log('\nListed names that still reach the reviewer\'s top five (SDN, ' + sample.length + ' entries):');
let worst = 1;
for (const [kind, r] of Object.entries(results)) {
  const pct = r.hit / r.n;
  worst = Math.min(worst, pct);
  console.log(`  ${kind.padEnd(30)} ${(100 * pct).toFixed(1).padStart(5)}%  (${r.hit}/${r.n})`);
  for (const m of r.misses) console.log(`      missed: ${m}`);
}
console.log(`  ${'listed alias, as typed'.padEnd(30)} ${((100 * aliasRes.hit) / aliasRes.n).toFixed(1).padStart(5)}%  (${aliasRes.hit}/${aliasRes.n})`);
for (const m of aliasRes.misses) console.log(`      missed: ${m}`);

// Noise: ordinary names that are not listed. How many put at least one candidate in front of the reviewer, and how strong the best one is.
const ordinary = [
  'John Smith', 'Maria Garcia', 'David Johnson', 'Sarah Williams', 'Michael Brown', 'Emily Davis', 'Robert Miller', 'Jennifer Wilson',
  'Acme Widgets Inc', 'Pacific Coast Logistics', 'Green Valley Farms', 'Northern Lights Software', 'Blue Harbor Trading Company', 'Summit Ridge Consulting',
  'Hans Mueller', 'Yuki Tanaka', 'Priya Sharma', 'Luca Rossi', 'Chen Wei', 'Olga Petrova', 'Ahmed Hassan', 'Fatima Ali', 'Carlos Rodriguez', 'Ivan Petrov',
  'Global Freight Partners Ltd', 'Sunrise Electronics Co', 'Atlas Machine Works', 'Oakwood Furniture Group', 'Bright Future Textiles', 'Delta Marine Supply',
];
let withHit = 0;
let strong = 0;
for (const name of ordinary) {
  const ranked = rankCandidates(name, await searchPartyCandidates(env, name), { limit: 5, minScore: 0.55 });
  if (ranked.length) withHit++;
  if (ranked.some((r) => r.score.score >= 0.85)) strong++;
}
console.log(`\nOrdinary names that are not listed (${ordinary.length}): ${withHit} bring at least one candidate to the reviewer, ${strong} bring one scoring 0.85 or higher.`);

if (worst < 0.9) {
  console.error('\nFAIL a kind of change loses more than 10% of listed names');
  process.exit(1);
}
