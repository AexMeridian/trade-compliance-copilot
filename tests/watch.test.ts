// CBP CSMS parsing and tagging, the daily list "what changed" data, Chapter 99 heading numbers and the IEEPA timeline's sources.
// No network. Run: npm run test:unit
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { mergeMessages, parseCsmsFeed, rssDate, tagPrograms } from '../src/lib/pulse/csms.js';
import { buildChangesRss, entryUrl, mergeDay, recordChanges, summarize, EMPTY_CHANGES, type ChangesFile } from '../src/lib/listChanges.js';
import { entriesFromMigration, readTuple } from '../scripts/build-list-changes.js';
import { annotateChapter99, chapter99Headings } from '../src/lib/chapter99.js';
import { IEEPA_EVENTS, IEEPA_REFUND_LINKS } from '../frontend/src/lib/ieepaTimeline.js';
import type { DutyStackLine } from '../src/types/case.js';

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

// ---- CSMS ----
const FEED = `<?xml version="1.0"?><rss><channel><title>Automated Broker Interface - Recent Updates</title>
<item><pubDate>Thu, 19 Nov 2026 09:43:26 -0600</pubDate><title>CSMS # 70476863 - ACE Production Standard Invasive Maintenance from 10:00 p.m. ET</title><guid>70476863</guid><link>https://content.govdelivery.com/accounts/USDHSCBP/bulletins/433643f</link><description><![CDATA[<table><tr><td>Section 232 in the body must not be used</td></tr></table>]]></description></item>
<item><pubDate>Wed, 21 Oct 2026 14:12:41 -0500</pubDate><title>CSMS # 70422566 - Section 232 Duties on Imports of Polysilicon &amp; Derivatives in the Certification (CERT) Testing Environment</title><guid>70422566</guid><link>https://content.govdelivery.com/accounts/USDHSCBP/bulletins/aaa111</link><description>x</description></item>
<item><pubDate>Tue, 20 Oct 2026 10:00:00 -0500</pubDate><title>Not a CSMS title</title><link>https://content.govdelivery.com/accounts/USDHSCBP/bulletins/bad</link></item>
</channel></rss>`;

test('CSMS feed items are read without using the message body', () => {
  const m = parseCsmsFeed(FEED);
  assert.equal(m.length, 2);
  assert.deepEqual(m[0], { id: '70476863', title: 'ACE Production Standard Invasive Maintenance from 10:00 p.m. ET', published: '2026-11-19', url: 'https://content.govdelivery.com/accounts/USDHSCBP/bulletins/433643f', programs: ['ACE'] });
  assert.equal(m[1].title.includes('&amp;'), false);
  assert.deepEqual(m[1].programs, ['Section 232']);
});

test('programs are tagged from the title only', () => {
  assert.deepEqual(tagPrograms('Updated Guidance: Section 301 China Conforming Amendment'), ['Section 301']);
  assert.deepEqual(tagPrograms('Further Modifying Section 338 Additional Duties on Certain Goods of Canada'), ['Section 338']);
  assert.deepEqual(tagPrograms('Ending Collection of International Emergency Economic Powers Act Duties'), ['IEEPA']);
  assert.deepEqual(tagPrograms('AD/CVD entries: antidumping and countervailing duty deposits'), ['AD/CVD']);
  assert.deepEqual(tagPrograms('Suspension of de minimis treatment'), ['De minimis']);
  assert.deepEqual(tagPrograms('Withhold Release Order on forced labor goods'), ['Forced labor']);
  assert.deepEqual(tagPrograms('Harmonized System Update (HSU) 2627'), []);
  assert.deepEqual(tagPrograms('Pace of the facing'), [], 'ACE inside another word is not a tag');
});

test('feed dates are read as written and messages merge newest first without duplicates', () => {
  assert.equal(rssDate('Sun, 01 Feb 2026 23:59:00 -0600'), '2026-02-01');
  assert.equal(rssDate('nonsense'), null);
  const a = { id: '1', title: 'a', published: '2026-01-02', url: 'https://x', programs: [] };
  const b = { id: '2', title: 'b', published: '2026-01-03', url: 'https://x', programs: [] };
  assert.deepEqual(mergeMessages([a], [a, b]).map((m) => m.id), ['2', '1']);
});

// ---- list changes ----
const day = (added: string[], removed: string[], updated = 0) => ({
  added: added.map((n, i) => ({ uid: `a${i}-${n}`, name: n })),
  removed: removed.map((n, i) => ({ uid: `r${i}-${n}`, name: n })),
  addedCount: added.length,
  removedCount: removed.length,
  updatedCount: updated,
});

test('recording a day keeps counts, skips empty runs and merges a second run on the same day', () => {
  let f: ChangesFile = EMPTY_CHANGES;
  f = recordChanges(f, '2026-11-23', 'sdn', day([], [], 0), 'now');
  assert.deepEqual(f.days, {}, 'a run with no change is not recorded');
  f = recordChanges(f, '2026-11-23', 'sdn', day(['ACME'], ['OLD CO'], 2), 'now');
  f = recordChanges(f, '2026-11-23', 'sdn', day(['BETA'], [], 1), 'now');
  const d = f.days['2026-11-23'].sdn!;
  assert.equal(d.addedCount, 2);
  assert.equal(d.updatedCount, 3);
  assert.equal(d.added.length, 2);
  assert.throws(() => recordChanges(f, 'bad', 'sdn', day(['x'], []), 'now'));
  const s = summarize(f);
  assert.equal(s[0].date, '2026-11-23');
  assert.equal(s[0].addedTotal, 2);
  assert.equal(mergeDay(undefined, day(['x'], [])).addedCount, 1);
});

