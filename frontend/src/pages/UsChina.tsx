import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Breadcrumb } from '../components/Breadcrumb';
import { PulsePanel } from '../components/PulsePanel';
import { ChartFooter } from '../components/ChartFooter';
import { getPower, type PowerResponse } from '../lib/api';
import { formatValue, ordinal } from '../lib/powerFormat';

// Every measure this site holds for both the United States and China, side by side on one page: the comparison the student in user
// testing had to piece together from four tabs. Same data, sources and years as Hard Power and Soft Power; no score, no winner.

export function UsChina() {
  const [data, setData] = useState<PowerResponse | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    getPower(['US', 'CN']).then(setData).catch(() => setFailed(true));
  }, []);

  const rows = (data?.indicators ?? []).filter((i) => i.standings.US && i.standings.CN && !i.endedYear);
  const dims = data?.dimensions ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Breadcrumb trail={[{ label: 'Basics', to: '/basics' }, { label: 'U.S. and China' }]} />
      <h1 className="display mt-3 text-4xl text-ink sm:text-5xl">The United States and China, side by side</h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-muted">
        Every measure this site has for both countries: economy, military, trade, knowledge, and how people abroad see them. Each figure has its own year and
        source, and a rank among all the countries with data (1st is the highest value, which is not always better: for inequality, higher is worse).
      </p>
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <Link to="/soft-power?tab=attitudes" className="rounded-full border border-hairline-strong px-3 py-1 text-ink-muted hover:text-ink">
          How the world views each (Pew surveys) &rarr;
        </Link>
        <Link to="/hard-power?tab=military" className="rounded-full border border-hairline-strong px-3 py-1 text-ink-muted hover:text-ink">
          Military spending, every country &rarr;
        </Link>
        <Link to="/country/cn" className="rounded-full border border-hairline-strong px-3 py-1 text-ink-muted hover:text-ink">
          U.S. trade actions on China &rarr;
        </Link>
        <Link to="/glossary" className="rounded-full border border-hairline-strong px-3 py-1 text-ink-muted hover:text-ink">
          Glossary &rarr;
        </Link>
      </div>

      {failed && <p className="mt-6 text-sm text-stop">Could not load the comparison right now.</p>}
      {!data && !failed && <p className="mt-6 text-sm text-ink-faint">Loading…</p>}

      {data && (
        <div className="mt-8 flex flex-col gap-6">
          {dims.map((d) => {
            const inDim = rows.filter((r) => r.dimension === d.id);
            if (inDim.length === 0) return null;
            return (
              <PulsePanel key={d.id} title={d.label} subtitle={d.blurb}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-hairline-strong text-left text-ink-muted">
                        <th className="py-1.5 pr-3 font-normal">Measure</th>
                        <th className="py-1.5 pr-3 font-normal">United States</th>
                        <th className="py-1.5 pr-3 font-normal">China</th>
                        <th className="py-1.5 font-normal">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inDim.map((r) => {
                        const us = r.standings.US!;
                        const cn = r.standings.CN!;
                        return (
                          <tr key={r.id} className="border-b border-hairline align-top">
                            <td className="py-2 pr-3 text-ink">
                              {r.label}
                              <span className="block text-xs text-ink-faint">{r.higherIs}</span>
                            </td>
                            <td className="py-2 pr-3 tabular-nums">
                              <span className="font-semibold text-ink">{formatValue(r.unit, us.value)}</span>
                              <span className="block text-xs text-ink-faint">
                                {us.year}, {ordinal(us.rank)} of {us.of}
                              </span>
                            </td>
                            <td className="py-2 pr-3 tabular-nums">
                              <span className="font-semibold text-ink">{formatValue(r.unit, cn.value)}</span>
                              <span className="block text-xs text-ink-faint">
                                {cn.year}, {ordinal(cn.rank)} of {cn.of}
                              </span>
                            </td>
                            <td className="py-2 text-xs">
                              <a href={r.source.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                                {r.source.name}
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </PulsePanel>
            );
          })}
          <ChartFooter
            source="World Bank, SIPRI, UNESCO, UN and others (each row names its own)"
            asOf={data.asOf?.slice(0, 10)}
            csv={{
              filename: 'aex-terminal-us-china.csv',
              header: ['measure', 'unit', 'us_value', 'us_year', 'us_rank', 'china_value', 'china_year', 'china_rank', 'countries_ranked', 'source', 'source_url'],
              rows: rows.map((r) => [r.label, r.unit, r.standings.US!.value, r.standings.US!.year, r.standings.US!.rank, r.standings.CN!.value, r.standings.CN!.year, r.standings.CN!.rank, r.standings.US!.of, r.source.name, r.source.url]),
            }}
          />
          <p className="text-sm text-ink-muted">
            To cite a figure, cite its original source (linked in each row), then this page as where you found it. Each page also has a "Cite this page" button
            at the bottom.
          </p>
        </div>
      )}
    </div>
  );
}
