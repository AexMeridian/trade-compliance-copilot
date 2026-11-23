// Translated pages: every figure, date, legal term and link must be identical to the English page, every translation has every key, and
// the page head lists hreflang alternates. No network. Run: npm run test:unit
import assert from 'node:assert/strict';
import { BASICS_EN } from '../frontend/src/i18n/content/basics.en.js';
import { BASICS_ES } from '../frontend/src/i18n/content/basics.es.js';
import { DEMINIMIS_EN } from '../frontend/src/i18n/content/deminimis.en.js';
import { DEMINIMIS_ES } from '../frontend/src/i18n/content/deminimis.es.js';
import { GLOSSARY_EN } from '../frontend/src/i18n/content/glossary.en.js';
import { GLOSSARY_ES } from '../frontend/src/i18n/content/glossary.es.js';
import { basePath, langFromPath, localePath, LANGS } from '../frontend/src/i18n/lang.js';
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

const strings = (v: unknown): string[] => (typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : []);
const urls = (v: unknown) => strings(v).flatMap((s) => s.match(/https?:\/\/[^\s)"]+/g) ?? []).sort();
// Numbers as written: $1,600, 14324, 2027, 6059B's digits... Compared as a sorted list, so order may differ with grammar.
const numbers = (v: unknown) => strings(v).flatMap((s) => s.replace(/https?:\/\/[^\s)"]+/g, ' ').match(/\d+(?:[.,]\d+)*/g) ?? []).sort();
const shape = (v: unknown): unknown => (Array.isArray(v) ? v.map(shape) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)])) : typeof v);
const pairs: [string, unknown, unknown][] = [
  ['basics', BASICS_EN, BASICS_ES],
  ['de-minimis', DEMINIMIS_EN, DEMINIMIS_ES],
  ['glossary', GLOSSARY_EN, GLOSSARY_ES],
];

for (const [name, en, es] of pairs) {
  test(`${name}: Spanish has exactly the English keys and list lengths`, () => assert.deepEqual(shape(es), shape(en)));
  test(`${name}: Spanish uses the same links as English`, () => assert.deepEqual(urls(es), urls(en)));
  test(`${name}: Spanish uses the same numbers as English`, () => {
    // Skip the visible "checked on" date text, whose month name differs but whose digits are compared like the rest.
    assert.deepEqual(numbers(es), numbers(en));
  });
}

test('glossary anchors, routes and link targets are identical in both languages', () => {
  assert.deepEqual(GLOSSARY_ES.terms.map((t) => t.id), GLOSSARY_EN.terms.map((t) => t.id));
  assert.deepEqual(GLOSSARY_ES.terms.map((t) => t.link?.to), GLOSSARY_EN.terms.map((t) => t.link?.to));
  assert.deepEqual(BASICS_ES.cards.map((c) => c.to), BASICS_EN.cards.map((c) => c.to));
});

test('every traveler allowance cites a CBP page', () => {
  for (const t of DEMINIMIS_EN.travelers) assert.match(t.href, /^https:\/\/www\.cbp\.gov\//);
  assert.ok(DEMINIMIS_EN.travelersCheckedOn.length > 0);
});

test('language helpers map addresses both ways', () => {
  assert.equal(langFromPath('/es/basics'), 'es');
  assert.equal(langFromPath('/basics'), 'en');
  assert.equal(basePath('/es/glossary'), '/glossary');
  assert.equal(localePath('es', '/de-minimis'), '/es/de-minimis');
  assert.equal(localePath('es', '/prices'), '/prices'); // not translated: stays English
  assert.deepEqual([...LANGS], ['en', 'es']);
});

test('Spanish pages are indexable, canonical to themselves, language es, with hreflang alternates; English lists them too', () => {
  for (const p of ['/basics', '/de-minimis', '/glossary']) {
    const es = pageMeta(`/es${p}`, null, null, null);
    assert.ok(es.known && es.indexable);
    assert.equal(es.canonical, `https://aexterminal.com/es${p}`);
    assert.equal(es.lang, 'es');
    assert.deepEqual(es.alternates?.map((a) => a.hreflang), ['en', 'es', 'x-default']);
    const en = pageMeta(p, null, null, null);
    assert.deepEqual(en.alternates, es.alternates);
    assert.equal(en.lang, undefined);
  }
  assert.equal(pageMeta('/es/prices', null, null, null).known, false);
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
