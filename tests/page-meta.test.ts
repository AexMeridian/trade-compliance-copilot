// Page-head details for every address: titles, canonical addresses, indexing and which addresses are real pages.
// The Worker serves these tags in the HTML (src/pages.ts) and the app keeps them current. No network. Run: npm run test:unit

import assert from 'node:assert/strict';
import { pageMeta } from '../frontend/src/lib/pageMeta.js';

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

test('every public page has its own title, description and canonical address', () => {
  const paths = ['/', '/calculator', '/abroad', '/allies', '/compare', '/about', '/methodology', '/terms', '/privacy', '/accessibility', '/cookies', '/disclaimer', '/copyright', '/security'];
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  for (const p of paths) {
    const m = pageMeta(p, null, null, null);
    assert.ok(m.known && m.indexable, p);
    assert.equal(m.canonical, `https://aexterminal.com${p}`);
    assert.ok(m.description.length > 20 && m.description.length <= 320, `${p} description length`);
    titles.add(m.title);
    descriptions.add(m.description);
  }
  assert.equal(titles.size, paths.length, 'titles are unique');
  assert.equal(descriptions.size, paths.length, 'descriptions are unique');
});

test('a country page is named, lowercase canonical like the sitemap, and indexable; an unknown code is not a page', () => {
  const cn = pageMeta('/country/CN', null, null, 'China');
  assert.equal(cn.title, 'China | Aex Terminal');
  assert.equal(cn.canonical, 'https://aexterminal.com/country/cn');
  assert.ok(cn.known && cn.indexable && cn.description.includes('China'));
  const bad = pageMeta('/country/zz', null, null, null);
  assert.ok(!bad.known && !bad.indexable);
  assert.ok(!pageMeta('/country/chn', null, null, 'China').known);
});

test('private and unknown addresses are not indexed; unknown ones are not pages', () => {
  assert.ok(pageMeta('/case/abc', null, null, null).known && !pageMeta('/case/abc', null, null, null).indexable);
  assert.ok(pageMeta('/case/abc/report', null, null, null).known);
  assert.ok(!pageMeta('/snapshot/abc', null, null, null).indexable);
  const nope = pageMeta('/nope', null, null, null);
  assert.ok(!nope.known && !nope.indexable && nope.title.startsWith('Page not found'));
  assert.ok(!pageMeta('/case', null, null, null).known);
});

test('the home page keeps its tab in the canonical only when the app supplies the tab label; a trailing slash is ignored', () => {
  assert.equal(pageMeta('/', 'policy', 'U.S. policy', null).canonical, 'https://aexterminal.com/?tab=policy');
  assert.equal(pageMeta('/', 'policy', null, null).canonical, 'https://aexterminal.com/');
  assert.equal(pageMeta('/about/', null, null, null).canonical, 'https://aexterminal.com/about');
});

test('old addresses that the app redirects still count as pages', () => {
  for (const p of ['/footprint', '/standing', '/vs-world', '/influence', '/power']) assert.ok(pageMeta(p, null, null, null).known, p);
});

if (failures) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
