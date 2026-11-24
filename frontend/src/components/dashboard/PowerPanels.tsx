import type { PowerDashData } from '../../lib/api';
import { COUNTRY_LABELS } from '../../lib/pulseCountries';
import { Bars, Panel, shortDate } from './Panel';

// "Trade and tariffs" and "Power and security": what the U.S. is doing at the border, who spends what on defense, who is sanctioned,
// and how the U.S. and China compare. Plain words, with the source and date on every panel.

export const TRADE_PANELS = [
  { id: 'notices', label: 'New trade notices' },
  { id: 'tariffs', label: 'Tariffs by country' },
  { id: 'csms', label: 'Customs notices to importers' },
  { id: 'measures', label: 'Tariff programs in force' },
];
export const POWER_PANELS = [
  { id: 'military', label: 'Military spending' },
  { id: 'nato', label: 'NATO spending' },
  { id: 'sanctions', label: 'Sanctions' },
  { id: 'forcedlabor', label: 'Forced-labor import bans' },
  { id: 'opinion', label: 'What people think of the U.S. and China' },
  { id: 'uschina', label: 'U.S. and China side by side' },
];

const NAME_FIX: Record<string, string> = { US: 'United States', HK: 'Hong Kong', MO: 'Macao', PS: 'Palestine' };
const name = (cc: string) => NAME_FIX[cc] ?? COUNTRY_LABELS[cc] ?? cc;
const FR = 'https://www.federalregister.gov/';

