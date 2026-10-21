import { useEffect, useState } from 'react';
import type { OpinionResponse, OpinionSurvey } from '../lib/api';
import { nameFor, SERIES_COLORS } from '../lib/powerCountries';
import { ChartFooter } from './ChartFooter';

const US_COLOR = 'var(--color-hue-blue-ink)';
const CN_COLOR = 'var(--color-hue-orange-ink)';
// Pew's own label for the territory; the globe's country list has no entry for it.
const EXTRA_NAMES: Record<string, string> = { PS: 'West Bank / East Jerusalem' };
const label = (cc: string) => EXTRA_NAMES[cc] ?? nameFor(cc);

export function surveysFor(data: OpinionResponse, year: number) {
  return {
    us: data.surveys.find((s) => s.subject === 'US' && s.year === year),
    cn: data.surveys.find((s) => s.subject === 'CN' && s.year === year),
  };
}

function Dot({ pct, color, title }: { pct: number; color: string; title: string }) {
  return (
    <span
      title={title}
      className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper-raised transition-[left] duration-700 motion-reduce:transition-none"
      style={{ left: `${pct}%`, background: color }}
    />
  );
}

// What people in each polled country say about the United States and about China, one row per country, with both
// readings on the same 0 to 100 axis so the distance between them is the story. Only countries Pew polled appear; every
// other country has no comparable reading, and the panel says so instead of filling the gap.
export function AttitudesPanel({ data, year, onYear, codes, showTable }: { data: OpinionResponse; year: number; onYear: (y: number) => void; codes: string[]; showTable: boolean }) {
  const [sortBy, setSortBy] = useState<'gap' | 'name'>('gap');
  const [show, setShow] = useState<'all' | 'us' | 'cn'>('all');
  const [hover, setHover] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const years = [...new Set(data.surveys.map((s) => s.year))].sort((a, b) => b - a);
  const { us, cn } = surveysFor(data, year);
  const polled = new Set([...Object.keys(us?.favorable ?? {}), ...Object.keys(cn?.favorable ?? {})]);
  const rows = [...polled].map((cc) => ({ cc, us: us?.favorable[cc], cn: cn?.favorable[cc] }));
  rows.sort((a, b) => {
    if (sortBy === 'name') return label(a.cc).localeCompare(label(b.cc));
    const gap = (r: typeof a) => (r.us !== undefined && r.cn !== undefined ? r.us - r.cn : -999);
    return gap(b) - gap(a) || label(a.cc).localeCompare(label(b.cc));
  });
  // "Play" steps through the survey years oldest to newest so the dots slide; it stops on the newest year or on any click.
  useEffect(() => {
    if (!playing) return;
    const asc = [...years].reverse();
    const i = asc.indexOf(year);
    if (i >= asc.length - 1) {
      setPlaying(false);
      return;
    }
    const t = window.setTimeout(() => onYear(asc[i + 1]), 1600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, year]);
  const gapOf = (r: { us?: number; cn?: number }) => (r.us !== undefined && r.cn !== undefined ? r.us - r.cn : undefined);
  const visible = rows.filter((r) => {
    const g = gapOf(r);
    return show === 'all' || (g !== undefined && (show === 'us' ? g > 0 : g < 0));
  });
  const hoverRow = hover ? rows.find((r) => r.cc === hover) : undefined;
  const hoverGap = hoverRow ? gapOf(hoverRow) : undefined;
  const surveys = [us, cn].filter((s): s is OpinionSurvey => !!s);
  const csvRows = rows.map((r) => [label(r.cc), r.us ?? '', r.cn ?? '']);

  return (
    <div className="card min-w-0 px-4 pb-4 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-ink">Favorable views of the United States and of China</h3>
        <div className="flex items-center gap-2">
        {years.length > 1 && (
          <button
            type="button"
            onClick={() => {
              if (!playing && year === years[0]) onYear(years[years.length - 1]);
              setPlaying((p) => !p);
            }}
            aria-pressed={playing}
            className="border border-hairline-strong px-3 py-1 text-sm font-semibold text-ink-muted hover:text-ink"
          >
            {playing ? 'Pause' : 'Play years'}
          </button>
        )}
        <div role="group" aria-label="Survey year" className="inline-flex border border-hairline-strong text-sm">
          {years.map((y) => (
            <button key={y} type="button" onClick={() => {
                setPlaying(false);
                onYear(y);
              }} aria-pressed={y === year} className={`px-3 py-1 font-semibold ${y === year ? 'bg-ink text-paper' : 'text-ink-muted hover:text-ink'}`}>
              {y}
            </button>
          ))}
        </div>
        </div>
      </div>
      <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-ink-muted">
        Share of adults with a very or somewhat favorable opinion, from Pew Research Center's Spring {year} Global Attitudes Survey. {rows.length} countries were polled; every
        other country has no comparable reading.
      </p>

      <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
        {codes.map((cc, i) => (
          <li key={cc} className="min-w-0 text-[13px]">
            <p className="flex items-center gap-1.5 text-ink-muted">
              <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SERIES_COLORS[i] }} />
              <span className="truncate">{label(cc)}</span>
            </p>
            {polled.has(cc) ? (
              <p className="tabular-nums text-ink">
                <span className="font-semibold">U.S. {us?.favorable[cc] !== undefined ? `${us.favorable[cc]}%` : 'n/a'}</span>
                <span className="text-ink-faint"> · </span>
                <span className="font-semibold">China {cn?.favorable[cc] !== undefined ? `${cn.favorable[cc]}%` : 'n/a'}</span>
              </p>
            ) : (
              <p className="text-ink-faint">Not polled by Pew in {year}</p>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3 w-3 rounded-full" style={{ background: US_COLOR }} /> United States
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3 w-3 rounded-full" style={{ background: CN_COLOR }} /> China
        </span>
        <span role="group" aria-label="Which countries to show" className="ml-auto inline-flex gap-1">
          {([['all', 'All'], ['us', 'U.S. ahead'], ['cn', 'China ahead']] as const).map(([k, t]) => (
            <button key={k} type="button" aria-pressed={show === k} onClick={() => setShow(k)} className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${show === k ? 'border-ink bg-ink text-paper' : 'border-hairline-strong text-ink-muted hover:text-ink'}`}>
              {t}
            </button>
          ))}
        </span>
        <label className="flex items-center gap-1.5">
          Sort by
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'gap' | 'name')} className="border border-hairline-strong bg-paper-raised px-1.5 py-0.5 text-xs">
            <option value="gap">Gap: U.S. ahead first</option>
            <option value="name">Country name</option>
          </select>
        </label>
      </div>

      <p className="mt-3 min-h-[1.5rem] text-[13px] text-ink-muted" aria-hidden="true">
        {hoverRow ? (
          <>
            <span className="font-semibold text-ink">{label(hoverRow.cc)}:</span> U.S. {hoverRow.us ?? 'n/a'}
            {hoverRow.us !== undefined ? '%' : ''}, China {hoverRow.cn ?? 'n/a'}
            {hoverRow.cn !== undefined ? '%' : ''}
            {hoverGap !== undefined && hoverGap !== 0 ? `. ${hoverGap > 0 ? 'U.S.' : 'China'} ahead by ${Math.abs(hoverGap)} points.` : hoverGap === 0 ? '. Even.' : ''}
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
        {visible.map((r) => {
          const mine = codes.includes(r.cc);
          const lo = Math.min(r.us ?? r.cn ?? 0, r.cn ?? r.us ?? 0);
          const hi = Math.max(r.us ?? r.cn ?? 0, r.cn ?? r.us ?? 0);
          return (
            <div
              key={r.cc}
              onMouseEnter={() => setHover(r.cc)}
              onMouseLeave={() => setHover(null)}
              className={`flex h-[28px] items-center ${mine ? 'bg-accent-soft font-semibold' : hover === r.cc ? 'bg-hairline/50' : ''}`}
            >
              <span className="w-[9.5rem] shrink-0 truncate pr-3 text-right text-[13px] text-ink sm:w-[11rem]">{label(r.cc)}</span>
              <span className="relative h-full flex-1">
                {[0, 25, 50, 75, 100].map((t) => (
                  <span key={t} className="absolute top-0 h-full w-px bg-hairline" style={{ left: `${t}%` }} />
                ))}
                {r.us !== undefined && r.cn !== undefined && <span className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-hairline-strong" style={{ left: `${lo}%`, width: `${hi - lo}%` }} />}
                {r.us !== undefined && <Dot pct={r.us} color={US_COLOR} title={`${label(r.cc)}: ${r.us}% favorable toward the U.S.`} />}
                {r.cn !== undefined && <Dot pct={r.cn} color={CN_COLOR} title={`${label(r.cc)}: ${r.cn}% favorable toward China`} />}
              </span>
            </div>
          );
        })}
      </div>

      <div className={showTable ? 'mt-4 overflow-x-auto' : 'sr-only'}>
        <table className="w-full min-w-[20rem] text-left text-[13px]">
          <caption className="sr-only">Favorable views of the United States and of China, by country, {year}</caption>
          <thead>
            <tr className="border-b border-hairline text-xs text-ink-faint">
              <th scope="col" className="py-1 pr-3 font-semibold">Country</th>
              <th scope="col" className="py-1 pr-3 font-semibold">United States</th>
              <th scope="col" className="py-1 pr-3 font-semibold">China</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.cc} className="border-b border-hairline/60">
                <th scope="row" className="py-1 pr-3 font-normal text-ink-muted">{label(r.cc)}</th>
                <td className="py-1 pr-3 tabular-nums">{r.us === undefined ? 'n/a' : `${r.us}%`}</td>
                <td className="py-1 pr-3 tabular-nums">{r.cn === undefined ? 'n/a' : `${r.cn}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 border-t border-hairline pt-3 text-[13px] leading-relaxed text-ink-muted">
        <p>
          <span className="font-semibold text-ink">Pew's published medians:</span>{' '}
          {us && (
            <>
              {us.publishedMedian}% favorable toward the U.S. across {us.countriesInMedian} countries
            </>
          )}
          {us && cn && '; '}
          {cn && (
            <>
              {cn.publishedMedian}% toward China across {cn.countriesInMedian} countries
            </>
          )}
          . The China figure also counts Americans' own view of China, and the two surveys do not poll exactly the same countries, so do not subtract one from the other.
        </p>
        <p className="mt-1.5 text-xs text-ink-faint">{data.disclaimer}</p>
      </div>

      <ChartFooter
        source={`Pew Research Center, Spring ${year} Global Attitudes Survey`}
        sourceUrl={us?.url ?? cn?.url}
        asOf={surveys.map((s) => `${s.fieldwork} (published ${s.release})`).join('; ')}
        csv={{ filename: `aex-terminal-favorable-views-${year}.csv`, header: ['Country', 'Favorable toward United States (%)', 'Favorable toward China (%)'], rows: csvRows }}
      />
      <details className="mt-2 text-xs text-ink-faint">
        <summary className="cursor-pointer font-semibold hover:text-ink">How to cite these figures</summary>
        <ul className="mt-1.5 space-y-1">
          {surveys.map((s) => (
            <li key={s.id}>{s.citation}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
