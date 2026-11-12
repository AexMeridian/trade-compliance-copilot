// Health rules (src/lib/health.ts), the alert email planner, the message builder and the calendar: everything that decides whether the owner
// is told, with no database, network or model. Run: npm run test:unit

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import {
  EXPECTED_TABLES, checkSources, checkCurated, checkSchema, checkModel, checkCanaries, planMail, SOURCE_MAX_AGE_DAYS,
  type AlertState, type Finding,
} from '../src/lib/health.js';
import { buildRawMessage } from '../src/lib/notify.js';
import { parseReminderDates, upcomingChores } from '../src/lib/calendar.js';

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

const now = new Date('2026-11-10T08:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

test('EXPECTED_TABLES equals the tables the migrations create', () => {
  const created = new Set<string>();
  for (const f of readdirSync('migrations').filter((x) => x.endsWith('.sql'))) {
    const sql = readFileSync(`migrations/${f}`, 'utf8').replace(/--.*$/gm, '');
    for (const m of sql.matchAll(/CREATE\s+(?:VIRTUAL\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_0-9]+)/gi)) created.add(m[1].toLowerCase());
  }
  assert.deepEqual([...created].sort(), [...EXPECTED_TABLES].sort());
});
test('a missing table is critical and named', () => {
  assert.deepEqual(checkSchema(EXPECTED_TABLES), []);
  const f = checkSchema(EXPECTED_TABLES.filter((t) => t !== 'model_cache'));
  assert.equal(f.length, 1);
  assert.equal(f[0].severity, 'critical');
  assert.match(f[0].detail, /model_cache/);
});

test('a source inside its limit with one error is quiet; two in a row is critical', () => {
  const row = (errors: number, ageDays: number) => [{ source: 'sdn', lastOk: daysAgo(ageDays), errorsSinceOk: errors, lastError: 'boom' }];
  assert.equal(checkSources(row(0, 3), now).filter((f) => f.key === 'source:sdn').length, 0);
  assert.equal(checkSources(row(1, 3), now).filter((f) => f.key === 'source:sdn').length, 0);
  const two = checkSources(row(2, 3), now).find((f) => f.key === 'source:sdn');
  assert.equal(two?.severity, 'critical');
  assert.match(two!.title, /failed 2 times/);
});
test('a source past its age limit is critical', () => {
  const f = checkSources([{ source: 'hts', lastOk: daysAgo(SOURCE_MAX_AGE_DAYS.hts + 1), errorsSinceOk: 0, lastError: null }], now).find((x) => x.key === 'source:hts');
  assert.equal(f?.severity, 'critical');
  assert.match(f!.title, /10 days old/);
});
test('a source that has never refreshed is a warning, not an email', () => {
  const f = checkSources([], now).find((x) => x.key === 'source:sdn');
  assert.equal(f?.severity, 'warning');
});

test('curated data: aging is a warning, stale is critical', () => {
  assert.equal(checkCurated({ sec232: '2026-09-22' }, [], '2026-11-03').length, 0);
  assert.equal(checkCurated({ sec232: '2026-09-22' }, [], '2026-11-20')[0].severity, 'warning');
  assert.equal(checkCurated({ sec232: '2026-09-22' }, [], '2027-01-05')[0].severity, 'critical');
});
test('pending notices are an action finding whose fingerprint changes with the set', () => {
  const n = (id: string) => ({ program: 'sec232', document_number: id, title: 't', publication_date: '2026-10-01', html_url: 'https://x' });
  const a = checkCurated({}, [n('1')], '2026-11-03')[0];
  const b = checkCurated({}, [n('1'), n('2')], '2026-11-03')[0];
  assert.equal(a.severity, 'action');
  assert.notEqual(a.fingerprint, b.fingerprint);
  assert.equal(checkCurated({}, [n('2'), n('1')], '2026-11-03')[0].fingerprint, b.fingerprint); // order does not matter
});

test('model problems become critical findings only while failing', () => {
  const states = [
    { key: 'model_credit', status: 'failing', detail: 'credit balance is too low', last_seen_at: daysAgo(0) },
    { key: 'model_auth', status: 'ok', detail: null, last_seen_at: daysAgo(3) },
  ];
  const f = checkModel(states);
  assert.equal(f.length, 1);
  assert.equal(f[0].key, 'model_credit');
  assert.match(f[0].detail, /out of credit/);
});
test('canary failures are one critical finding listing each', () => {
  assert.equal(checkCanaries([{ name: 'a', ok: true, detail: 'ok' }]).length, 0);
  const f = checkCanaries([{ name: 'a', ok: false, detail: 'x' }, { name: 'b', ok: false, detail: 'y' }]);
  assert.equal(f.length, 1);
  assert.match(f[0].detail, /- a: x[\s\S]*- b: y/);
});

