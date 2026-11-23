// Census trade-by-partner and foreign-born parsers, the effective-rate math, the key-gated skip, and the Global Trade Alert loader with a
// saved response. Saved fixtures in tests/fixtures; no network, no database. Run: npm run test:unit
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  acsCountryVariables, aggregatePartners, effectiveRatePct, monthRange, nameToIso2, parseAcsRows, planMonths, refreshAcsForeignBorn, refreshCensusTrade,
  tradeStatements, trailingStats, trailingWindow, NEEDS_KEY, type TradePoint,
} from '../src/lib/pulse/census.js';
import { GTA_NEEDS_KEY, GTA_ISO3, gtaKey, parseGtaRecords, refreshGlobalTradeAlert } from '../src/lib/pulse/globalTradeAlert.js';
import type { Env } from '../src/types/env.js';

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
const fixture = (f: string) => JSON.parse(readFileSync(`tests/fixtures/${f}`, 'utf8'));

// A database that records what is written and answers the few reads these jobs make.
function fakeEnv(extra: Partial<Env> = {}, existing: { ym: string; i: number; e: number }[] = []) {
  const written: string[] = [];
  const stmt = (sql: string) => {
    const s = {
      bind: () => s,
      all: async () => ({ results: existing }),
      first: async () => null,
      run: async () => ({ meta: { changes: 1 } }),
      sql,
    };
    return s;
  };
  const env = {
    DB: {
      prepare: (sql: string) => stmt(sql),
      batch: async (list: { sql: string }[]) => {
        written.push(...list.map((x) => x.sql));
        return [];
      },
    },
    ...extra,
  } as unknown as Env;
  return { env, written };
}

await test('effective rate is duties over imports, in percent, and null with no imports', () => {
  assert.equal(effectiveRatePct(200, 1000), 20);
  assert.equal(effectiveRatePct(1, 3), 33.33);
  assert.equal(effectiveRatePct(5, 0), null);
  assert.equal(effectiveRatePct(null, 100), null);
});

await test('import rows are summed per partner; groupings, regions and the all-countries row are dropped', () => {
  const m = aggregatePartners(fixture('census-imports-2025-06.json'), 'CON_VAL_MO', 'CAL_DUT_MO');
  assert.deepEqual([...m.keys()].sort(), ['2010', '5700', '5800', '5830']);
  assert.equal(m.get('5700')!.value, 4_000_000);
  assert.equal(m.get('5700')!.duties, 600_000);
  assert.equal(effectiveRatePct(m.get('5700')!.duties, m.get('5700')!.value), 15);
  assert.equal(effectiveRatePct(m.get('2010')!.duties, m.get('2010')!.value), 1);
});

await test('export rows are summed per partner', () => {
  const m = aggregatePartners(fixture('census-exports-2025-06.json'), 'ALL_VAL_MO');
  assert.equal(m.get('5700')!.value, 1_000_000);
  assert.equal(m.get('2010')!.value, 8_000_000);
});

await test('a response without the expected column fails loudly', () => {
  assert.throws(() => aggregatePartners([['CTY_CODE', 'CTY_NAME', 'OTHER'], ['5700', 'CHINA', '1']], 'CON_VAL_MO', 'CAL_DUT_MO'), /lacks an expected column/);
  assert.equal(aggregatePartners([], 'CON_VAL_MO').size, 0);
});

await test('Census country names map to two-letter codes', () => {
  assert.equal(nameToIso2('CHINA'), 'CN');
  assert.equal(nameToIso2('KOREA, SOUTH'), 'KR');
  assert.equal(nameToIso2('HONG KONG'), 'HK');
  assert.equal(nameToIso2('SINGAPORE'), 'SG');
  assert.equal(nameToIso2('MEXICO'), 'MX');
  assert.equal(nameToIso2('NOWHERE LAND'), null);
});