function money(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e12) return `$${(v / 1e12).toFixed(1)} trillion`;
  if (a >= 1e9) return `$${(v / 1e9).toFixed(0)} billion`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(0)} million`;
  return `$${Math.round(v).toLocaleString('en-US')}`;
}
function fmt(unit: string, v: number | null): string {
  if (v == null) return '—';
  if (unit === 'usd') return money(v);
  if (unit === 'pct') return `${v.toFixed(1)}%`;
  if (unit === 'count') return v >= 1e9 ? `${(v / 1e9).toFixed(2)} billion` : v >= 1e6 ? `${(v / 1e6).toFixed(0)} million` : Math.round(v).toLocaleString('en-US');
  return v.toLocaleString('en-US', { maximumFractionDigits: 1 });
}
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });

function Columns({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="flex h-28 items-end gap-1" role="img" aria-label={`Bar chart: ${rows.map((r) => `${r.label} ${r.value}`).join(', ')}`}>
      {rows.map((r) => (
        <div key={r.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <span className="text-[10px] tabular-nums text-ink-faint">{r.value}</span>
          <span className="w-full bg-accent" style={{ height: `${Math.max(3, (r.value / max) * 72)}px` }} aria-hidden="true" />
          <span className="text-[10px] text-ink-faint">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

export function TradeSection({ data, show }: { data: PowerDashData; show: (id: string) => boolean }) {
  const { notices, tariffs, csms, measures } = data;
  return (
    <div className="gap-4 md:columns-2 xl:columns-3">
      {notices && show('notices') && (
        <Panel
          id="notices"
          title="New U.S. trade notices"
          what="Official announcements about tariffs, trade rules and sanctions, by month."
          source="Federal Register"
          sourceUrl={FR}
          asOf={notices.months[notices.months.length - 1]?.month ?? null}
          more={{ to: '/', label: 'Read the notices' }}
          table={{ head: ['Month', 'Notices'], rows: notices.months.map((m) => [m.month, m.count]) }}
          limit="The last month shown may be incomplete."
        >
          <Columns rows={notices.months.map((m) => ({ label: monthLabel(m.month), value: m.count }))} />
          <p className="mt-2 text-[13px] text-ink-muted">
            {notices.last30} in the last 30 days{notices.trendPct != null ? `, ${notices.trendPct >= 0 ? 'up' : 'down'} ${Math.abs(notices.trendPct)}% from the 30 days before` : ''}.
            {notices.leadingTag && notices.leadingTagShare != null ? ` Most are about ${notices.leadingTag.toLowerCase()}s (${notices.leadingTagShare}%).` : ''}
          </p>
        </Panel>
      )}

      {tariffs && show('tariffs') && (
        <Panel
          id="tariffs"
          title="Tariffs by country"
          what="The extra tariff the U.S. announced in July 2026 on goods from 60 economies, grouped by rate."
          source="Federal Register notice 2026-15181"
          sourceUrl={`${FR}documents/2026/07/28/2026-15181/notice-of-actions-in-section-301-investigations-of-acts-policies-and-practices-of-various-economies`}
          asOf={null}
          more={{ to: '/hard-power', label: 'Hard Power: trade' }}
          limit="This is one action, not a country's total tariff. China's older tariffs and the steel, aluminum and car tariffs are separate (see 'Tariff programs in force')."
          table={{ head: ['Rate', 'Economies'], rows: tariffs.groups.map((g) => [`${g.ratePct}%`, g.countries.map(name).join(', ')]) }}
        >
          <ul className="flex flex-col gap-2">
            {tariffs.groups.map((g) => (
              <li key={g.ratePct}>
                <p className="flex items-baseline justify-between gap-2">
                  <span className="display text-2xl tabular-nums text-ink">{g.ratePct}%</span>
                  <span className="text-[13px] text-ink-muted">{g.countries.length} economies</span>
                </p>
                <p className="text-xs leading-snug text-ink-faint">
                  {g.countries.slice(0, 8).map(name).join(', ')}
                  {g.countries.length > 8 ? `, and ${g.countries.length - 8} more` : ''}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {csms && show('csms') && (
        <Panel id="csms" title="Customs notices to importers" what="Messages U.S. Customs sends to companies that bring goods in, such as how a new tariff is applied." source="U.S. Customs and Border Protection" sourceUrl="https://www.cbp.gov/trade/automated/cargo-systems-messaging-service" asOf={csms.asOf}>
          <ul className="flex flex-col gap-2.5 text-[13px] leading-snug">
            {csms.items.map((c) => (
              <li key={c.url}>
                <a href={c.url} target="_blank" rel="noreferrer" className="text-ink underline">
                  {c.title}
                </a>
                <p className="text-xs text-ink-faint">
                  {shortDate(c.published)}
                  {c.programs.length ? ` · ${c.programs.join(', ')}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {measures.length > 0 && show('measures') && (
        <Panel
          id="measures"
          title="Tariff programs in force"
          what="The main U.S. tariff programs this site tracks, how many product lines each covers and the rate range."
          source="HTS Chapter 99 and Federal Register"
          sourceUrl="https://hts.usitc.gov/"
          asOf={null}
          more={{ to: '/lookup', label: 'Look up a product' }}
          table={{ head: ['Program', 'Rate', 'Product lines', 'Since'], rows: measures.map((m) => [m.label, m.minPct === m.maxPct ? `${m.maxPct}%` : `${m.minPct}% to ${m.maxPct}%`, m.lines, m.since]) }}
        >
          <ul className="flex flex-col divide-y divide-hairline">
            {measures.map((m) => (
              <li key={m.program} className="flex items-baseline justify-between gap-3 py-1.5 text-[13px]">
                <span className="min-w-0 text-ink">{m.label}</span>
                <span className="shrink-0 text-right tabular-nums text-ink-muted">
                  <span className="font-semibold text-ink">{m.minPct === m.maxPct ? `${m.maxPct}%` : `${m.minPct}–${m.maxPct}%`}</span> · {m.lines.toLocaleString('en-US')} lines
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

export function PowerSection({ data, show }: { data: PowerDashData; show: (id: string) => boolean }) {
  const { military, nato, sanctions, forcedLabor, opinion, usChina } = data;
  const milMax = military ? Math.max(...military.top.map((t) => t.usd), 1) : 1;
  const sancMax = sanctions ? Math.max(...sanctions.top.map((t) => t.count), 1) : 1;
  const natoMax = nato ? Math.max(...nato.rows.map((r) => r.pct), 2) : 2;
  return (
    <div className="gap-4 md:columns-2 xl:columns-3">
      {military && show('military') && (
        <Panel
          id="military"
          title="Who spends the most on defense"
          what="The ten countries that spend the most on their militaries, in dollars."
          source="SIPRI, via the World Bank"
          sourceUrl="https://www.sipri.org/databases/milex"
          asOf={`${military.year}-12-31`}
          more={{ to: '/hard-power', label: 'Hard Power: military' }}
          table={{ head: ['Country', 'Dollars'], rows: military.top.map((t) => [name(t.cc), money(t.usd)]) }}
          limit="Dollars at market exchange rates; countries count spending differently."
        >
          <Bars rows={military.top.map((t) => ({ label: name(t.cc), size: t.usd / milMax, text: money(t.usd).replace(' billion', 'B').replace(' trillion', 'T') }))} />
          <p className="mt-2 text-[13px] text-ink-muted">
            The top spender accounts for {Math.round((military.top[0].usd / military.worldUsd) * 100)}% of the world total.
            {military.usPctGdp != null && military.cnPctGdp != null ? ` As a share of their economies: U.S. ${military.usPctGdp.toFixed(1)}%, China ${military.cnPctGdp.toFixed(1)}%.` : ''}
          </p>
        </Panel>
      )}

      {nato && show('nato') && (
        <Panel
          id="nato"
          title="NATO allies' defense spending"
          what="How much of each ally's economy goes to defense. NATO's goal is at least 2%."
          source="NATO"
          sourceUrl="https://www.nato.int/cps/en/natohq/topics_49198.htm"
          asOf={nato.asOf}
          more={{ to: '/hard-power', label: 'Hard Power: NATO' }}
          table={{ head: ['Ally', 'Share of economy', 'Year'], rows: nato.rows.map((r) => [name(r.cc), `${r.pct.toFixed(2)}%`, r.year]) }}
          limit={`${nato.rows.length} allies shown; the latest year differs by country.`}
        >
          <Bars rows={nato.rows.slice(0, 12).map((r) => ({ label: name(r.cc), size: r.pct / natoMax, text: `${r.pct.toFixed(1)}%` }))} />
          <p className="mt-2 text-[13px] text-ink-muted">
            {nato.metTarget} of {nato.rows.length} allies shown are at or above 2%.
          </p>
        </Panel>
      )}

      {sanctions && show('sanctions') && (
        <Panel
          id="sanctions"
          title="Sanctions"
          what="People, companies and ships that the U.S., UN and UK have limited, and the countries they are tied to."
          source="OFAC, Commerce, UN and UK lists"
          sourceUrl="/changes"
          asOf={null}
          more={{ to: '/changes', label: 'What changed' }}
          table={{ head: ['Country', 'Names on the lists'], rows: sanctions.top.map((t) => [name(t.cc), t.count]) }}
          limit="A name on a list is a legal restriction, not a finding of guilt in court. A name can be on more than one list."
        >
          <p>
            <span className="display text-3xl tabular-nums text-ink">{sanctions.total.toLocaleString('en-US')}</span>
            <span className="ml-2 text-[13px] text-ink-muted">names across four lists</span>
          </p>
          {sanctions.lists.some((l) => l.stale) && (
            <p role="status" className="mt-1 text-[13px] font-semibold text-ink">
              Some list copies are out of date: {sanctions.lists.filter((l) => l.stale).map((l) => l.label).join(', ')}.
            </p>
          )}
          <div className="mt-2">
            <Bars rows={sanctions.top.map((t) => ({ label: name(t.cc), size: t.count / sancMax, text: t.count.toLocaleString('en-US') }))} />
          </div>
        </Panel>
      )}

      {forcedLabor && show('forcedlabor') && (
        <Panel
          id="forcedlabor"
          title="Forced-labor import bans"
          what="Goods U.S. Customs has ordered held at the border because of suspected forced labor."
          source="U.S. Customs and Border Protection"
          sourceUrl="https://www.cbp.gov/trade/forced-labor/withhold-release-orders-and-findings"
          asOf={forcedLabor.recent[0]?.date ?? null}
          table={{ head: ['Date', 'Country', 'Goods', 'Company'], rows: forcedLabor.recent.map((r) => [r.date, name(r.country), r.merchandise, r.entity]) }}
        >
          <p>
            <span className="display text-3xl tabular-nums text-ink">{forcedLabor.total}</span>
            <span className="ml-2 text-[13px] text-ink-muted">orders and findings, active and past</span>
          </p>
          <ul className="mt-2 flex flex-col gap-2 text-[13px] leading-snug">
            {forcedLabor.recent.map((r, i) => (
              <li key={i} className="text-ink">
                {r.merchandise} from {name(r.country)} <span className="text-ink-faint">({shortDate(r.date)})</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {opinion && show('opinion') && (
        <Panel
          id="opinion"
          title="What people think of the U.S. and China"
          what="The share of people with a favorable view of each country, from Pew Research Center's survey."
          source="Pew Research Center"
          sourceUrl="https://www.pewresearch.org/"
          asOf={`${opinion.year}-06-01`}
          more={{ to: '/soft-power', label: 'Soft Power' }}
          limit={`The median across the ${opinion.countries} countries Pew polled in ${opinion.year}. It is not the whole world, and some countries were not asked.`}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="display text-4xl tabular-nums text-ink">{opinion.us}%</p>
              <p className="text-[13px] text-ink-muted">favorable view of the U.S.</p>
            </div>
            <div>
              <p className="display text-4xl tabular-nums text-ink">{opinion.cn}%</p>
              <p className="text-[13px] text-ink-muted">favorable view of China</p>
            </div>
          </div>
          {opinion.africa && (
            <p className="mt-2 text-[13px] text-ink-muted">
              In Africa, a typical country rates the U.S. influence positive for {opinion.africa.us}% of adults and China's for {opinion.africa.cn}%.
            </p>
          )}
        </Panel>
      )}

      {usChina.length > 0 && show('uschina') && (
        <Panel
          id="uschina"
          title="U.S. and China side by side"
          what="The two largest economies on the same measures. Rank is among all countries with data."
          source="World Bank, SIPRI"
          sourceUrl="https://data.worldbank.org/"
          asOf={null}
          more={{ to: '/us-china', label: 'The full comparison' }}
          table={{ head: ['Measure', 'U.S.', 'China'], rows: usChina.map((r) => [r.label, fmt(r.unit, r.us), fmt(r.unit, r.cn)]) }}
        >
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-xs text-ink-faint">
                <th scope="col" className="pb-1 font-semibold">
                  Measure
                </th>
                <th scope="col" className="pb-1 text-right font-semibold">
                  U.S.
                </th>
                <th scope="col" className="pb-1 text-right font-semibold">
                  China
                </th>
              </tr>
            </thead>
            <tbody>
              {usChina.map((r) => (
                <tr key={r.id} className="border-t border-hairline">
                  <th scope="row" className="py-1.5 pr-2 text-left font-normal text-ink">
                    {r.label}
                    {r.year ? <span className="block text-[11px] text-ink-faint">{r.year}</span> : null}
                  </th>
                  <td className="py-1.5 text-right tabular-nums text-ink">
                    {fmt(r.unit, r.us)}
                    {r.usRank ? <span className="block text-[11px] text-ink-faint">#{r.usRank} of {r.of}</span> : null}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-ink">
                    {fmt(r.unit, r.cn)}
                    {r.cnRank ? <span className="block text-[11px] text-ink-faint">#{r.cnRank} of {r.of}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}