test('the RSS feed has one permalinked item per day and escapes markup in names', () => {
  const f = recordChanges(EMPTY_CHANGES, '2026-11-23', 'csl', day(['A & B <Ltd>'], []), 'now');
  const xml = buildChangesRss(f, 'https://aexterminal.com');
  assert.ok(xml.includes('<link>https://aexterminal.com/changes/2026-11-23</link>'));
  assert.ok(xml.includes('A &amp; B &lt;Ltd&gt;'));
  assert.equal((xml.match(/<item>/g) ?? []).length, 1);
});

test('entry links: SDN entries have their own official page, the others link to the list', () => {
  assert.equal(entryUrl('sdn', '36'), 'https://sanctionssearch.ofac.treas.gov/Details.aspx?id=36');
  assert.equal(entryUrl('csl', '1', 'https://www.bis.gov/x'), 'https://www.bis.gov/x');
  assert.equal(entryUrl('csl', '1', 'javascript:alert(1)'), 'https://www.trade.gov/consolidated-screening-list');
});

test('names of added entries are read back from a committed sync migration', () => {
  const sql = readFileSync('migrations/0053_lists_sync_20261122_1.sql', 'utf8');
  const rows = entriesFromMigration(sql, 'csl_entries');
  assert.equal(rows.get('17250')?.name, 'Public Joint Stock Company Gazprom');
  assert.equal(readTuple("('a', 'it''s', NULL, 3, 'z')", 0).join('|'), "a|it's|NULL|3|z");
});

// ---- Chapter 99 ----
const verified = JSON.parse(readFileSync('data/chapter99-headings.json', 'utf8')) as { headings: Record<string, string> };

test('China Section 301 layers carry the heading named in their own legal basis, and it exists in the HTS', () => {
  const line = { layer: 'Section 301 (China, List 3, heading 9903.88.03)', legal_basis: 'Section 301, China, List 3: HTSUS heading 9903.88.03, 25%' };
  assert.deepEqual(chapter99Headings(line, '85171300'), ['9903.88.03']);
  assert.ok(verified.headings['9903.88.03'], '9903.88.03 is a chapter 99 heading');
  assert.deepEqual(chapter99Headings({ layer: 'Section 301 (China tariff actions): NOT EVALUATED', legal_basis: 'USTR China actions (HTSUS 9903.88.01 to 9903.88.04)' }, '85171300'), [], 'a range in prose is not one heading');
});

test('every heading named in the loaded China Section 301 rows exists in the verified chapter 99 list', () => {
  const missing = new Set<string>();
  for (const f of readdirSync('migrations').filter((n) => /^008\d_sec301_china/.test(n))) {
    for (const m of readFileSync(`migrations/${f}`, 'utf8').matchAll(/HTSUS heading (9903\.\d\d\.\d\d)/g)) if (!verified.headings[m[1]]) missing.add(m[1]);
  }
  assert.deepEqual([...missing], []);
});

test('Section 232 autos map to 9903.94.01 only on passenger-vehicle lines; metals, forced labor and 338 get no number', () => {
  assert.match(verified.headings['9903.94.01'], /^Except for products described in headings 9903\.94\.02/);
  const mk = (layer: string): DutyStackLine => ({ layer, rate_pct: 25, rate_type: 'ad_valorem', legal_basis: 'x', effective_date: '2026-01-01', applies: true, reason_if_not_applied: null, caveat: null, source: null });
  assert.deepEqual(chapter99Headings(mk('Section 232 (autos)'), '87032310'), ['9903.94.01']);
  assert.deepEqual(chapter99Headings(mk('Section 232 (autos)'), '87041000'), []);
  for (const layer of ['Section 232 (steel)', 'Section 301 (forced-labor determination)', 'Section 338 (Canada)', 'HTS Column 1 General']) assert.deepEqual(chapter99Headings(mk(layer), '73239300'), [], layer);
  const lines = annotateChapter99([mk('Section 232 (autos)'), mk('HTS Column 1 General')], '87032310');
  assert.deepEqual(lines.map((l) => l.chapter99 ?? null), [['9903.94.01'], null]);
});

// ---- IEEPA timeline ----
const OFFICIAL_HOSTS = ['www.cbp.gov', 'content.govdelivery.com', 'www.supremecourt.gov', 'www.whitehouse.gov', 'www.cit.uscourts.gov'];

test('every IEEPA timeline entry has a date, an authority, a status and an official source page', () => {
  for (const e of IEEPA_EVENTS) {
    assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/, e.title);
    assert.ok(e.authority.length > 5 && e.statusNow.length > 5 && e.title.length > 5, e.title);
    const u = new URL(e.sourceUrl);
    assert.equal(u.protocol, 'https:');
    assert.ok(OFFICIAL_HOSTS.includes(u.hostname), `${e.title}: ${u.hostname} is not an official host`);
  }
  for (const l of IEEPA_REFUND_LINKS) assert.ok(OFFICIAL_HOSTS.includes(new URL(l.url).hostname), l.url);
  const dates = IEEPA_EVENTS.map((e) => e.date);
  assert.deepEqual(dates, [...dates].sort(), 'entries are in date order');
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
