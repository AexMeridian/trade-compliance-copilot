// Free half of the classification accuracy test: for each labelled product, is a line under the correct 6-digit subheading among the
// candidates the search hands to the model? The model can only choose from that list, so this is the ceiling on its accuracy.
// Runs the calculator's own searchHts against the local database. No model, no network; skips without a seeded local database.
// The labels (tests/accuracy/classification-set.json) are international HS 6-digit subheadings of common goods, each checked to exist
// in the loaded schedule. Run: npx tsx tests/accuracy/classification-retrieval.test.ts

import { readFileSync } from 'node:fs';
import { searchHts } from '../../src/lib/db.js';
import { d1Env, openLocalDb } from './d1shim.js';

const db = openLocalDb();
if (!db) {
  console.log('skip  no local database found');
  process.exit(0);
}
const env = d1Env(db as NonNullable<typeof db>);
const set = JSON.parse(readFileSync('tests/accuracy/classification-set.json', 'utf8')) as { product_description: string; expected_hs6: string }[];

let found = 0;
const misses: string[] = [];
for (const item of set) {
  const want = item.expected_hs6.replace('.', '');
  const cands = await searchHts(env, item.product_description);
  const ok = cands.some((c) => c.htsno.replace(/\./g, '').startsWith(want));
  if (ok) found++;
  else misses.push(`${item.expected_hs6}  ${item.product_description}   (got ${cands.slice(0, 4).map((c) => c.htsno).join(', ') || 'nothing'})`);
}
console.log(`Correct subheading among the candidates: ${found}/${set.length} (${((100 * found) / set.length).toFixed(1)}%)`);
for (const m of misses) console.log(`  missed: ${m}`);
if (found / set.length < 0.8) {
  console.error('FAIL retrieval recall below 80%');
  process.exit(1);
}