const crit: Finding = { key: 'source:sdn', severity: 'critical', title: 't', detail: 'd' };
const state = (over: Partial<AlertState>): AlertState => ({ key: 'source:sdn', status: 'failing', detail: null, last_sent_at: daysAgo(0), recovery_due: 1, ...over });

test('a new critical problem is mailed once, then again only after a day', () => {
  assert.equal(planMail([crit], new Map(), now).send.length, 1);
  assert.equal(planMail([crit], new Map([['source:sdn', state({ last_sent_at: daysAgo(0.5) })]]), now).send.length, 0);
  assert.equal(planMail([crit], new Map([['source:sdn', state({ last_sent_at: daysAgo(1.1) })]]), now).send.length, 1);
});
test('a problem that came back after clearing is mailed again', () => {
  assert.equal(planMail([crit], new Map([['source:sdn', state({ status: 'ok', recovery_due: 0 })]]), now).send.length, 1);
});
test('an action finding is mailed again only when its fingerprint changes', () => {
  const act = (fp: string): Finding => ({ key: 'pending_notices', severity: 'action', title: 't', detail: 'd', fingerprint: fp });
  const st = (fp: string) => new Map([['pending_notices', state({ key: 'pending_notices', detail: fp, last_sent_at: daysAgo(10) })]]);
  assert.equal(planMail([act('a')], st('a'), now).send.length, 0);
  assert.equal(planMail([act('a,b')], st('a'), now).send.length, 1);
});
test('warnings are never mailed', () => {
  assert.equal(planMail([{ key: 'w', severity: 'warning', title: 't', detail: 'd' }], new Map(), now).send.length, 0);
});
test('a mailed problem that has cleared produces one recovery', () => {
  assert.deepEqual(planMail([], new Map([['source:sdn', state({})]]), now).recovered, ['source:sdn']);
  assert.deepEqual(planMail([], new Map([['source:sdn', state({ recovery_due: 0 })]]), now).recovered, []);
  assert.deepEqual(planMail([crit], new Map([['source:sdn', state({})]]), now).recovered, []);
});

test('the raw message has the headers a mail server needs and no header injection', () => {
  const raw = buildRawMessage('alerts@aexmeridian.com', 'CEO@aexmeridian.com', 'Subject line\r\nBcc: evil@example.com', 'Body text', now);
  assert.match(raw, /^From: Aex Terminal <alerts@aexmeridian\.com>\r\n/);
  assert.match(raw, /\r\nTo: CEO@aexmeridian\.com\r\n/);
  assert.match(raw, /\r\nMessage-ID: <[^>]+@aexmeridian\.com>\r\n/);
  assert.ok(!/\r\nBcc:/.test(raw));
  assert.match(raw, /\r\n\r\nBody text$/);
});

test('without the email binding a message is skipped (logged), never thrown', async () => {
  const { sendMail } = await import('../src/lib/notify.js');
  const result = await sendMail({} as never, 'subject', 'body');
  assert.equal(result, 'skipped');
});

test('calendar: the October fee change shows up inside the window and not outside it', () => {
  assert.ok(upcomingChores('2027-09-20', 45).some((c) => c.due === '2027-10-01'));
  assert.ok(!upcomingChores('2027-03-01', 45).some((c) => c.due === '2027-10-01'));
});
test('calendar: the end of the fee schedule is announced before it arrives', () => {
  assert.ok(upcomingChores('2027-09-01', 45).some((c) => c.due === '2027-09-30' && /ends on 2027-09-30/.test(c.text)));
});
test('calendar: configured reminders are parsed and bad entries ignored', () => {
  const r = parseReminderDates('anthropic key:2027-01-15, cloudflare token:2027-03-01, junk, bad:2027-13');
  assert.deepEqual(r.map((x) => x.due), ['2027-01-15', '2027-03-01']);
  assert.ok(upcomingChores('2027-01-01', 30, r).some((c) => /anthropic key is due/.test(c.text)));
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
