// Built-in accuracy checks that run after data changes: a few answers that must never change unless the law does. They catch the quiet failures
// a refresh cannot see for itself (an upstream format change that loads rows but breaks a rate, a name search that stops finding a listed
// party, an arithmetic change in the duty stack). No model, no network. Run daily by the health job and in CI against the seeded database.
import type { Env } from '../types/env.js';
import type { CanaryResult } from './health.js';
import { getRateBearingHtsLine, searchPartyCandidates, type HtsCandidateRow, type TariffOverlayRow } from './db.js';
import { rankCandidates } from './fuzzyMatch.js';
import { normalizeNameString } from './normalize.js';
import { buildDutyStack, parseAdValoremRate } from './dutyStack.js';
import { decideExportLicense } from './exportLicense.js';

// Rates that have been the same for decades. If one of these really changes, update the canary in the same commit as the data.
const HTS_CANARIES: { code: string; general: number }[] = [
  { code: '6109.10.00', general: 16.5 },
  { code: '0901.11.00', general: 0 },
  { code: '3004.90.92', general: 0 },
];

// Long-listed parties, one per list. If one is delisted for real, replace it here.
const PARTY_CANARIES: { name: string; list: 'SDN' | 'CSL' | 'UN' }[] = [
  { name: 'AEROCARIBBEAN AIRLINES', list: 'SDN' },
  { name: 'Huawei Technologies Co., Ltd. (Huawei)', list: 'CSL' },
  { name: 'AL-QAIDA', list: 'UN' },
];

function line(general: string, special = ''): HtsCandidateRow {
  return {
    id: 1, htsno: '0000.00.00', description: 'canary', indent: 1, superior_id: null, units: '[]', general_rate: general, special_rate: special, other_rate: '',
    footnotes: '[]', chapter: '00', revision: 'canary', source_url: 'https://example.test', source_tier: 1, last_updated: '2026-01-01', score: 0,
  };
}

function steelOverlay(): TariffOverlayRow {
  return {
    id: 1, program: 'sec232_steel', hts_pattern: '72', country_scope: null, rate_pct: 50, rate_type: 'ad_valorem', legal_basis: 'canary', effective_date: '2020-01-01',
    expiration_date: null, exclusions: null, stacking_rule: null, source_url: 'https://example.test', source_tier: 1, last_updated: '2026-01-01', data_as_of: '2026-01-01',
  };
}

/** Arithmetic and license rules that need no database: always run, and fail the build the moment someone changes the answer. */
export function runLogicCanaries(): CanaryResult[] {
  const out: CanaryResult[] = [];
  const check = (name: string, ok: boolean, detail: string) => out.push({ name, ok, detail: ok ? 'ok' : detail });

  const plain = buildDutyStack(line('16.5%', 'Free (AU,S)'), 'VN', null, []);
  check('duty: a plain 16.5% line from a non-FTA country totals 16.5%', plain.totalPct === 16.5, `got ${plain.totalPct}`);
  const usmca = buildDutyStack(line('16.5%', 'Free (AU,S)'), 'MX', true, []);
  check('duty: a USMCA-qualifying line from Mexico totals 0%', usmca.totalPct === 0, `got ${usmca.totalPct}`);
  const steel = buildDutyStack(line('Free'), 'VN', null, [steelOverlay()]);
  check('duty: Section 232 steel on a free line totals 50%', steel.totalPct === 50, `got ${steel.totalPct}`);
  check('duty: a compound rate is never read as one percentage', parseAdValoremRate('3.9% on the case + 5.3% on the battery').pct === null, 'compound rate parsed');

  const embargo = decideExportLicense({ country: 'CU', hardStop: false, coverage: { status: 'comprehensive_embargo', notes: null }, eccn: { eccn: 'EAR99', reasonsForControl: [], licenseExceptions: [] }, chartRows: [] });
  check('license: an embargoed destination is never No License Required', embargo.requirement === 'License Required', `got ${embargo.requirement}`);
  const ally = decideExportLicense({
    country: 'DE', hardStop: false, coverage: { status: 'curated', notes: null }, chartRows: [{ reason_for_control: 'NS1' }], verifiedReasons: new Set(['NS']),
    eccn: { eccn: '1C350', reasonsForControl: ['CB', 'AT'], licenseExceptions: [] },
  });
  check('license: a chemical-controlled item to an ally is not called No License Required', ally.requirement === 'Insufficient Data', `got ${ally.requirement}`);
  return out;
}

/** Checks against the loaded data. */
export async function runDataCanaries(env: Env): Promise<CanaryResult[]> {
  const out: CanaryResult[] = [];
  for (const c of HTS_CANARIES) {
    try {
      const row = await getRateBearingHtsLine(env, c.code);
      const pct = row ? parseAdValoremRate(row.general_rate ?? '').pct : null;
      out.push({ name: `HTS ${c.code} general rate is ${c.general}%`, ok: pct === c.general, detail: row ? `read "${row.general_rate}"` : 'line not found' });
    } catch (err) {
      out.push({ name: `HTS ${c.code}`, ok: false, detail: err instanceof Error ? err.message : String(err) });
    }
  }
  for (const c of PARTY_CANARIES) {
    try {
      const found = await searchPartyCandidates(env, normalizeNameString(c.name), 50);
      // The same name can be on several lists (Al-Qaida is on both the UN and the OFAC list), so look for the entry on this list specifically.
      const ranked = rankCandidates(c.name, found, { limit: 10, minScore: 0.55 });
      const top = ranked.find((r) => r.candidate.source === c.list);
      const ok = !!top && top.score.score >= 0.9;
      out.push({ name: `${c.list} list still finds "${c.name}"`, ok, detail: top ? `best ${c.list} match "${top.candidate.name}" scored ${top.score.score}` : 'no candidate on that list (was the entry delisted?)' });
    } catch (err) {
      out.push({ name: `party search for "${c.name}"`, ok: false, detail: err instanceof Error ? err.message : String(err) });
    }
  }
  return out;
}
