// The only code allowed to spend model credit is the calculator: src/lib/anthropic.ts and the four routes that call it. A cron job, a
// page, a refresh script or a helper that imported the model client would spend money nobody is watching, so this fails the build if one does.
// Run: npm run test:unit

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ALLOWED = new Set([
  'src/lib/anthropic.ts',
  'src/lib/modelSpend.ts', // pure price and error rules, no client
  'src/routes/classification.ts',
  'src/routes/origin.ts',
  'src/routes/screening.ts',
  'src/routes/determination.ts',
  'src/index.ts', // maps the unavailable errors to a 503; does not call the model
]);
// Prompt files only build text and tool definitions; they type against the SDK but never call it.
const PROMPTS_OK = /^src\/prompts\//;
const USES_MODEL = /@anthropic-ai\/sdk|lib\/anthropic(\.js)?['"]|\bcallClaudeTool\b|\bgetClient\b/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

let failures = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (err) {
    failures++;
    console.error(`FAIL ${name}\n  ${(err as Error).message}`);
  }
}

test('nothing in src/ reaches the model except the calculator routes', () => {
  const offenders = walk('src')
    .map((f) => relative('.', f).replace(/\\/g, '/'))
    .filter((f) => !ALLOWED.has(f) && !PROMPTS_OK.test(f))
    .filter((f) => USES_MODEL.test(readFileSync(f, 'utf8')));
  assert.deepEqual(offenders, [], `these files use the model client: ${offenders.join(', ')}`);
});
test('the frontend never bundles the model SDK', () => {
  const offenders = walk('frontend/src').filter((f) => /@anthropic-ai/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(offenders, []);
});
test('no scheduled job imports a calculator route', () => {
  const scheduled = readFileSync('src/scheduled.ts', 'utf8');
  assert.ok(!/routes\/(classification|origin|screening|determination)/.test(scheduled));
  assert.ok(!USES_MODEL.test(scheduled));
});
test('no GitHub workflow holds the model key', () => {
  for (const f of readdirSync('.github/workflows')) {
    assert.ok(!/ANTHROPIC_API_KEY|secrets.ANTHROPIC/i.test(readFileSync(join(".github/workflows", f), "utf8")), `${f} references the model key`);
  }
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
