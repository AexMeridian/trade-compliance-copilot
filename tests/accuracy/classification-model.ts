// Model-scored half of the classification accuracy test: each labelled product goes through the real classification endpoint on a local
// `wrangler dev` (default http://127.0.0.1:8787), and the answer is scored against the labelled 6-digit subheading.
//
// Outcomes, in order of seriousness:
//   confident wrong  the model chose a code under a different subheading and did not flag ambiguity  (the failure to drive to zero)
//   flagged          the answer was wrong or missing but the case was marked ambiguous or blocked for review (acceptable)
//   correct          the chosen code is under the labelled subheading
// A handful of deliberately vague descriptions check that the model declines to guess; for those, flagging is the right answer.
//
// COST: one model call per product (about 100) per run, using the ANTHROPIC_API_KEY in .dev.vars. Use --limit N to try a few first and
// --runs 2 to measure run-to-run stability. Writes tests/accuracy/last-classification-run.json. Run: npm run test:accuracy:model

import { readFileSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:8787';
const args = process.argv.slice(2);
const flag = (name: string, fallback: number) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const limit = flag('--limit', Infinity);
const runs = flag('--runs', 1);
// --skip N resumes after a stop: the first N products keep the results already saved in the output file and only the rest are sent to the model.
const skip = flag('--skip', 0);

interface Item {
  product_description: string;
  expected_hs6: string | null; // null: vague on purpose, the right answer is to flag it
}
const labelled = JSON.parse(readFileSync('tests/accuracy/classification-set.json', 'utf8')) as Item[];
const vague: Item[] = ['Stuff for the warehouse', 'Machine parts', 'Samples for testing', 'An electronic device', 'Clothing', 'Plastic items', 'Food products', 'Tools'].map((d) => ({
  product_description: d,
  expected_hs6: null,
}));
const allItems = [...labelled, ...vague].slice(0, limit);
const items = allItems.slice(skip);

async function classify(description: string) {
  const created = (await (await fetch(`${BASE}/api/cases`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ direction: 'import' }) })).json()) as { id: string };
  const res = await fetch(`${BASE}/api/cases/${created.id}/classification`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ product_description: description }) });
  if (!res.ok) return { error: `HTTP ${res.status}` } as const;
  const body = (await res.json()) as { classification: { status: string; selected_code: string | null; ambiguous: boolean } };
  return { c: body.classification } as const;
}

const health = await fetch(`${BASE}/api/health`).catch(() => null);
if (!health?.ok) {
  console.error(`Cannot reach ${BASE}. Start wrangler dev first.`);
  process.exit(1);
}
console.log(`${items.length} products x ${runs} run(s) = ${items.length * runs} model calls${skip ? ` (resuming after ${skip} saved)` : ''}`);

type Row = { description: string; expected: string | null; runs: { code: string | null; ambiguous: boolean; outcome: string }[] };
const rows: Row[] = skip ? (JSON.parse(readFileSync('tests/accuracy/last-classification-run.json', 'utf8')) as Row[]).slice(0, skip) : [];
let apiErrors = 0;
for (const it of items) {
  const row = { description: it.product_description, expected: it.expected_hs6, runs: [] as { code: string | null; ambiguous: boolean; outcome: string }[] };
  for (let r = 0; r < runs; r++) {
    const out = await classify(it.product_description);
    if ('error' in out) {
      apiErrors++;
      row.runs.push({ code: null, ambiguous: false, outcome: out.error ?? 'error' });
      continue;
    }
    const code = out.c.selected_code;
    const flagged = out.c.ambiguous || out.c.status !== 'complete' || code === null;
    const correct = it.expected_hs6 !== null && code !== null && code.replace(/\./g, '').startsWith(it.expected_hs6.replace('.', ''));
    const outcome = it.expected_hs6 === null ? (flagged ? 'correct' : 'confident wrong') : correct ? 'correct' : flagged ? 'flagged' : 'confident wrong';
    row.runs.push({ code, ambiguous: out.c.ambiguous, outcome });
  }
  rows.push(row);
  if (row.runs[0].outcome === 'HTTP 500' && apiErrors >= 3) {
    console.error('Three model calls failed in a row; check the API key in .dev.vars. Stopping.');
    break;
  }
}

const all = rows.flatMap((r) => r.runs);
const count = (o: string) => all.filter((x) => x.outcome === o).length;
console.log(`\ncorrect ${count('correct')}/${all.length}   flagged ${count('flagged')}   confident wrong ${count('confident wrong')}   errors ${apiErrors}`);
for (const r of rows) for (const x of r.runs) if (x.outcome === 'confident wrong' || x.outcome === 'flagged') console.log(`  ${x.outcome.padEnd(15)} want ${(r.expected ?? 'flag').padEnd(8)} got ${(x.code ?? '(none)').padEnd(14)} ${r.description.slice(0, 60)}`);
if (runs > 1) {
  const unstable = rows.filter((r) => new Set(r.runs.map((x) => x.code)).size > 1).length;
  console.log(`\nSame product, different code between runs: ${unstable}/${rows.length}`);
}
writeFileSync('tests/accuracy/last-classification-run.json', JSON.stringify(rows, null, 1));
