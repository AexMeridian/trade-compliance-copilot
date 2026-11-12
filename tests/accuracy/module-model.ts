// Model-scored accuracy runs for the three modules that call the model besides classification: origin/USMCA, party screening, and export
// ECCN selection. Each case goes through the real endpoint on a local `wrangler dev`; the case is created and its earlier modules are filled in
// directly in the local database, so a case costs only the one model call being measured.
//
// COST: origin ~41 calls, eccn ~34 calls, screening ~60 calls (one per party). Uses the ANTHROPIC_API_KEY in .dev.vars. Start the server with
//   npx wrangler dev --var MODEL_CACHE:off --var CLAUDE_DAILY_CAP:2000
// (cache off, or repeated cases would be answered from the cache) and pass its address as BASE_URL if it is not 8787.
// Run: npx tsx tests/accuracy/module-model.ts --suite origin|eccn|screening [--limit N]
// Writes tests/accuracy/last-<suite>-run.json.

import { writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { emptyCaseFile, type CaseFile, type Direction } from '../../src/types/case.js';
import { ORIGIN_SCENARIOS } from './origin-set.js';
import { ECCN_PRODUCTS } from './eccn-set.js';
import { openLocalDb } from './d1shim.js';
import { PER_CALL_USD, requireCostConfirmation } from './costGuard.js';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:8787';
const args = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const suite = arg('--suite', '');
const limit = Number(arg('--limit', 'Infinity'));
const from = Number(arg('--from', '0')); // eccn only: skip the first N products (already measured)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The local server limits Claude-calling requests to 20 a minute per client; stay under it.
const MIN_GAP_MS = 3500;
let lastCall = 0;
async function post(path: string, body: unknown): Promise<{ status: number; json: any }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const wait = lastCall + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    // One retry for a gateway failure (a connection problem between this machine and the API); those are not billed.
    if (res.status === 502 && attempt === 0) {
      await sleep(5000);
      continue;
    }
    return { status: res.status, json };
  }
  throw new Error('unreachable');
}

function localDbFile(): string {
  const dir = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sqlite'))
    .map((f) => join(dir, f))
    .sort((a, b) => statSync(b).size - statSync(a).size)[0];
}

/** Creates a case directly in the local database, with earlier modules already complete, and returns its id. */
function makeCase(direction: Direction, patch: (cf: CaseFile) => void): string {
  const id = crypto.randomUUID();
  const cf = emptyCaseFile(id, direction);
  patch(cf);
  const db = new DatabaseSync(localDbFile());
  db.exec('PRAGMA busy_timeout = 5000');
  const expires = new Date(Date.now() + 3 * 86_400_000).toISOString();
  db.prepare(
    `INSERT INTO cases (id, direction, status, case_file, created_at, updated_at, is_sample, sample_key, expires_at, delete_token_hash)
     VALUES (?1, ?2, 'draft', ?3, ?4, ?4, 0, NULL, ?5, NULL)`
  ).run(id, direction, JSON.stringify(cf), cf.created_at, expires);
  db.close();
  return id;
}

const classified = (cf: CaseFile, code: string, description: string) => {
  cf.classification = { ...cf.classification, status: 'complete', product_description: description, selected_code: code, hs6: code.replace(/\./g, '').slice(0, 6) };
};
const screenedClear = (cf: CaseFile) => {
  cf.screening = { status: 'complete', parties: [], highest_severity: 'none', hard_stop_triggered: false, screened_at: new Date().toISOString(), deemed_export_flagged: false };
};

async function health() {
  const ok = await fetch(`${BASE}/api/health`).then((r) => r.ok).catch(() => false);
  if (!ok) {
    console.error(`Cannot reach ${BASE}. Start wrangler dev first (see the header of this file).`);
    process.exit(1);
  }
}