await test('one upsert per month writes only changed rows and adds an all-partners total', () => {
  const partners = aggregatePartners(fixture('census-imports-2025-06.json'), 'CON_VAL_MO', 'CAL_DUT_MO');
  const sql = tradeStatements({ ym: '2025-06', kind: 'imports', partners }).join('\n');
  assert.match(sql, /'ALL', 'All partners', NULL, 16000500, 720000, NULL/);
  assert.match(sql, /WHERE census_trade\.imports IS NOT excluded\.imports OR census_trade\.duties IS NOT excluded\.duties/);
  const ex = tradeStatements({ ym: '2025-06', kind: 'exports', partners: aggregatePartners(fixture('census-exports-2025-06.json'), 'ALL_VAL_MO') }).join('\n');
  assert.match(ex, /SET exports = excluded\.exports WHERE census_trade\.exports IS NOT excluded\.exports/);
  assert.ok(!/SET imports/.test(ex), 'the exports upsert must not touch imports');
});

await test('months to fetch: the newest stored month again, then missing months newest first, within the budget', () => {
  assert.deepEqual(monthRange('2018-11', '2019-02'), ['2018-11', '2018-12', '2019-01', '2019-02']);
  const today = new Date('2026-11-22T05:30:00Z');
  const none = planMonths(new Set(), null, today, 3);
  assert.deepEqual(none, ['2026-10', '2026-09', '2026-08']);
  const stored = new Set(monthRange('2018-01', '2026-08'));
  assert.deepEqual(planMonths(stored, '2026-08', today, 5), ['2026-08', '2026-10', '2026-09']);
  assert.deepEqual(planMonths(new Set(monthRange('2018-01', '2026-10')), '2026-10', today, 5), ['2026-10']);
});

await test('twelve-month window, balance and share of U.S. imports', () => {
  const months = monthRange('2024-01', '2025-06');
  const all: TradePoint[] = months.map((ym) => ({ ym, imports: 1000, duties: 100, exports: 600 }));
  const china = months.map((ym) => ({ ym, imports: 250, duties: 50, exports: 50 }));
  // The newest month has imports but exports are not published yet: the window ends at the last month with both.
  all.push({ ym: '2025-07', imports: 1000, duties: 100, exports: null });
  const w = trailingWindow(all)!;
  assert.equal(w.asOf, '2025-06');
  assert.equal(w.months.length, 12);
  const s = trailingStats(w, all, china);
  assert.equal(s.imports, 3000);
  assert.equal(s.exports, 600);
  assert.equal(s.balance, -2400);
  assert.equal(s.shareOfUsImportsPct, 25);
  assert.equal(s.effectiveRatePct, 20);
  assert.equal(trailingStats(w, all, all, true).shareOfUsImportsPct, null);
});

await test('with no CENSUS_API_KEY the jobs skip with a clear status and touch nothing', async () => {
  const { env, written } = fakeEnv();
  const a = await refreshCensusTrade(env);
  const b = await refreshAcsForeignBorn(env);
  assert.equal(a.skipped, NEEDS_KEY);
  assert.equal(b.skipped, NEEDS_KEY);
  assert.match(NEEDS_KEY, /needs CENSUS_API_KEY/);
  assert.equal(a.rows + b.rows, 0);
  assert.equal(written.length, 0);
});

await test('with a key the trade job fetches, aggregates and writes one batch; an unpublished month is skipped', async () => {
  const { env, written } = fakeEnv({ CENSUS_API_KEY: 'test-key' });
  const urls: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    urls.push(String(url));
    if (!String(url).includes('time=2026-10')) return new Response(null, { status: 204 }); // newer months: nothing published yet
    return new Response(JSON.stringify(String(url).includes('/imports/') ? fixture('census-imports-2025-06.json') : fixture('census-exports-2025-06.json')), { status: 200 });
  }) as typeof fetch;
  try {
    const r = await refreshCensusTrade(env, new Date('2026-11-22T05:30:00Z'));
    assert.equal(r.source, 'census_trade');
    assert.equal(r.rows, 2, 'one month of imports and one of exports');
    assert.ok(urls.length <= 40, `${urls.length} requests exceed the budget`);
    assert.ok(urls.every((u) => u.includes('key=test-key') && u.startsWith('https://api.census.gov/data/timeseries/intltrade/')));
    assert.ok(urls[0].includes('CTY_CODE,CTY_NAME,CON_VAL_MO,CAL_DUT_MO'));
    assert.ok(written.some((s) => s.includes('INSERT INTO census_trade')));
  } finally {
    globalThis.fetch = realFetch;
  }
});

