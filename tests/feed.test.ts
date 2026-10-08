// Deterministic tests for the public feeds: escaping, input validation, canonical
// cache keys and well-formed output in all three formats. No network, no database.
// Run: npm run test:unit

import assert from 'node:assert/strict';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import {
  buildAtom,
  buildJsonFeed,
  buildRss,
  escapeLike,
  normalizeFilters,
  summarize,
  weakEtag,
  xmlText,
  type FeedItem,
  type FeedMeta,
} from '../src/lib/feed.js';

let failures = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`PASS  ${name}`);
  } catch (err) {
    failures++;
    console.error(`FAIL  ${name}\n  ${(err as Error).message}`);
  }
}

const params = (q: string) => {
  const sp = new URLSearchParams(q);
  return (name: string) => sp.get(name);
};
const meta: FeedMeta = {
  title: 'Aex Terminal: U.S. trade actions',
  description: 'desc',
  homeUrl: 'https://example.com/',
  selfUrl: 'https://example.com/api/pulse/rss',
  siteName: 'Aex Terminal',
  generated: '2026-10-07T00:00:00Z',
};
const item = (over: Partial<FeedItem> = {}): FeedItem => ({
  id: '2026-12345',
  title: 'Tariffs on <steel> & "aluminum"',
  url: 'https://www.federalregister.gov/d/2026-12345',
  published: '2026-10-06',
  ingested: '2026-10-06T14:00:00Z',
  tag: 'Tariff',
  agency: 'Commerce Department, Industry and Security Bureau, Other',
  docType: 'Rule',
  abstract: 'Imposes duties.\u0000 Bad char \u0008 removed.',
  ...over,
});

await test('xmlText strips XML-illegal characters and escapes markup', () => {
  assert.equal(xmlText('a\u0000b\u0008c￾d'), 'abcd');
  assert.equal(xmlText(`<a href="x">Tom & 'Jerry'</a>`), '&lt;a href=&quot;x&quot;&gt;Tom &amp; &apos;Jerry&apos;&lt;/a&gt;');
  assert.equal(xmlText('lone \uD800 surrogate'), 'lone  surrogate');
  assert.equal(xmlText('emoji \u{1F600} stays'), 'emoji \u{1F600} stays');
  assert.equal(xmlText(null), '');
});

await test('escapeLike makes percent, underscore and backslash literal', () => {
  const bs = String.fromCharCode(92);
  assert.equal(escapeLike(`100%_off${bs}`), `100${bs}%${bs}_off${bs}${bs}`);
});

await test('normalizeFilters: defaults, case, ordering and de-duplication', () => {
  const r = normalizeFilters(params('tag=sanctions,Tariff,tariff&country=mx,CN&limit=5&utm=junk'));
  assert.ok(r.ok);
  assert.deepEqual(r.filters.tags, ['Sanctions', 'Tariff']);
  assert.deepEqual(r.filters.countries, ['CN', 'MX']);
  assert.equal(r.filters.limit, 5);
  assert.equal(r.canonical, 'country=CN%2CMX&limit=5&tag=Sanctions%2CTariff');
});

await test('equivalent requests share one canonical cache key', () => {
  const a = normalizeFilters(params('country=CN,MX&tag=Tariff'));
  const b = normalizeFilters(params('tag=tariff&country=mx,cn&cachebust=123&x=y'));
  assert.ok(a.ok && b.ok);
  assert.equal(a.canonical, b.canonical);
});

await test('no filters gives an empty canonical query and the default limit', () => {
  const r = normalizeFilters(params(''));
  assert.ok(r.ok);
  assert.equal(r.canonical, '');
  assert.equal(r.filters.limit, 30);
});

await test('limit is clamped, never rejected', () => {
  for (const [raw, want] of [['0', 1], ['-9', 1], ['999', 50], ['abc', 30], ['7.9', 7]] as const) {
    const r = normalizeFilters(params(`limit=${raw}`));
    assert.ok(r.ok);
    assert.equal(r.filters.limit, want, raw);
  }
});

await test('bad input is rejected without echoing it back', () => {
  for (const q of ['tag=Nope', 'country=USA', 'country=1', 'q=a', `q=${'x'.repeat(51)}`, `country=${'AA,BB,CC,DD,EE,FF,GG,HH,II,JJ,KK'}`]) {
    const r = normalizeFilters(params(q));
    assert.equal(r.ok, false, q);
    if (!r.ok) assert.ok(!r.error.includes('Nope') && !r.error.includes('xxxx'), q);
  }
});

await test('summarize trims on a word boundary and removes control characters', () => {
  const s = summarize(`${'word '.repeat(100)}`, 50);
  assert.ok(s.endsWith('…') && s.length <= 51 && !s.includes('wor…'));
  assert.equal(summarize('a\u0000b\n\n c'), 'ab c');
  assert.equal(summarize(null), '');
});

await test('RSS output is well-formed XML with escaped content and stable guids', () => {
  const xml = buildRss([item()], meta);
  assert.equal(XMLValidator.validate(xml), true);
  const doc = new XMLParser({ ignoreAttributes: false }).parse(xml);
  const it = doc.rss.channel.item;
  assert.equal(it.title, 'Tariffs on <steel> & "aluminum"');
  assert.equal(it.guid['#text'], '2026-12345');
  assert.equal(it.guid['@_isPermaLink'], 'false');
  assert.equal(it.pubDate, 'Tue, 06 Oct 2026 12:00:00 GMT');
  assert.ok(!it.description.includes('\u0000'));
  assert.ok(doc.rss.channel.copyright.includes('not legal advice'));
  assert.ok(!xml.includes('<script'));
});

await test('Atom output is well-formed with required elements', () => {
  const xml = buildAtom([item()], { ...meta, selfUrl: 'https://example.com/api/pulse/atom' });
  assert.equal(XMLValidator.validate(xml), true);
  const doc = new XMLParser({ ignoreAttributes: false }).parse(xml);
  assert.equal(doc.feed.entry.id, 'urn:federalregister:2026-12345');
  assert.ok(doc.feed.updated && doc.feed.entry.updated && doc.feed.entry.title);
});

await test('JSON Feed parses and carries source notice', () => {
  const json = JSON.parse(buildJsonFeed([item()], meta));
  assert.equal(json.version, 'https://jsonfeed.org/version/1.1');
  assert.equal(json.items[0].id, '2026-12345');
  assert.equal(json.items[0].date_published, '2026-10-06T12:00:00.000Z');
  assert.ok(json.description.includes('public domain'));
});

await test('an empty result still yields valid feeds', () => {
  assert.equal(XMLValidator.validate(buildRss([], meta)), true);
  assert.equal(XMLValidator.validate(buildAtom([], meta)), true);
  assert.deepEqual(JSON.parse(buildJsonFeed([], meta)).items, []);
});

await test('a malformed upstream date does not break the feed', () => {
  const xml = buildRss([item({ published: 'not-a-date' })], meta);
  assert.equal(XMLValidator.validate(xml), true);
  assert.ok(!xml.includes('Invalid Date') && !xml.includes('<pubDate>'));
  assert.equal(XMLValidator.validate(buildAtom([item({ published: 'bad' })], meta)), true);
});

await test('etag is stable for identical bodies and changes with content', async () => {
  const a = await weakEtag('abc');
  assert.equal(a, await weakEtag('abc'));
  assert.notEqual(a, await weakEtag('abd'));
  assert.match(a, /^W\/"[0-9a-f]{20}"$/);
});

if (failures) {
  console.error(`\n${failures} feed test(s) failed`);
  process.exit(1);
}
console.log('\nAll feed tests passed');
