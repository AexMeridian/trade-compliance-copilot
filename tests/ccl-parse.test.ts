// Commerce Control List and Country Groups imports: the parsers on small fixtures cut from the real eCFR XML, and the stored snapshots
// (data/ccl.json, data/country-groups.json) against facts that are easy to check by eye on eCFR. No network, no model. Run: npm run test:unit
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parseCcl } from '../src/lib/cclParse.js';
import { HAND_VERIFIED_REASONS } from '../src/lib/cclVerified.js';
import { parseCountryGroups, groupCountryIso, GROUP_LABEL } from '../src/lib/countryGroupsParse.js';
import { CCL_COMPLETE_MIN_ENTRIES, decideExportLicense } from '../src/lib/exportLicense.js';

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

const sample = parseCcl(readFileSync('tests/fixtures/ccl-sample.xml', 'utf8'), 1);
const by = (code: string) => {
  const r = sample.find((e) => e.eccn === code);
  assert.ok(r, `${code} not parsed`);
  return r;
};

test('the fixture parses into one record per ECCN, with category and product group', () => {
  assert.deepEqual(sample.map((e) => e.eccn), ['0A998', '1C350', '5A992', '7A003']);
  assert.equal(by('1C350').category, '1');
  assert.equal(by('1C350').productGroup, 'C');
  assert.match(by('1C350').title, /precursors for toxic chemical agents/);
});

test('"applies to entire entry" with a chart column is unconditional; a family with no column is "?" (verify)', () => {
  assert.deepEqual(by('1C350').reasons, ['CB2', 'CW?', 'AT?']);
  assert.deepEqual(by('7A003').reasons, ['NS1', 'MT1?', 'AT1']);
});

test('RS applying only to 5A992.z keeps AT1 unconditional and RS conditional', () => {
  assert.deepEqual(by('5A992').reasons, ['RS?', 'AT1']);
});

test('an entry with no Country Chart reason (Russian industry sector sanctions only) is VERIFY, never uncontrolled', () => {
  assert.deepEqual(by('0A998').reasons, ['VERIFY']);
});

test('license exceptions: candidates only where the entry says Yes; the block is kept as published', () => {
  assert.deepEqual(by('1C350').licenseExceptions, []);
  assert.match(by('1C350').exceptionsText, /LVS: N\/A/);
  assert.match(by('1C350').relatedControls, /USML Category XIV/);
  assert.match(by('1C350').controlText, /CB applies to entire entry/);
});

test('a layout the parser does not know stops the build instead of loading a partial list', () => {
  assert.throws(() => parseCcl('<DIV9 N="Supplement No. 1 to Part 774"></DIV9>'), /No ECCN headings/);
  assert.throws(() => parseCcl(readFileSync('tests/fixtures/ccl-sample.xml', 'utf8')), /Only 4 ECCNs/);
});

test('every hand-verified ECCN in cclVerified.ts matches migration 0032 (reasons) and is excluded from the generated insert', () => {
  const sql = readFileSync('migrations/0032_eccn_ecfr_verified_and_syria.sql', 'utf8');
  for (const [eccn, reasons] of Object.entries(HAND_VERIFIED_REASONS)) {
    const m = new RegExp(`\\('${eccn}', '[0-9]', '[A-E]',\\s*'[\\s\\S]*?',\\s*'(\\[[^']*\\])'`).exec(sql);
    assert.ok(m, `${eccn} not found in 0032`);
    assert.deepEqual(JSON.parse(m[1]), reasons, eccn);
  }
});

const SNAPSHOT = 'data/ccl.json';
test('the stored snapshot is the whole list: at least the completeness threshold, no duplicates, every entry has a reason or VERIFY', () => {
  assert.ok(existsSync(SNAPSHOT), 'data/ccl.json missing: run npx tsx scripts/build-ccl.ts --write');
  const snap = JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as { entries: { eccn: string; reasons: string[]; title: string }[] };
  assert.ok(snap.entries.length >= CCL_COMPLETE_MIN_ENTRIES, `${snap.entries.length} entries`);
  assert.equal(new Set(snap.entries.map((e) => e.eccn)).size, snap.entries.length);
  for (const e of snap.entries) {
    assert.ok(/^[0-9][A-E][0-9]{3}$/.test(e.eccn), e.eccn);
    assert.ok(e.reasons.length > 0 && e.title.length > 0, e.eccn);
    assert.ok(e.reasons.every((r) => r === 'VERIFY' || /^[A-Z]{2}\d?\??$/.test(r)), `${e.eccn}: ${e.reasons.join(' ')}`);
  }
  const code = (c: string) => snap.entries.find((e) => e.eccn === c);
  assert.deepEqual(code('2B001')?.reasons.slice(0, 1), ['NS2']);
  assert.ok(code('9A610') && code('0A501') && code('7A003'));
});

