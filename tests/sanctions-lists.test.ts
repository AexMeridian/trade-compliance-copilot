// Sanctions list freshness, screening policy, and the SDN/UK loaders' pure parts (streaming parse, delta plan). No network, no database, no model.
// Run: npm run test:unit

import assert from 'node:assert/strict';
import { evaluateListFreshness, freshnessCaveat, type ListFreshnessInput } from '../src/lib/listFreshness.js';
import { listKind, floorVerdict, decideSeverity } from '../src/lib/screeningPolicy.js';
import { planSdnDelta, recordSignature, toRecord, streamEntries, type SdnRecord } from '../src/lib/refresh/sdn.js';
import { parseDesignation, streamDesignations } from '../src/lib/refresh/ukSanctions.js';

let failures = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`ok   ${name}`);
  } catch (err) {
    failures++;
    console.error(`FAIL ${name}\n  ${(err as Error).message}`);
  }
}

const L = (over: Partial<ListFreshnessInput>): ListFreshnessInput => ({
  source: 'sdn',
  label: 'OFAC SDN',
  hasRows: true,
  lastSuccess: '2026-11-20T01:00:00Z',
  tableAsOf: '2026-11-19',
  lastError: null,
  ...over,
});
const TODAY = '2026-11-21';

function streamOf(text: string, chunk: number): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  let i = 0;
  return new ReadableStream({
    pull(c) {
      if (i >= bytes.length) return c.close();
      c.enqueue(bytes.slice(i, i + chunk));
      i += chunk;
    },
  });
}

