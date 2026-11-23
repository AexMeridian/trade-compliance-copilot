// The HTS / Schedule B / cross-reference sync (scripts/lib/bulkSync.ts): stable ids, difference-only SQL, first-load chapters, budget picking, and the
// generated SQL applied to a real SQLite database built from the migrations (node:sqlite, with FTS5 as D1 has). No network. Run: npm run test:unit
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import {
  HTS_SPEC, SCHEDULE_B_SPEC, bootstrapUnit, buildChapter, chapterShrunk, deltaUnit, diffChapter, groupUnits, heartbeatDue, htsDrafts, logRowSql, pickUnits,
  scheduleBDrafts, snapOf, xrefPairs, xrefUnit, type HtsApiRow, type Unit,
} from '../scripts/lib/bulkSync.js';

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

const api = (htsno: string, indent: number, description: string, general = ''): HtsApiRow => ({ htsno, indent: String(indent), description, units: [], general, special: '', other: '', footnotes: [] });
const REV1: HtsApiRow[] = [
  api('', 0, 'Live horses, asses, mules and hinnies'),
  api('0101.21', 1, 'Horses: Pure-bred breeding animals'),
  api('0101.21.00.10', 2, 'Male', 'Free'),
  api('0101.21.00.20', 2, 'Female', 'Free'),
  api('0101.29', 1, 'Other'),
  api('0101.29.00.00', 2, 'Other', '6.8%'),
];

function freshDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  for (const f of readdirSync('migrations').filter((x) => x.endsWith('.sql')).sort()) db.exec(readFileSync(`migrations/${f}`, 'utf8'));
  return db;
}
const apply = (db: DatabaseSync, unit: Unit | null) => {
  assert.ok(unit);
  db.exec(unit.sql.join('\n'));
};
const rows = (db: DatabaseSync) => db.prepare('SELECT id, htsno, description, general_rate, superior_id FROM hts_lines ORDER BY id').all() as { id: number; htsno: string; description: string; general_rate: string; superior_id: number | null }[];

test('ids are chapter-blocked and parents come from the indent stack', () => {
  const b = buildChapter(HTS_SPEC, 1, htsDrafts(1, REV1, '2026-11-22'), null, true);
  assert.deepEqual(b.rows.map((r) => r.id), [100001, 100002, 100003, 100004, 100005, 100006]);
  assert.equal(b.rows[2].cols.superior_id, 100002);
  assert.equal(b.rows[5].cols.superior_id, 100005);
  assert.equal(b.next, 7);
});

test('an unchanged chapter has an empty difference, and a new line near the top shifts no other id', () => {
  const first = buildChapter(HTS_SPEC, 1, htsDrafts(1, REV1, 'a'), null, true);
  const snap = snapOf(first.rows, first.next, 'fp1');
  const same = buildChapter(HTS_SPEC, 1, htsDrafts(1, REV1, 'b'), snap, true);
  assert.equal(deltaUnit('hts', HTS_SPEC, '01', diffChapter(snap, same.rows)), null, 'a new retrieval date alone writes nothing');
  const rev2 = [REV1[0], api('0101.10', 1, 'Pure-bred breeding'), ...REV1.slice(1)];
  const next = buildChapter(HTS_SPEC, 1, htsDrafts(1, rev2, 'b'), snap, true);
  const diff = diffChapter(snap, next.rows);
  assert.equal(diff.added.length, 1);
  assert.equal(diff.added[0].id, 100007);
  assert.equal(diff.changed.length, 0);
  assert.equal(diff.removed.length, 0);
  assert.equal(diff.unchanged, 6);
});

test('a rate change is an UPDATE that leaves the path index alone; a new heading rebuilds it', () => {
  const first = buildChapter(HTS_SPEC, 1, htsDrafts(1, REV1, 'a'), null, true);
  const snap = snapOf(first.rows, first.next, 'fp1');
  const rateChanged = REV1.map((r) => (r.htsno === '0101.29.00.00' ? { ...r, general: '7%' } : r));
  const d1 = diffChapter(snap, buildChapter(HTS_SPEC, 1, htsDrafts(1, rateChanged, 'b'), snap, true).rows);
  assert.equal(d1.changed.length, 1);
  assert.equal(d1.treeChanged, 0);
  const u1 = deltaUnit('hts', HTS_SPEC, '01', d1)!;
  assert.ok(!u1.sql.some((s) => s.includes('hts_path_search')));
  assert.ok(u1.sql.some((s) => s.startsWith('UPDATE hts_lines SET')));
  assert.ok(u1.writes < 20);
  const added = [...REV1, api('0101.30', 1, 'Asses')];
  const u2 = deltaUnit('hts', HTS_SPEC, '01', diffChapter(snap, buildChapter(HTS_SPEC, 1, htsDrafts(1, added, 'b'), snap, true).rows))!;
  assert.ok(u2.sql.some((s) => s.includes('hts_path_search')));
});