await test('foreign-born: only single countries of birth are kept, and the table parses by state', () => {
  const vars = acsCountryVariables(fixture('acs-b05006-group-2025.json'));
  const codes = vars.map((v) => v.iso2).sort();
  assert.ok(['CN', 'GB', 'MX', 'PH', 'IN', 'VN', 'RU', 'KR', 'DE', 'CA', 'HK', 'TW'].every((c) => codes.includes(c)), codes.join(','));
  assert.ok(!vars.some((v) => v.id === 'B05006_001E' || v.id === 'B05006_002E'), 'totals and continents are not countries');
  assert.equal(vars.filter((v) => v.iso2 === 'GB').length, 1, 'England and Scotland sub-rows do not count twice');
  assert.equal(vars.find((v) => v.iso2 === 'CN')!.id, 'B05006_050E', 'China means the PRC row, without Hong Kong and Taiwan');
  const rows = parseAcsRows(fixture('acs-b05006-state-2025.json'), vars);
  assert.equal(rows.find((r) => r.geo === 'California' && r.iso2 === 'PH')!.estimate, 900_000);
  assert.equal(rows.find((r) => r.geo === 'Texas' && r.iso2 === 'MX')!.estimate, 2_700_000);
  assert.ok(!rows.some((r) => r.geo === 'Puerto Rico'));
});

// --- Global Trade Alert ---
await test('GTA key may be set under either name', () => {
  assert.equal(gtaKey({}), undefined);
  assert.equal(gtaKey({ GTA_API_KEY: 'a' }), 'a');
  assert.equal(gtaKey({ GLOBAL_TRADE_ALERT_API_KEY: 'b' }), 'b');
  assert.equal(gtaKey({ GTA_API_KEY: ' ', GLOBAL_TRADE_ALERT_API_KEY: 'b' }), 'b');
});

await test('GTA records parse: ids required, duplicates merged, required text never null', () => {
  const rows = parseGtaRecords(fixture('gta-response.json'));
  assert.equal(rows.length, 2);
  const china = rows.find((r) => r.intervention_id === 138295)!;
  assert.deepEqual(china.implementing_jurisdictions.map((j) => j.iso), ['CHN', 'HKG']);
  const korea = rows.find((r) => r.intervention_id === 138296)!;
  assert.equal(korea.intervention_url, 'https://www.globaltradealert.org/intervention/138296');
  assert.equal(korea.state_act_url, '');
  assert.equal(korea.is_in_force, 0);
  assert.equal(GTA_ISO3.KR, 'KOR', 'the country page matches on the three-letter code, not "South Korea"');
  assert.throws(() => parseGtaRecords({ detail: 'nope' }), /something other than a list/);
  assert.equal(parseGtaRecords({ results: fixture('gta-response.json') }).length, 2);
});

await test('GTA without a key skips with a clear status and makes no request', async () => {
  const { env, written } = fakeEnv();
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error('must not fetch');
  }) as typeof fetch;
  try {
    const r = await refreshGlobalTradeAlert(env);
    assert.equal(r.skipped, GTA_NEEDS_KEY);
    assert.match(GTA_NEEDS_KEY, /needs GTA_API_KEY/);
    assert.equal(written.length, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

await test('GTA with a key posts the documented request and loads the table', async () => {
  const { env, written } = fakeEnv({ GTA_API_KEY: 'gta-test' });
  let seen: { url: string; init: RequestInit } | null = null;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    seen = { url: String(url), init };
    return new Response(JSON.stringify(fixture('gta-response.json')), { status: 200 });
  }) as typeof fetch;
  try {
    const r = await refreshGlobalTradeAlert(env);
    assert.equal(r.rows, 2);
    assert.equal(seen!.url, 'https://api.globaltradealert.org/api/v1/data/');
    assert.equal((seen!.init.headers as Record<string, string>).Authorization, 'APIKey gta-test');
    const body = JSON.parse(String(seen!.init.body));
    assert.deepEqual(body.request_data.affected, [840]);
    assert.ok(body.request_data.implementer.includes(156));
    assert.equal(body.request_data.announcement_period[1], null);
    const sql = written.join('\n');
    assert.match(sql, /DELETE FROM gta_interventions/);
    assert.match(sql, /INSERT INTO gta_interventions/);
    assert.match(sql, /\(138295, 'China: Additional import tariffs/);
    assert.match(sql, /"iso":"KOR"/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

if (failures) {
  console.error(`\n${failures} FAIL`);
  process.exit(1);
}