async function main() {
  // --- freshness ---
  await test('a list loaded yesterday is ok and has no caveat', () => {
    const r = evaluateListFreshness([L({})], TODAY);
    assert.equal(r[0].state, 'ok');
    assert.equal(r[0].age_days, 1);
    assert.equal(freshnessCaveat(r), null);
  });
  await test('a list older than nine days is stale and the caveat names it', () => {
    const r = evaluateListFreshness([L({ lastSuccess: '2026-10-04T01:00:00Z', tableAsOf: '2026-10-01' })], TODAY);
    assert.equal(r[0].state, 'stale');
    assert.match(freshnessCaveat(r) ?? '', /OFAC SDN: STALE \(last loaded 2026-10-04, 48 days ago/);
  });
  await test('an empty table is NOT LOADED, whatever the log says', () => {
    const r = evaluateListFreshness([L({ source: 'uk_sanctions', label: 'UK Sanctions List', hasRows: false })], TODAY);
    assert.equal(r[0].state, 'not_loaded');
    assert.equal(r[0].as_of, null);
    assert.match(freshnessCaveat(r) ?? '', /UK Sanctions List: NOT LOADED/);
  });
  await test('rows with no recorded date at all (the seed) are stale, never ok', () => {
    assert.equal(evaluateListFreshness([L({ lastSuccess: null, tableAsOf: null })], TODAY)[0].state, 'stale');
  });
  await test('the table date counts when the log has no success (seeded list, failing refresh)', () => {
    const r = evaluateListFreshness([L({ lastSuccess: null, tableAsOf: '2026-09-23', lastError: 'OFAC SDN fetch failed: HTTP 525' })], TODAY);
    assert.equal(r[0].state, 'stale');
    assert.match(freshnessCaveat(r) ?? '', /HTTP 525/);
  });

  // --- policy ---
  await test('list kinds from the CSL source text', () => {
    assert.equal(listKind('CSL', 'Entity List (EL) - Bureau of Industry and Security'), 'entity_dpl');
    assert.equal(listKind('CSL', 'Denied Persons List (DPL) - Bureau of Industry and Security'), 'entity_dpl');
    assert.equal(listKind('CSL', 'ITAR Debarred (DTC) - State Department'), 'itar_debarred');
    assert.equal(listKind('CSL', 'Unverified List (UVL) - Bureau of Industry and Security'), 'uvl');
    assert.equal(listKind('CSL', 'Capta List (CAP) - Treasury Department'), 'capta');
    assert.equal(listKind('CSL', 'Foreign Sanctions Evaders (FSE) - Treasury Department'), 'fse');
    assert.equal(listKind('CSL', 'Military End User (MEU) List - Bureau of Industry and Security'), 'meu');
    assert.equal(listKind('SDN', 'SDN'), 'sdn');
  });
  await test('hard stops: SDN and FSE both directions; Entity List, UN, ITAR-debarred on export only', () => {
    const sev = (direction: 'import' | 'export', ...trueKinds: Parameters<typeof decideSeverity>[0]['trueKinds']) =>
      decideSeverity({ direction, trueKinds, anyInconclusive: false, listsNotCurrent: false }).severity;
    assert.equal(sev('import', 'sdn'), 'hard_stop');
    assert.equal(sev('import', 'fse'), 'hard_stop');
    assert.equal(sev('export', 'itar_debarred'), 'hard_stop');
    assert.equal(sev('export', 'entity_dpl'), 'hard_stop');
    assert.equal(sev('import', 'entity_dpl'), 'caution');
    assert.equal(sev('import', 'itar_debarred'), 'caution');
    assert.equal(sev('export', 'uvl'), 'caution');
    assert.equal(sev('export', 'capta'), 'caution');
    assert.equal(sev('export', 'meu'), 'caution');
  });
  await test('no matches against current lists is none; against a stale or empty list it is at least caution', () => {
    assert.equal(decideSeverity({ direction: 'export', trueKinds: [], anyInconclusive: false, listsNotCurrent: false }).severity, 'none');
    assert.equal(decideSeverity({ direction: 'export', trueKinds: [], anyInconclusive: false, listsNotCurrent: true }).severity, 'caution');
  });
  await test('a model false_positive on an SDN name scoring 0.85 or more is floored to inconclusive', () => {
    assert.deepEqual(floorVerdict('SDN', 0.9, 'false_positive'), { verdict: 'inconclusive', floored: true });
    assert.deepEqual(floorVerdict('SDN', 0.85, 'false_positive'), { verdict: 'inconclusive', floored: true });
    assert.deepEqual(floorVerdict('SDN', 0.84, 'false_positive'), { verdict: 'false_positive', floored: false });
    assert.deepEqual(floorVerdict('CSL', 0.99, 'false_positive'), { verdict: 'false_positive', floored: false });
    assert.deepEqual(floorVerdict('SDN', 0.99, 'true_match'), { verdict: 'true_match', floored: false });
  });

  // --- SDN loader ---
  const entryXml = (uid: number, last: string, extra = '') =>
    `<sdnEntry><uid>${uid}</uid><lastName>${last}</lastName><sdnType>Entity</sdnType><programList><program>CUBA</program></programList>${extra}</sdnEntry>`;
  const sdnDoc = (entries: string[]) =>
    `<?xml version="1.0"?><sdnList><publshInformation><Publish_Date>11/20/2026</Publish_Date><Record_Count>${entries.length}</Record_Count></publshInformation>${entries.join('\n')}</sdnList>`;

  await test('SDN stream yields every entry however the body is chunked, and reports the header once', async () => {
    const xml = sdnDoc([
      entryXml(1, 'ALPHA'),
      entryXml(2, 'BETA', '<akaList><aka><uid>9</uid><type>a.k.a.</type><lastName>BETA TWO</lastName></aka></akaList>'),
      entryXml(3, 'GAMMA'),
    ]);
    for (const chunk of [7, 64, 100000]) {
      let headers = 0;
      let header: { publishDate: string | null; recordCount: number | null } | null = null;
      const got: string[] = [];
      for await (const e of streamEntries(new Response(streamOf(xml, chunk)), async (h) => {
        headers++;
        header = h;
        return true;
      })) {
        got.push(`${e.uid}:${e.lastName}`);
      }
      assert.deepEqual(got, ['1:ALPHA', '2:BETA', '3:GAMMA'], `chunk ${chunk}`);
      assert.equal(headers, 1);
      assert.deepEqual(header, { publishDate: '11/20/2026', recordCount: 3 });
    }
  });
  await test('SDN stream stops without parsing when the header says unchanged', async () => {
    const xml = sdnDoc([entryXml(1, 'ALPHA')]);
    const got: unknown[] = [];
    for await (const e of streamEntries(new Response(streamOf(xml, 16)), async () => false)) got.push(e);
    assert.equal(got.length, 0);
  });
  const rec = (uid: number, name: string, aliases: string[] = []): SdnRecord =>
    toRecord({
      uid,
      lastName: name,
      sdnType: 'Entity',
      programList: { program: 'CUBA' },
      akaList: aliases.length ? { aka: aliases.map((a) => ({ type: 'a.k.a.', lastName: a })) } : undefined,
    });
  const stored = (records: SdnRecord[]) => new Map(records.map((r, i) => [r.uid, { id: i + 1, sig: recordSignature(r) }]));

  await test('delta: an identical file writes nothing', () => {
    const base = [rec(1, 'A', ['A2']), rec(2, 'B')];
    const d = planSdnDelta(stored(base), [rec(1, 'A', ['A2']), rec(2, 'B')]);
    assert.deepEqual([d.removeIds.length, d.insert.length, d.unchanged], [0, 0, 2]);
  });
  await test('delta: new, changed (alias added) and removed entries are the only writes', () => {
    const base = [rec(1, 'A'), rec(2, 'B'), rec(3, 'C')];
    const d = planSdnDelta(stored(base), [rec(1, 'A', ['A-ALIAS']), rec(2, 'B'), rec(4, 'D')]);
    assert.deepEqual(d.removeIds.sort(), [1, 3]); // changed #1 and removed #3
    assert.deepEqual(d.insert.map((r) => r.uid).sort(), ['1', '4']);
    assert.equal(d.unchanged, 1);
  });
  await test('delta: alias order does not make an entry look changed', () => {
    const d = planSdnDelta(stored([rec(1, 'A', ['X', 'Y'])]), [rec(1, 'A', ['Y', 'X'])]);
    assert.equal(d.insert.length, 0);
  });

  // --- UK loader ---
  const designation = (uid: string, primary: string, alias: string) =>
    `<Designation><LastUpdated>04/08/2026</LastUpdated><DateDesignated>29/06/2012</DateDesignated><UniqueID>${uid}</UniqueID><OFSIGroupID>12703</OFSIGroupID><Names><Name><Name6>${primary}</Name6><NameType>Primary Name</NameType></Name><Name><Name6>${alias}</Name6><NameType>Alias</NameType></Name></Names><RegimeName>The Russia (Sanctions) (EU Exit) Regulations 2019</RegimeName><IndividualEntityShip>Entity</IndividualEntityShip><DesignationSource>UK</DesignationSource><UKStatementofReasons>Reason &amp; more</UKStatementofReasons><Addresses><Address><AddressLine1>1 High St</AddressLine1><AddressCountry>Russia</AddressCountry></Address></Addresses></Designation>`;
  await test('UK designation parses name, alias, regime, ISO date and address', () => {
    const d = parseDesignation(designation('RUS0001', 'ACME LLC', 'Acme Holding'))!;
    assert.equal(d.uid, 'RUS0001');
    assert.equal(d.primaryName, 'ACME LLC');
    assert.deepEqual(d.aliases, [{ name: 'Acme Holding', type: 'Alias' }]);
    assert.equal(d.dateListed, '2012-06-29');
    assert.equal(d.statementOfReasons, 'Reason & more');
    assert.equal(d.address, '1 High St, Russia');
    assert.equal(d.listingType, 'UK');
  });
  await test('UK stream yields each designation whatever the chunking', async () => {
    const xml = `<?xml version="1.0"?><Designations><DateGenerated>20/11/2026</DateGenerated>${designation('A1', 'ONE', 'o')}${designation('A2', 'TWO', 't')}</Designations>`;
    for (const chunk of [5, 77, 1e6]) {
      let generated: string | null = null;
      const uids: string[] = [];
      for await (const b of streamDesignations(streamOf(xml, chunk), async (g) => {
        generated = g;
        return true;
      })) {
        uids.push(parseDesignation(b)!.uid);
      }
      assert.deepEqual(uids, ['A1', 'A2']);
      assert.equal(generated, '20/11/2026');
    }
  });

  if (failures > 0) {
    console.error(`\n${failures} test(s) failed`);
    process.exit(1);
  }
}
main();