// --- origin ---------------------------------------------------------------------------------------------------------------------------
async function runOrigin() {
  const items = ORIGIN_SCENARIOS.slice(0, limit);
  requireCostConfirmation(args, items.length, PER_CALL_USD.origin, 'origin');
  const rows: unknown[] = [];
  let correct = 0, confidentWrong = 0, strictMiss = 0, abstained = 0, errors = 0;
  for (const s of items) {
    const id = makeCase('import', (cf) => classified(cf, s.code, s.name));
    const { status, json } = await post(`/api/cases/${id}/origin`, { components: s.components, final_assembly_country: s.assembly });
    if (status !== 200) {
      errors++;
      rows.push({ name: s.name, error: status });
      console.log(`  error ${status}  ${s.name}`);
      continue;
    }
    const q = json.origin.qualifies as boolean | null;
    const answer = q === null ? 'insufficient' : q ? 'true' : 'false';
    const ok = s.accept.includes(answer as never);
    let outcome: string;
    if (ok) {
      outcome = 'correct';
      correct++;
    } else if (answer === 'true') {
      outcome = 'CONFIDENT WRONG (qualifies when it should not)';
      confidentWrong++;
    } else if (answer === 'insufficient') {
      outcome = 'abstained (a decisive answer was available)';
      abstained++;
    } else {
      outcome = 'missed (said no when the facts support yes)';
      strictMiss++;
    }
    rows.push({ name: s.name, accept: s.accept, answer, outcome, rvc: json.origin.rvc_calculated_pct, why: s.why });
    if (!ok) console.log(`  ${outcome.padEnd(46)} want ${s.accept.join('/').padEnd(18)} got ${answer.padEnd(12)} ${s.name}`);
  }
  console.log(`\norigin: correct ${correct}/${items.length}   confident wrong ${confidentWrong}   missed ${strictMiss}   abstained ${abstained}   errors ${errors}`);
  writeFileSync('tests/accuracy/last-origin-run.json', JSON.stringify(rows, null, 1));
}

// --- eccn -----------------------------------------------------------------------------------------------------------------------------
async function runEccn() {
  const items = ECCN_PRODUCTS.slice(from, limit);
  requireCostConfirmation(args, items.length, PER_CALL_USD.eccn, 'eccn');
  const rows: unknown[] = [];
  const tally: Record<string, number> = { correct: 0, flagged: 0, 'confident wrong': 0, errors: 0 };
  for (const p of items) {
    const id = makeCase('export', (cf) => {
      classified(cf, p.hs + '.0000', p.description);
      screenedClear(cf);
    });
    const { status, json } = await post(`/api/cases/${id}/determination`, { destination_country: 'DE' });
    if (status !== 200) {
      tally.errors++;
      rows.push({ description: p.description, error: status });
      console.log(`  error ${status}  ${p.description.slice(0, 60)}`);
      continue;
    }
    const d = json.determination;
    const eccn: string | null = d.eccn;
    const clear = d.verdict === 'clear';
    // Strategic goods sit under entries the app does not carry: anything short of a clear verdict is the right behaviour.
    const outcome: string = p.kind === 'strategic' ? (clear ? 'confident wrong' : 'correct') : eccn !== null && p.accept.includes(eccn) ? 'correct' : clear ? 'confident wrong' : 'flagged';
    tally[outcome]++;
    rows.push({ kind: p.kind, description: p.description, accept: p.accept, eccn, verdict: d.verdict, license: d.license_requirement, outcome });
    if (outcome !== 'correct') console.log(`  ${outcome.padEnd(15)} ${p.kind.padEnd(9)} want ${(p.accept.join('/') || 'a flag').padEnd(12)} got ${String(eccn).padEnd(7)} verdict ${String(d.verdict).padEnd(15)} ${p.description.slice(0, 55)}`);
  }
  console.log(`\neccn: correct ${tally.correct}/${items.length}   flagged ${tally.flagged}   confident wrong ${tally['confident wrong']}   errors ${tally.errors}`);
  writeFileSync(from > 0 ? 'tests/accuracy/last-eccn-run-2.json' : 'tests/accuracy/last-eccn-run.json', JSON.stringify(rows, null, 1));
}

