import { Fragment, useEffect, useState } from 'react';
import { getOpinion, getPower, type OpinionResponse, type PowerResponse } from '../lib/api';
import { POWER_TERMS } from '../lib/pulseGlossary';
import { nameFor } from '../lib/powerCountries';
import { AfricaPanel } from './AfricaPanel';
import { AttitudesPanel } from './AttitudesPanel';
import { ChartFooter } from './ChartFooter';
import { IndicatorRow } from './IndicatorRow';
import { LeftOut } from './LeftOut';
import { RankLadder } from './RankLadder';
import { ResourceGap } from './ResourceGap';
import { SectionHeader } from './SectionHeader';
import { UnAlignmentGlobe } from './UnAlignmentGlobe';


// The soft-power side of the comparison. Organized the way the idea is usually explained (Joseph Nye: attraction rests on
// a country's culture, its political values and its foreign policy) and deliberately without a score: every figure is
// shown with its unit, year and rank, so a reader can see what a country has and where it stands, and judge for themselves.
export function PowerProfile({ codes }: { codes: string[] }) {
  const [data, setData] = useState<PowerResponse | null>(null);
  const [error, setError] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [opinion, setOpinion] = useState<OpinionResponse | null>(null);
  const [opinionYear, setOpinionYear] = useState<number | null>(null);
  const key = codes.join(',');

  useEffect(() => {
    let cancelled = false;
    setError(false);
    getPower(codes)
      .then((r) => !cancelled && setData(r))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Opinion readings are static and independent of the indicators: if they fail to load, the rest of the page is unaffected.
  useEffect(() => {
    let cancelled = false;
    getOpinion()
      .then((r) => !cancelled && setOpinion(r))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className="mt-10 text-sm text-stop">Couldn't load the country indicators. Please try again in a moment.</p>;
  if (!data) return <p className="mt-10 text-sm text-ink-faint">Loading…</p>;
  if (!data.loaded) {
    return (
      <p className="mt-10 max-w-xl text-sm leading-relaxed text-ink-muted">
        The country indicators haven't been loaded yet. They are collected from the World Bank once a week, so this page will fill in after the next update.
      </p>
    );
  }

  const latestYear = opinion && opinion.surveys.length > 0 ? Math.max(...opinion.surveys.map((x) => x.year)) : null;
  const year = opinionYear ?? latestYear;
  const asOf = data.asOf ? data.asOf.slice(0, 10) : undefined;
  const sections = data.dimensions
    .map((d) => ({ dim: d, rows: data.indicators.filter((i) => i.dimension === d.id) }))
    .filter((s) => s.rows.length > 0);

  return (
    <div className="mt-8">
      <div className="max-w-3xl text-sm leading-relaxed text-ink-muted">
        <p>
          Soft power is a country's ability to shape what others want through attraction instead of pressure. It is usually traced to three sources: its
          culture, its political values and its foreign policy. Each is shown below with published figures and no score, so you can see what a country has
          and where it ranks among all countries with data.
        </p>
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold text-ink-faint hover:text-ink">What this page does not measure</summary>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              What people think, beyond one survey. The opinion section uses Pew Research Center's polls of the United States and China, which cover only the 24 to 37 countries
              Pew polled, so most countries have no reading. Other pollsters are not included.
            </li>
            <li>Film, music, sport, brands and language reach. There is no open dataset that covers them for every country.</li>
            <li>Embassy networks, scholarships and informal or covert influence.</li>
            <li>A figure is a resource or a footprint. Having a resource does not mean it turns into goodwill.</li>
          </ul>
        </details>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
        <button type="button" onClick={() => setShowTable((s) => !s)} aria-pressed={showTable} className="btn text-sm">
          {showTable ? 'Hide year-by-year tables' : 'Show year-by-year tables'}
        </button>
        <span className="text-xs text-ink-faint">Rank 1 is the highest value. Each figure is in its own latest year.</span>
      </div>

      <div className="mt-8 flex flex-col gap-10">
        {sections.map(({ dim, rows }) => {
          const attitudes =
            dim.id === 'hard_power' && opinion && year ? (
              <section key="attitudes">
                <SectionHeader
                  tone="soft"
                  title="Attitudes: what people say"
                  description="The test of soft power is whether people actually feel drawn to a country. These are published survey results, shown on their own and never folded into a score."
                />
                <div className="mt-4 flex flex-col gap-5">
                  <AttitudesPanel data={opinion} year={year} onYear={setOpinionYear} codes={codes} showTable={showTable} />
                  <AfricaPanel data={opinion.africa} codes={codes} showTable={showTable} />
                  <ResourceGap indicators={data.indicators} opinion={opinion} year={year} codes={codes} />
                </div>
              </section>
            ) : null;
          const sources = [...new Map(rows.map((r) => [r.source.name, r.source.url])).entries()];
          const csvRows = rows.flatMap((r) =>
            codes.map((c) => {
              const s = r.standings[c];
              return [r.label, nameFor(c), s ? s.value : '', s ? s.year : '', s ? s.rank : '', s ? s.of : ''];
            }),
          );
          return (
            <Fragment key={dim.id}>
              {attitudes}
            <section>
              <SectionHeader tone={dim.id === 'hard_power' ? 'hard' : 'soft'} title={dim.label} description={dim.blurb} />
              {dim.id === 'alignment' && (
                <div className="mt-4">
                  <UnAlignmentGlobe />
                </div>
              )}
              {rows.some((r) => codes.some((c) => r.standings[c])) && (
                <div className="card mt-4 min-w-0 p-4">
                  <h3 className="mb-3 text-[15px] font-semibold text-ink">Where each country ranks</h3>
                  <RankLadder indicators={rows.filter((r) => codes.some((c) => r.standings[c]))} codes={codes} />
                </div>
              )}
              <div className="card mt-4 min-w-0 px-4 pb-4 pt-1">
                <div>
                  {rows.map((r) => (
                    <IndicatorRow key={r.id} indicator={r} codes={codes} showTable={showTable} />
                  ))}
                </div>
                <ChartFooter
                  source={sources.map(([name]) => name).join('; ')}
                  sourceUrl={sources.length === 1 ? sources[0][1] : undefined}
                  asOf={asOf}
                  csv={{ filename: `aex-terminal-${dim.id}.csv`, header: ['Indicator', 'Country', 'Value', 'Year', 'Rank', 'Countries ranked'], rows: csvRows }}
                />
              </div>
            </section>
            </Fragment>
          );
        })}
      </div>

      <div className="mt-10">
        <LeftOut />
      </div>

      <details className="mt-6 text-[13px] text-ink-muted">
        <summary className="cursor-pointer font-semibold text-ink-faint hover:text-ink">Terms used on this page</summary>
        <dl className="mt-2 grid max-w-3xl gap-y-2">
          {POWER_TERMS.map(([term, def]) => (
            <div key={term}>
              <dt className="font-semibold text-ink">{term}</dt>
              <dd>{def}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