test('a complete list makes NLR possible but the note always carries the Part 744 and embargo caveat', () => {
  const d = decideExportLicense({
    country: 'DE', hardStop: false, coverage: { status: 'curated', notes: null }, eccn: { eccn: 'EAR99', reasonsForControl: [], licenseExceptions: [] }, chartRows: [], cclComplete: true,
  });
  assert.equal(d.requirement, 'NLR');
  assert.match(d.note, /Part 744/);
  const none = decideExportLicense({ country: 'DE', hardStop: false, coverage: { status: 'curated', notes: null }, eccn: null, chartRows: [], cclComplete: true });
  assert.equal(none.requirement, 'NLR');
  assert.match(none.note, /classification judgment/);
  assert.match(none.note, /Part 744/);
});

test('a destination under a Part 746 restriction is never NLR just because the list is complete', () => {
  const d = decideExportLicense({
    country: 'RU', hardStop: false, coverage: { status: 'broad_restriction_746_5', notes: 'Russia' }, eccn: null, chartRows: [], cclComplete: true,
  });
  assert.notEqual(d.requirement, 'NLR');
});

test('the groups a destination is in are named beside country-group-dependent "verify" items, without deciding anything', () => {
  const input = {
    country: 'AE', hardStop: false, coverage: { status: 'curated' as const, notes: null }, chartRows: [], verifiedReasons: new Set(['NS', 'RS', 'AT']), cclComplete: true,
    eccn: { eccn: '3A090', reasonsForControl: ['RS?', 'AT1'], licenseExceptions: [] },
  };
  const withGroups = decideExportLicense({ ...input, countryGroups: ['B', 'D:4'] });
  assert.equal(withGroups.requirement, 'Insufficient Data');
  assert.match(withGroups.note, /Country Groups B, D:4/);
  assert.doesNotMatch(decideExportLicense(input).note, /Country Group/);
});

// ---- Country Groups ----
const cell = (v: string) => `<TD>${v}</TD>`;
const groupsXml =
  `<TABLE><CAPTION><P>Country Group A</P></CAPTION><THEAD><TR><TH>Country</TH><TH>[A:1]<br></br>Wassenaar</TH><TH>[A:2]<br></br>MTCR</TH></TR></THEAD><TBODY>` +
  `<TR><TD>Germany</TD>${cell('X')}${cell('X')}</TR><TR><TD>Argentina</TD>${cell('')}${cell('X')}</TR><TR><TD class="x">1 A footnote that spans the table</TD></TR></TBODY></TABLE>` +
  `<HD1>Country Group B—Countries</HD1><SCOL2><LI>France</LI><LI>Cote d'lvoire</LI><LI>China (PRC)</LI></SCOL2>`;

test('country groups: table memberships by X, footnote rows ignored, Group B list read', () => {
  const m = parseCountryGroups(groupsXml, false);
  const names = (g: string) => m.filter((x) => x.group === g).map((x) => x.name);
  assert.deepEqual(names('A:1'), ['Germany']);
  assert.deepEqual(names('A:2'), ['Germany', 'Argentina']);
  assert.deepEqual(names('B'), ['France', "Cote d'lvoire", 'China (PRC)']);
  assert.equal(groupCountryIso("Cote d'lvoire"), 'CI');
  assert.equal(groupCountryIso('China (PRC)'), 'CN');
  assert.equal(groupCountryIso('Nowhereland'), null);
});

test('country groups: a layout missing a whole group stops the build', () => {
  assert.throws(() => parseCountryGroups(groupsXml), /has no members/);
  assert.throws(() => parseCountryGroups('<TABLE></TABLE>', false), /Group B list not found/);
});

test('the stored Country Groups snapshot matches facts that are easy to check on eCFR', () => {
  const snap = JSON.parse(readFileSync('data/country-groups.json', 'utf8')) as { asOf: string; countries: Record<string, { groups: string[] }> };
  const g = (iso: string) => snap.countries[iso]?.groups ?? [];
  assert.ok(Object.keys(snap.countries).length >= 190);
  assert.ok(g('DE').includes('A:1') && g('DE').includes('B'));
  assert.ok(g('CN').includes('D:1') && g('CN').includes('D:5'));
  assert.ok(g('RU').includes('D:1'));
  assert.deepEqual(g('IR').filter((x) => x.startsWith('E')), ['E:1']);
  assert.deepEqual(g('CU').filter((x) => x.startsWith('E')), ['E:2']);
  assert.ok(!g('DE').some((x) => x.startsWith('D') || x.startsWith('E')));
  const known = new Set(Object.keys(GROUP_LABEL));
  for (const [iso, c] of Object.entries(snap.countries)) for (const x of c.groups) assert.ok(known.has(x), `${iso} ${x}`);
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
