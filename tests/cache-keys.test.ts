// Cache keys must collapse junk, reordered and out-of-range parameters into one entry per real request, because every miss
// reads thousands of database rows. No network, no database. Run: npm run test:unit

import assert from 'node:assert/strict';
import { countryCacheKey, MAX_OFFSET, pulseCacheKey } from '../src/lib/pulse/cacheKeys.js';
import { isKnownCountryName, isNameOfCountry, KNOWN_COUNTRY_CODES } from '../src/lib/pulse/country.js';

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
const key = (endpoint: string, path: string) => pulseCacheKey(endpoint)(new URL(`https://t.example/api/pulse/${path}`));

test('junk parameters do not make new keys', () => {
  assert.equal(key('home', 'home?x=1'), key('home', 'home?x=2'));
  assert.equal(key('home', 'home?x=1'), 'https://t.example/api/pulse/home');
  assert.equal(key('summary', 'summary?junk=a&junk=b'), 'https://t.example/api/pulse/summary');
});

test('sanctions: only a real country name is part of the key, and paging is clamped', () => {
  assert.equal(key('sanctions', 'sanctions?country=zz1'), key('sanctions', 'sanctions?country=qq2'));
  assert.equal(key('sanctions', 'sanctions?country=Russia'), key('sanctions', 'sanctions?country=russia'));
  assert.notEqual(key('sanctions', 'sanctions?country=Russia'), key('sanctions', 'sanctions'));
  assert.equal(key('sanctions', 'sanctions?offset=999999999'), key('sanctions', `sanctions?offset=${MAX_OFFSET}`));
  assert.equal(key('sanctions', 'sanctions?limit=5000'), key('sanctions', 'sanctions?limit=200'));
  assert.equal(key('sanctions', 'sanctions?list=csl&limit=20'), key('sanctions', 'sanctions?limit=20&list=csl&zzz=1'));
  assert.equal(key('sanctions', 'sanctions?list=bogus'), key('sanctions', 'sanctions'));
});

test('country pages: the name counts only when it is that country\'s', () => {
  const k = (path: string) => countryCacheKey(new URL(`https://t.example/api/pulse/country/${path}`));
  assert.equal(k('CN?name=zzzz'), k('CN'));
  assert.equal(k('cn'), k('CN'));
  assert.notEqual(k('CN?name=China'), k('CN'));
  assert.equal(k('CN?name=China'), k('CN?name=china'));
  assert.equal(k('CN?name=Mexico'), k('CN'));
});

test('connections: codes validated, junk dropped, days clamped', () => {
  assert.equal(key('connections', 'connections?country=cn&x=1'), key('connections', 'connections?country=CN'));
  assert.equal(key('connections', 'connections?country=QQ'), key('connections', 'connections'));
  assert.equal(key('connections', 'connections?country=CN&days=9999'), key('connections', 'connections?country=CN&days=180'));
  assert.equal(key('connections', 'connections?countries=CN,IN&country=MX'), key('connections', 'connections?countries=cn,in'));
  assert.equal(key('connections', 'connections?country=CN&topic=nonsense'), key('connections', 'connections?country=CN'));
});

test('known country names and codes', () => {
  assert.ok(KNOWN_COUNTRY_CODES.has('CN') && KNOWN_COUNTRY_CODES.has('US') && KNOWN_COUNTRY_CODES.has('GE'));
  assert.ok(!KNOWN_COUNTRY_CODES.has('QQ') && !KNOWN_COUNTRY_CODES.has('XX'));
  assert.ok(isKnownCountryName('China') && isKnownCountryName('Georgia') && !isKnownCountryName('zz1') && !isKnownCountryName(''));
  assert.ok(isNameOfCountry('CN', 'China') && !isNameOfCountry('CN', 'Mexico') && isNameOfCountry('JO', 'Jordan'));
});

if (failures) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