test('first load, then a revision, applied to a real database give exactly the new file', () => {
  const db = freshDb();
  // The table holds something unknown for chapter 01 before the first sync: it must be replaced, not duplicated.
  db.exec(`INSERT INTO hts_lines (id, htsno, indent, description, superior_id, units, general_rate, special_rate, other_rate, footnotes, chapter, revision, source_url, source_tier, last_updated)
           VALUES (1, '0101.99', 0, 'stale old row', NULL, '[]', 'Free', '', '', '[]', '01', 'old', 'u', 1, '2026-01-01'),
                  (2, '0101.99.00', 1, 'stale child', 1, '[]', 'Free', '', '', '[]', '01', 'old', 'u', 1, '2026-01-01')`);
  const first = buildChapter(HTS_SPEC, 1, htsDrafts(1, REV1, 'a'), null, true);
  apply(db, bootstrapUnit('hts', HTS_SPEC, '01', first.rows));
  assert.deepEqual(rows(db).map((r) => r.htsno), REV1.map((r) => r.htsno));
  assert.equal((db.prepare(`SELECT COUNT(*) AS n FROM hts_path_search`).get() as { n: number }).n, 5); // every line with a number has ancestors except none-numbered heading
  const snap = snapOf(first.rows, first.next, 'fp1');
  // Revision: one rate changed, one line removed, one added, one renamed.
  const rev2: HtsApiRow[] = [REV1[0], REV1[1], api('0101.21.00.10', 2, 'Male', '1%'), api('0101.21.00.25', 2, 'Gelding', 'Free'), REV1[4], api('0101.29.00.00', 2, 'Other animals', '6.8%')];
  const built = buildChapter(HTS_SPEC, 1, htsDrafts(1, rev2, 'b'), snap, true);
  const diff = diffChapter(snap, built.rows);
  assert.equal(diff.changed.length, 1);
  assert.equal(diff.added.length, 2); // the new line and the renamed one (a different description is a different line)
  assert.equal(diff.removed.length, 2); // 0101.21.00.20 and the old 0101.29.00.00
  apply(db, deltaUnit('hts', HTS_SPEC, '01', diff));
  const now = rows(db);
  assert.deepEqual(now.map((r) => [r.htsno, r.description, r.general_rate]).sort(), rev2.map((r) => [r.htsno, r.description, r.general]).sort());
  const byId = new Map(now.map((r) => [r.id, r]));
  for (const r of now) if (r.superior_id !== null) assert.ok(byId.has(r.superior_id), 'every parent exists');
  assert.ok(now.find((r) => r.htsno === '0101.21.00.10')!.id === 100003, 'an unchanged line keeps its id');
  // The search index follows the rows.
  assert.equal((db.prepare(`SELECT COUNT(*) AS n FROM hts_search WHERE hts_search MATCH 'gelding'`).get() as { n: number }).n, 1);
  assert.equal((db.prepare(`SELECT COUNT(*) AS n FROM hts_search WHERE hts_search MATCH 'female'`).get() as { n: number }).n, 0);
});

test('duplicate lines (same number, indent and text) get distinct stable ids', () => {
  const dup = [api('0202.10', 1, 'Carcasses'), api('0202.10.00', 2, 'Other'), api('0202.20', 1, 'Cuts'), api('0202.20.00', 2, 'Other')];
  const b = buildChapter(HTS_SPEC, 2, htsDrafts(2, [...dup, api('0202.10.00', 2, 'Other')], 'a'), null, true);
  assert.equal(new Set(b.rows.map((r) => r.id)).size, 5);
  assert.equal(new Set(b.rows.map((r) => r.key)).size, 5);
});

