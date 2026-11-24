import { useEffect, useState } from 'react';
import { getDataStatus, type DataStatus } from '../../lib/api';
import { shortDate } from './Panel';

// "Everything this site tracks": every data source with when it last updated, and what is not loaded yet, so nothing is hidden.

const SOURCES: Record<string, { name: string; daily: boolean }> = {
  pulse: { name: 'U.S. trade notices (Federal Register)', daily: true },
  pulse_news: { name: 'News headlines', daily: true },
  pulse_fx: { name: 'Exchange rates (European Central Bank)', daily: true },
  pulse_macro: { name: 'U.S. prices and jobs (Bureau of Labor Statistics)', daily: true },
  pulse_commodities: { name: 'Oil, metals and food prices (IMF)', daily: true },
  pulse_cofer: { name: "The dollar's share of world reserves (IMF)", daily: true },
  pulse_treasury: { name: 'Treasury interest rates and debt holders', daily: true },
  pulse_quotes: { name: 'Market quotes', daily: true },
  pulse_fred: { name: 'Federal Reserve economic data', daily: true },
  sdn: { name: 'OFAC sanctions list', daily: true },
  csl: { name: 'Consolidated Screening List (Commerce, State, Treasury)', daily: true },
  un_sanctions: { name: 'UN sanctions list', daily: true },
  uk_sanctions: { name: 'UK sanctions list', daily: true },
  hts: { name: 'U.S. tariff schedule (HTS)', daily: false },
  schedule_b: { name: 'Export product codes (Schedule B)', daily: false },
  wro_findings: { name: 'Forced-labor import orders (Customs)', daily: false },
  power_indicators: { name: 'Country indicators (World Bank)', daily: false },
  world_bank: { name: 'World Bank country data', daily: false },
  un_voting: { name: 'UN General Assembly votes', daily: false },
  uis_students: { name: 'International students (UNESCO)', daily: false },
  unhcr: { name: 'Refugees (UNHCR)', daily: false },
  fts: { name: 'Humanitarian funding (UN OCHA)', daily: false },
  nobel: { name: 'Nobel Prizes', daily: false },
  undp_hdr: { name: 'Human development (UNDP)', daily: false },
  openalex: { name: 'Research output (OpenAlex)', daily: false },
};
const NOT_YET = [
  'Conflict and war data (no free source that allows automated access has been added)',
  'Disease outbreaks (no working public feed has been added)',
  'Shipping and supply-chain pressure (in progress)',
  'Antidumping and countervailing duty orders (in progress)',
  'U.S. imports, duties collected and the effective tariff rate, and people born abroad (Census), until the free Census key is set',
  'Trade actions by other countries (Global Trade Alert), until its free key is set',
];

export function Directory() {
  const [data, setData] = useState<DataStatus | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let off = false;
    getDataStatus().then((d) => !off && setData(d)).catch(() => !off && setFailed(true));
    return () => {
      off = true;
    };
  }, []);

  const rows = Object.entries(SOURCES).map(([key, meta]) => {
    const s = data?.sources.find((x) => x.source === key);
    const age = s?.lastSuccess ? (Date.now() - Date.parse(s.lastSuccess)) / 86_400_000 : null;
    const stale = age != null && age > (meta.daily ? 4 : 12);
    return { key, name: meta.name, last: s?.lastSuccess ?? null, status: !s ? 'Not reported' : age == null ? 'Not loaded yet' : stale ? 'Out of date' : 'Current' };
  });

  return (
    <details className="card mt-8 p-4">
      <summary className="cursor-pointer font-display text-lg font-bold text-ink">Everything this site tracks</summary>
      <p className="mt-2 text-[13px] text-ink-muted">Every data source, when it last updated, and what is missing. "Out of date" means the latest refresh is older than expected.</p>
      {failed && <p className="mt-2 text-sm text-ink-muted">The source list could not be loaded.</p>}
      {data && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <caption className="sr-only">Data sources and their last update</caption>
            <thead className="text-xs text-ink-faint">
              <tr>
                <th scope="col" className="py-1 pr-3 font-semibold">Source</th>
                <th scope="col" className="py-1 pr-3 font-semibold">Last updated</th>
                <th scope="col" className="py-1 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-hairline">
                  <th scope="row" className="py-1.5 pr-3 font-normal text-ink">{r.name}</th>
                  <td className="py-1.5 pr-3 tabular-nums text-ink-muted">{r.last ? shortDate(r.last) : '—'}</td>
                  <td className={`py-1.5 ${r.status === 'Current' ? 'text-ink-muted' : 'font-semibold text-ink'}`}>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 className="mt-4 text-sm font-bold text-ink">Not loaded yet</h3>
          <ul className="mt-1 list-disc pl-5 text-[13px] text-ink-muted">
            {NOT_YET.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </details>
  );
}