// --- screening ------------------------------------------------------------------------------------------------------------------------
interface Party {
  kind: 'listed' | 'variant' | 'clean';
  name: string;
  direction: Direction;
  source: string;
}

function swapLetters(word: string): string {
  if (word.length < 6) return word;
  const i = Math.floor(word.length / 2);
  return word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2);
}

function screeningParties(): Party[] {
  const db = openLocalDb();
  if (!db) throw new Error('No seeded local database.');
  const pick = (sql: string) => (db.prepare(sql).all() as { n: string }[]).map((r) => r.n);
  const parties: Party[] = [];
  // Real listed names, taken at a fixed stride so every run uses the same ones.
  const sdnCompanies = pick(`SELECT primary_name n FROM sdn_entries WHERE entity_type = 'Entity' AND length(primary_name) BETWEEN 14 AND 45 AND primary_name NOT GLOB '*[0-9]*' AND id % 997 = 11 ORDER BY id LIMIT 18`);
  sdnCompanies.slice(0, 12).forEach((n) => parties.push({ kind: 'listed', name: n, direction: 'import', source: 'SDN company' }));
  // Perturbed spellings of six more listed names: word order reversed, a legal suffix dropped, or two letters swapped.
  sdnCompanies.slice(12, 18).forEach((n, i) => {
    const words = n.split(/\s+/);
    const name = i % 3 === 0 ? [...words].reverse().join(' ') : i % 3 === 1 ? words.filter((w) => !/^(LLC|LTD|LIMITED|CO\.?,?|INC\.?|S\.A\.|FZE|JSC|OOO)$/i.test(w)).join(' ') : words.map((w, j) => (j === 0 ? swapLetters(w) : w)).join(' ');
    parties.push({ kind: 'variant', name, direction: 'import', source: `SDN company, perturbed (${['word order', 'suffix dropped', 'letters swapped'][i % 3]})` });
  });
  pick(`SELECT primary_name n FROM sdn_entries WHERE entity_type = 'Individual' AND length(primary_name) BETWEEN 10 AND 30 AND primary_name NOT GLOB '*[0-9]*' AND id % 1499 = 5 ORDER BY id LIMIT 5`).forEach((n) =>
    parties.push({ kind: 'listed', name: n, direction: 'import', source: 'SDN individual' })
  );
  pick(`SELECT name n FROM csl_entries WHERE source_list LIKE '%Entity List%' AND length(name) BETWEEN 12 AND 45 AND name NOT GLOB '*[0-9]*' AND id % 211 = 3 ORDER BY id LIMIT 5`).forEach((n) =>
    parties.push({ kind: 'listed', name: n, direction: 'export', source: 'BIS Entity List' })
  );
  pick(`SELECT primary_name n FROM un_sanctions_entries WHERE length(primary_name) BETWEEN 10 AND 40 AND primary_name NOT GLOB '*[0-9]*' AND id % 211 = 4 ORDER BY id LIMIT 3`).forEach((n) =>
    parties.push({ kind: 'listed', name: n, direction: 'export', source: 'UN list' })
  );
  pick(`SELECT primary_name n FROM uk_sanctions_entries WHERE length(primary_name) BETWEEN 10 AND 40 AND primary_name NOT GLOB '*[0-9]*' AND id % 331 = 6 ORDER BY id LIMIT 3`).forEach((n) =>
    parties.push({ kind: 'listed', name: n, direction: 'import', source: 'UK list' })
  );
  const clean = [
    'Sunrise Valley Orchards Inc', 'Bluewater Plumbing Supply LLC', 'Maple Street Dental Group', 'Northern Lights Photography', 'Greenfield Organic Farms Ltd',
    'Redwood Furniture Company', 'Silverline Logistics Partners', 'Harborview Coffee Roasters', 'Peninsula Textile Mills LLC', 'Cascade Precision Tooling Inc',
    'Lakeside Veterinary Clinic', 'Granite State Printing Co', 'Evergreen Packaging Solutions', 'Midwest Fastener Distribution', 'Coastal Marine Electronics Ltd',
    'John Smith', 'Maria Garcia', 'David Johnson', 'Emily Carter', 'Michael Brown', 'Sarah Thompson',
    'Global Trading Company Limited', 'National Bank of Springfield', 'Pacific Shipping Agency Inc', 'Eastern Star Hotel Group', 'Universal Machinery Imports LLC',
  ];
  clean.forEach((n) => parties.push({ kind: 'clean', name: n, direction: 'import', source: 'ordinary name' }));
  return parties;
}