test('Schedule B drafts group by chapter and load into a real table', () => {
  const db = freshDb();
  const byCh = scheduleBDrafts(
    [['0101210000', 'Pure-bred horses', 'NO', ''], ['0101290000', 'Other horses', 'NO', ''], ['0201100000', 'Beef carcasses', 'KG', ''], ['bad', 'x', '', '']],
    '2026-11-22',
    null
  );
  assert.deepEqual([...byCh.keys()], [1, 2]);
  const ch1 = buildChapter(SCHEDULE_B_SPEC, 1, byCh.get(1)!, null, false);
  apply(db, bootstrapUnit('schedule_b', SCHEDULE_B_SPEC, '01', ch1.rows));
  const got = db.prepare('SELECT id, code, hs6, units FROM schedule_b_lines ORDER BY id').all() as { id: number; code: string; hs6: string; units: string }[];
  assert.deepEqual(got.map((r) => r.code), ['0101210000', '0101290000']);
  assert.equal(got[0].units, '["NO"]');
});

test('the cross-reference pairs 10-digit HTS lines with Schedule B codes on the same HS-6, and a first load then a delta apply cleanly', () => {
  const db = freshDb();
  const h = buildChapter(HTS_SPEC, 1, htsDrafts(1, REV1, 'a'), null, true);
  const s = buildChapter(SCHEDULE_B_SPEC, 1, scheduleBDrafts([['0101210000', 'Pure-bred horses', 'NO', ''], ['0101290000', 'Other', 'NO', '']], 'a', null).get(1)!, null, false);
  const pairs = xrefPairs(snapOf(h.rows, h.next, 'x'), snapOf(s.rows, s.next, 'y'));
  assert.deepEqual(pairs, ['0101.21.00.10|0101210000', '0101.21.00.20|0101210000', '0101.29.00.00|0101290000']);
  apply(db, xrefUnit('01', undefined, pairs));
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM hts_schedule_b_xref').get() as { n: number }).n, 3);
  assert.equal(xrefUnit('01', pairs, pairs), null);
  const fewer = pairs.slice(1);
  apply(db, xrefUnit('01', pairs, fewer));
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM hts_schedule_b_xref').get() as { n: number }).n, 2);
});

test('budget: first loads wait for the next run once the budget is used, but one unit always runs', () => {
  const u = (label: string, kind: Unit['kind'], writes: number): Unit => ({ label, kind, sql: [], writes, changes: 1 });
  const { run, deferred } = pickUnits([u('a', 'bootstrap', 30_000), u('b', 'bootstrap', 30_000), u('c', 'delta', 500), u('d', 'bootstrap', 10_000)], 55_000);
  assert.deepEqual(run.map((x) => x.label), ['c', 'd', 'a']);
  assert.deepEqual(deferred.map((x) => x.label), ['b']);
  assert.deepEqual(pickUnits([u('big', 'bootstrap', 80_000)], 55_000).run.map((x) => x.label), ['big']);
  assert.throws(() => pickUnits([u('huge', 'bootstrap', 95_000)], 55_000));
  assert.equal(pickUnits([u('x', 'delta', 10)], 0, false).run.length, 0);
});

test('guards, heartbeat and the log row', () => {
  assert.equal(chapterShrunk(200, 60), true);
  assert.equal(chapterShrunk(200, 150), false);
  assert.equal(chapterShrunk(5, 0), false, 'tiny chapters are not judged by ratio');
  const now = Date.parse('2026-11-22T00:00:00Z');
  assert.equal(heartbeatDue(null, now), true);
  assert.equal(heartbeatDue('2026-11-21T00:00:00Z', now), false);
  assert.equal(heartbeatDue('2026-11-10T00:00:00Z', now), true);
  const db = freshDb();
  db.exec(logRowSql('hts', 12, 340, "it's loaded", '2026-11-22T00:00:00.000Z'));
  const row = db.prepare(`SELECT status, rows_affected, rows_written FROM data_refresh_log WHERE source = 'hts'`).get() as { status: string; rows_affected: number; rows_written: number };
  assert.deepEqual({ ...row }, { status: 'success', rows_affected: 12, rows_written: 340 });
});

test('files group whole units under the size limit', () => {
  const unit = (n: number): Unit => ({ label: 'u', kind: 'delta', sql: ['x'.repeat(n)], writes: 1, changes: 1 });
  assert.equal(groupUnits([unit(600), unit(600), unit(600)], 1_000).length, 3);
  assert.equal(groupUnits([unit(300), unit(300), unit(300)], 1_000).length, 1);
});

if (failures) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
