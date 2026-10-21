import { useState } from 'react';
import type { AfroOpinion } from '../lib/api';
import { nameFor as sharedName, SERIES_COLORS } from '../lib/powerCountries';
import { ChartFooter } from './ChartFooter';

const US_COLOR = 'var(--color-hue-blue-ink)';
const CN_COLOR = 'var(--color-hue-orange-ink)';

// Small island states the globe does not draw, so the shared name list lacks them.
const EXTRA_NAMES: Record<string, string> = { CV: 'Cabo Verde', KM: 'Comoros', MU: 'Mauritius', SC: 'Seychelles', ST: 'São Tomé and Príncipe' };
const nameFor = (cc: string) => EXTRA_NAMES[cc] ?? sharedName(cc);

const month = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

// How adults in 38 African countries rate the influence of China and of the United States on their own country. A different
// question from favorability (influence on the country, not opinion of the nation), so it sits in its own panel and is never
// merged with the Pew readings.
export function AfricaPanel({ data, codes, showTable }: { data: AfroOpinion; codes: string[]; showTable: boolean }) {
  const [sortBy, setSortBy] = useState<'gap' | 'name'>('gap');
  const [hover, setHover] = useState<string | null>(null);
  const rows = Object.entries(data.countries).map(([cc, v]) => ({ cc, ...v }));
  if (rows.length === 0) return null;
  rows.sort((a, b) => (sortBy === 'name' ? nameFor(a.cc).localeCompare(nameFor(b.cc)) : b.us.pos - b.cn.pos - (a.us.pos - a.cn.pos) || nameFor(a.cc).localeCompare(nameFor(b.cc))));
  const hoverRow = hover ? rows.find((r) => r.cc === hover) : undefined;
  const mine = codes.filter((c) => data.countries[c]);
  const first = rows.reduce((m, r) => (r.from < m ? r.from : m), rows[0].from);
  const last = rows.reduce((m, r) => (r.to > m ? r.to : m), rows[0].to);

  return (
    <div className="card min-w-0 px-4 pb-4 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-ink">Africa: is the influence of China and of the United States positive?</h3>
        <label className="flex items-center gap-1.5 text-xs text-ink-muted">
          Sort by
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'gap' | 'name')} className="border border-hairline-strong bg-paper-raised px-1.5 py-0.5 text-xs">
            <option value="gap">Gap: U.S. ahead first</option>
            <option value="name">Country name</option>
          </select>
        </label>
      </div>
      <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-ink-muted">
        Share of adults who say each power's influence on their own country is somewhat or very positive. Afrobarometer asked in {rows.length} African countries between {month(first)} and {month(last)}; the
        typical country was {data.medianPositive.cn}% positive on China and {data.medianPositive.us}% on the United States. This asks about influence on the country, not whether people like the nation,
        so it is a different question from the Pew results above and the two should not be compared.
      </p>

      {mine.length > 0 && (
        <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
          {mine.map((cc) => {
            const v = data.countries[cc];
            return (
              <li key={cc} className="min-w-0 text-[13px]">
                <p className="flex items-center gap-1.5 text-ink-muted">
                  <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SERIES_COLORS[codes.indexOf(cc)] }} />
                  <span className="truncate">{nameFor(cc)}</span>
                </p>
                <p className="font-semibold tabular-nums text-ink">
                  China {v.cn.pos}% · U.S. {v.us.pos}%
                </p>
                <p className="text-xs text-ink-faint">
                  Negative: China {v.cn.neg}%, U.S. {v.us.neg}%
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3 w-3 rounded-full" style={{ background: US_COLOR }} /> United States
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3 w-3 rounded-full" style={{ background: CN_COLOR }} /> China
        </span>
      </div>

      <p className="mt-3 min-h-[1.5rem] text-[13px] text-ink-muted" aria-hidden="true">
        {hoverRow ? (
          <>
            <span className="font-semibold text-ink">{nameFor(hoverRow.cc)}:</span> U.S. influence positive {hoverRow.us.pos}%, China {hoverRow.cn.pos}%.{' '}
            {hoverRow.us.pos === hoverRow.cn.pos ? 'Even.' : `${hoverRow.us.pos > hoverRow.cn.pos ? 'U.S.' : 'China'} ahead by ${Math.abs(hoverRow.us.pos - hoverRow.cn.pos)} points.`}
          </>
        ) : (
          'Move over a row to read its numbers.'
        )}
      </p>
      <div aria-hidden="true" className="mt-1">
        <div className="relative ml-[9.5rem] h-4 text-[11px] text-ink-faint sm:ml-[11rem]">
          {[0, 25, 50, 75, 100].map((t) => (
            <span key={t} className="absolute -translate-x-1/2" style={{ left: `${t}%` }}>
              {t}%
            </span>
          ))}
        </div>
        {rows.map((r) => {
          const lo = Math.min(r.us.pos, r.cn.pos);
          const hi = Math.max(r.us.pos, r.cn.pos);
          return (
            <div
              key={r.cc}
              onMouseEnter={() => setHover(r.cc)}
              onMouseLeave={() => setHover(null)}
              className={`flex h-[28px] items-center ${codes.includes(r.cc) ? 'bg-accent-soft font-semibold' : hover === r.cc ? 'bg-hairline/50' : ''}`}
            >
              <span className="w-[9.5rem] shrink-0 truncate pr-3 text-right text-[13px] text-ink sm:w-[11rem]">{nameFor(r.cc)}</span>
              <span className="relative h-full flex-1">
                {[0, 25, 50, 75, 100].map((t) => (
                  <span key={t} className="absolute top-0 h-full w-px bg-hairline" style={{ left: `${t}%` }} />
                ))}
                <span className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-hairline-strong" style={{ left: `${lo}%`, width: `${hi - lo}%` }} />
                <span
                  title={`${nameFor(r.cc)}: ${r.us.pos}% say U.S. influence is positive`}
                  className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper-raised"
                  style={{ left: `${r.us.pos}%`, background: US_COLOR }}
                />
                <span
                  title={`${nameFor(r.cc)}: ${r.cn.pos}% say China's influence is positive`}
                  className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper-raised"
                  style={{ left: `${r.cn.pos}%`, background: CN_COLOR }}
                />
              </span>
            </div>
          );
        })}
      </div>

      <div className={showTable ? 'mt-4 overflow-x-auto' : 'sr-only'}>
        <table className="w-full min-w-[28rem] text-left text-[13px]">
          <caption className="sr-only">Positive and negative views of Chinese and U.S. influence, by African country</caption>
          <thead>
            <tr className="border-b border-hairline text-xs text-ink-faint">
              <th scope="col" className="py-1 pr-3 font-semibold">Country</th>
              <th scope="col" className="py-1 pr-3 font-semibold">China positive</th>
              <th scope="col" className="py-1 pr-3 font-semibold">China negative</th>
              <th scope="col" className="py-1 pr-3 font-semibold">U.S. positive</th>
              <th scope="col" className="py-1 pr-3 font-semibold">U.S. negative</th>
              <th scope="col" className="py-1 pr-3 font-semibold">Interviewed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.cc} className="border-b border-hairline/60">
                <th scope="row" className="py-1 pr-3 font-normal text-ink-muted">{nameFor(r.cc)}</th>
                <td className="py-1 pr-3 tabular-nums">{r.cn.pos}%</td>
                <td className="py-1 pr-3 tabular-nums">{r.cn.neg}%</td>
                <td className="py-1 pr-3 tabular-nums">{r.us.pos}%</td>
                <td className="py-1 pr-3 tabular-nums">{r.us.neg}%</td>
                <td className="py-1 pr-3 tabular-nums">
                  {month(r.from)}
                  {r.from.slice(0, 7) === r.to.slice(0, 7) ? '' : ` to ${month(r.to)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 border-t border-hairline pt-3 text-xs leading-relaxed text-ink-faint">
        Each share is weighted to the country's adult population and counts everyone who gave an answer, including "don't know". About 1,200 adults were interviewed in most countries, so a share can
        differ from the true figure by roughly three points. Only 38 African countries are covered, and the answers are views of influence, not proof of it. Question: {data.question}
      </p>
      <ChartFooter
        source={data.name}
        sourceUrl={data.url}
        asOf={`${month(first)} to ${month(last)}`}
        csv={{
          filename: 'aex-terminal-africa-influence-views.csv',
          header: ['Country', 'China positive (%)', 'China negative (%)', 'U.S. positive (%)', 'U.S. negative (%)', 'Interviews from', 'Interviews to'],
          rows: rows.map((r) => [nameFor(r.cc), r.cn.pos, r.cn.neg, r.us.pos, r.us.neg, r.from, r.to]),
        }}
      />
      <details className="mt-2 text-xs text-ink-faint">
        <summary className="cursor-pointer font-semibold hover:text-ink">How to cite these figures</summary>
        <p className="mt-1.5">{data.citation}</p>
      </details>
    </div>
  );
}
