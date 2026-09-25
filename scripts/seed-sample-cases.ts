// Drives the 4 "Run sample case" landing-page cases through the real API
// (running locally via `wrangler dev`) -- real Claude calls, real D1-grounded
// data, no mocking -- then flags each case as a sample via a direct D1 write
// (there is no public API for this; it's a one-time setup concern, not a
// user-facing action). Each scenario's inputs were manually verified against
// the live app during this build (see commit history / build notes) to
// actually produce the intended narrative (ambiguous classification, USMCA +
// Section 338, a real export license outcome, and a clean pass) rather than
// being asserted without checking.
//
// Requires `wrangler dev` running on http://127.0.0.1:8787 (or set BASE_URL).
// Set REMOTE=1 to flag the seeded cases in the deployed remote D1 database
// instead of local (BASE_URL must then point at the deployed Worker too).

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:8787';
const D1_MODE = process.env.REMOTE === '1' ? '--remote' : '--local';

async function api<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
  return JSON.parse(text) as T;
}

interface Scenario {
  sampleKey: string;
  direction: 'import' | 'export';
  productDescription: string;
  origin: { components: { description: string; origin_country: string; value_pct: number | null }[]; final_assembly_country: string };
  parties: { role: 'buyer' | 'seller' | 'intermediary'; name: string }[];
  destinationCountry?: string; // export only
}

const SCENARIOS: Scenario[] = [
  {
    sampleKey: 'ambiguous-classification',
    direction: 'import',
    productDescription:
      'A boxed gift set for retail sale containing one ballpoint pen, one small leather-bound notebook, and one leather pen sleeve, packaged together in equal proportions of value with no single item predominating',
    origin: { components: [{ description: 'Assorted components', origin_country: 'CN', value_pct: 100 }], final_assembly_country: 'CN' },
    parties: [{ role: 'seller', name: 'Global Stationery Exports Ltd' }],
  },
  {
    sampleKey: 'canada-usmca-338',
    direction: 'import',
    productDescription: 'A stamped steel automotive bumper assembly designed as a replacement part for a passenger vehicle body',
    origin: {
      components: [
        { description: 'Steel stamping', origin_country: 'CA', value_pct: 85 },
        { description: 'Coating and hardware', origin_country: 'US', value_pct: 15 },
      ],
      final_assembly_country: 'CA',
    },
    parties: [{ role: 'seller', name: 'Ontario Auto Parts Manufacturing Inc' }],
  },
  {
    sampleKey: 'export-license-required',
    direction: 'export',
    productDescription: 'A hardware network encryption appliance using non-mass-market cryptography for enterprise VPN tunnels',
    origin: { components: [{ description: 'PCB assembly', origin_country: 'US', value_pct: 100 }], final_assembly_country: 'US' },
    parties: [{ role: 'buyer', name: 'Baltic Systems Integration OOO' }],
    destinationCountry: 'RU',
  },
  {
    sampleKey: 'clean-pass',
    direction: 'import',
    productDescription: 'A single fresh red apple, edible, whole and unprocessed',
    origin: { components: [{ description: 'Whole fresh apple', origin_country: 'SE', value_pct: 100 }], final_assembly_country: 'SE' },
    parties: [{ role: 'seller', name: 'Nordic Orchard Trading AB' }],
  },
];

async function runScenario(s: Scenario) {
  console.log(`\n=== ${s.sampleKey} (${s.direction}) ===`);
  const { id } = await api<{ id: string }>('/cases', 'POST', { direction: s.direction });
  console.log(`case ${id}`);

  const cls = await api<{ classification: { selected_code: string; ambiguous: boolean } }>(`/cases/${id}/classification`, 'POST', {
    product_description: s.productDescription,
  });
  console.log(`  classification: ${cls.classification.selected_code} (ambiguous=${cls.classification.ambiguous})`);

  const org = await api<{ origin: { qualifies: boolean | null } }>(`/cases/${id}/origin`, 'POST', s.origin);
  console.log(`  origin qualifies: ${org.origin.qualifies}`);

  const scr = await api<{ screening: { highest_severity: string } }>(`/cases/${id}/screening`, 'POST', { parties: s.parties });
  console.log(`  screening severity: ${scr.screening.highest_severity}`);

  const det = await api<{ determination: { verdict: string } }>(`/cases/${id}/determination`, 'POST', {
    destination_country: s.destinationCountry,
  });
  console.log(`  verdict: ${det.determination.verdict}`);

  // Written to a file rather than passed via --command: on Windows,
  // execFileSync with shell:true concatenates args into one command-line
  // string without re-quoting them, so a value containing spaces (the SQL
  // statement) silently gets split into separate argv entries.
  mkdirSync('scripts/seed-sql/_tmp', { recursive: true });
  const sqlFile = `scripts/seed-sql/_tmp/flag-${s.sampleKey}.sql`;
  writeFileSync(sqlFile, `UPDATE cases SET is_sample = 1, sample_key = '${s.sampleKey}' WHERE id = '${id}';\n`);
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'trade-compliance-db', D1_MODE, `--file=${sqlFile}`], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  return id;
}

async function main() {
  const health = await fetch(`${BASE_URL}/api/health`).catch(() => null);
  if (!health || !health.ok) {
    console.error(`Cannot reach ${BASE_URL} -- start \`wrangler dev\` first.`);
    process.exit(1);
  }
  const ids: string[] = [];
  for (const s of SCENARIOS) {
    ids.push(await runScenario(s));
  }
  console.log(`\nDone. ${ids.length} sample cases seeded.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
