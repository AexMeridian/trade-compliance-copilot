// Guards the site's wording against the habits that make a page read as machine-written: a double hyphen used as a dash in visible
// text, and stock marketing phrases. Comments, thrown error messages, console output and the model prompts are not visible copy
// and are skipped. No network, no database. Run: npm run test:unit

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

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

const ROOTS = ['frontend/src', 'src'];
const SKIP = ['src/prompts', 'src/lib/refresh', 'src/lib/pulse', 'src/scheduled.ts', 'frontend/src/components/ReasoningPanel.tsx', 'frontend/src/App.tsx'];

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name).split('\\').join('/');
    if (SKIP.some((s) => p === s || p.startsWith(`${s}/`))) continue;
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.(ts|tsx)$/.test(p) && !p.endsWith('.generated.ts')) out.push(p);
  }
  return out;
}

const COMMENT_LINE = /^\s*(\/\/|\*|\/\*|\{\/\*)/;
const NOT_VISIBLE = /\/\/.* -- |\/\*.* -- |throw new Error|console\./;

const visibleLines = ROOTS.flatMap((r) => files(r)).flatMap((f) =>
  readFileSync(f, 'utf8')
    .split(/\r?\n/)
    .map((text, i) => ({ f, n: i + 1, text }))
    .filter(({ text }) => !COMMENT_LINE.test(text) && !NOT_VISIBLE.test(text))
);

test('no double hyphen used as a dash in visible text', () => {
  const hits = visibleLines.filter(({ text }) => text.includes(' -- ')).map(({ f, n }) => `${f}:${n}`);
  assert.deepEqual(hits, [], `use a comma, colon or full stop instead:\n  ${hits.join('\n  ')}`);
});

test('no stock marketing phrases in the site copy', () => {
  const banned = /\b(unlock|seamless(ly)?|supercharge|elevate your|streamline|revolutioni[sz]e|empower(s|ing)?|game-changer|cutting-edge|fast-paced|welcome to)\b/i;
  const hits = visibleLines.filter(({ text }) => banned.test(text)).map(({ f, n, text }) => `${f}:${n} ${text.trim().slice(0, 80)}`);
  assert.deepEqual(hits, [], hits.join('\n  '));
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