async function runScreening() {
  const parties = screeningParties().slice(0, limit);
  requireCostConfirmation(args, parties.length, PER_CALL_USD.screening, 'screening (at most; a party with no candidates costs none)');
  const rows: unknown[] = [];
  const t = { listedFlagged: 0, listedTrue: 0, listedMissed: 0, cleanClean: 0, cleanCaution: 0, cleanTrue: 0, errors: 0 };
  const BATCH = 5;
  for (const direction of ['import', 'export'] as Direction[]) {
    const group = parties.filter((p) => p.direction === direction);
    for (let i = 0; i < group.length; i += BATCH) {
      const batch = group.slice(i, i + BATCH);
      const id = makeCase(direction, (cf) => {
        cf.classification.status = 'complete';
      });
      const { status, json } = await post(`/api/cases/${id}/screening`, { parties: batch.map((p) => ({ role: 'buyer', name: p.name })), deemed_export_flag: false });
      if (status !== 200) {
        t.errors += batch.length;
        console.log(`  error ${status} for a batch starting ${batch[0].name}`);
        continue;
      }
      json.screening.parties.forEach((res: any, k: number) => {
        const p = batch[k];
        const verdicts: string[] = res.matches.map((m: any) => m.verdict);
        const hasTrue = verdicts.includes('true_match');
        const hasInconclusive = verdicts.includes('inconclusive');
        const top = res.matches[0];
        rows.push({ kind: p.kind, source: p.source, name: p.name, verdicts, topMatch: top?.matched_name ?? null, topScore: top?.match_score ?? null });
        if (p.kind === 'clean') {
          if (hasTrue) {
            t.cleanTrue++;
            console.log(`  false alarm (true_match on an ordinary name)  ${p.name}  ~ ${res.matches.find((m: any) => m.verdict === 'true_match')?.matched_name}`);
          } else if (hasInconclusive) t.cleanCaution++;
          else t.cleanClean++;
        } else if (hasTrue) {
          t.listedTrue++;
          t.listedFlagged++;
        } else if (hasInconclusive) t.listedFlagged++;
        else {
          t.listedMissed++;
          console.log(`  MISSED listed party (${p.source})  ${p.name}  -> ${top ? `${top.matched_name} ${top.verdict} ${top.match_score}` : 'no candidate'}`);
        }
      });
    }
  }
  const listed = parties.filter((p) => p.kind !== 'clean').length;
  const clean = parties.filter((p) => p.kind === 'clean').length;
  console.log(`\nscreening, listed parties (${listed}): confirmed true match ${t.listedTrue}, flagged inconclusive ${t.listedFlagged - t.listedTrue}, MISSED ${t.listedMissed}`);
  console.log(`screening, ordinary names (${clean}): clean ${t.cleanClean}, inconclusive ${t.cleanCaution}, false true_match ${t.cleanTrue}   errors ${t.errors}`);
  writeFileSync('tests/accuracy/last-screening-run.json', JSON.stringify(rows, null, 1));
}

await health();
if (suite === 'origin') await runOrigin();
else if (suite === 'eccn') await runEccn();
else if (suite === 'screening') await runScreening();
else {
  console.error('Pass --suite origin, eccn or screening.');
  process.exit(1);
}
