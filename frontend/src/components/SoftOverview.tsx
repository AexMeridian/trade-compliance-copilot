import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { OpinionResponse, PowerIndicator } from '../lib/api';
import { formatValue, ordinal } from '../lib/powerFormat';
import { nameFor, SERIES_COLORS } from '../lib/powerCountries';
import type { SoftTabId } from '../lib/powerTabs';
import { surveysFor } from './AttitudesPanel';
import { RankLadder } from './RankLadder';
import { Sparkline } from './Sparkline';
import { MiniBars, StatTile } from './StatTile';

const LADDER = ['hdi', 'students_inbound', 'science_articles', 'tourist_arrivals', 'internet_users', 'humanitarian_per_person', 'oda_given_usd', 'refugees_per_1000'];

const byId = (list: PowerIndicator[], id: string) => list.find((i) => i.id === id && i.distribution.length > 0);
const topThree = (ind: PowerIndicator | undefined) => (ind ? [...ind.distribution].sort((a, b) => b[1] - a[1]).slice(0, 3) : []);

function EntryCard({ title, text, ind, onOpen }: { title: string; text: string; ind?: PowerIndicator; onOpen: () => void }) {
  const top = topThree(ind);
  const max = top[0]?.[1] || 1;
  return (
    <button type="button" onClick={onOpen} className="card flex min-w-0 flex-col gap-3 p-4 text-left transition-colors hover:border-soft">
      <span className="font-display text-lg font-bold leading-tight text-ink">{title}</span>
      <span className="text-[13px] leading-snug text-ink-muted">{text}</span>
      {ind && top.length > 0 && (
        <span className="mt-auto block border-t border-hairline pt-3">
          <span className="block text-[11px] font-semibold text-ink-faint">{ind.label}, highest three</span>
          <span className="mt-1.5 block">
            <MiniBars tone="soft" rows={top.map(([cc, v]) => ({ label: nameFor(cc), pct: (v / max) * 100, text: formatValue(ind.unit, v).replace(' per person', '').replace(' per 1,000', '') }))} />
          </span>
        </span>
      )}
      <span className="text-[13px] font-semibold text-soft">Open →</span>
    </button>
  );
}

// The Soft Power overview: a handful of real readings as tiles you can click into, where the U.S. and China sit on a set of measures, and
// three doors into the measure tabs. Each tile is one measure on its own; none of them is added to another.
export function SoftOverview({ indicators, opinion, go }: { indicators: PowerIndicator[] | null; opinion: OpinionResponse | null; go: (tab: SoftTabId) => void }) {
  const inds = indicators ?? [];
  const tiles: ReactNode[] = [];

  if (opinion) {
    const year = Math.max(...opinion.surveys.map((s) => s.year));
    const { us, cn } = surveysFor(opinion, year);
    if (us && cn) {
      tiles.push(
        <StatTile
          key="pew"
          tone="soft"
          label={`Favorable view, Pew ${year} median`}
          figure={`${us.publishedMedian}% vs ${cn.publishedMedian}%`}
          note="The U.S. (first) and China across the countries polled."
          visual={<MiniBars tone="soft" rows={[{ label: 'U.S.', pct: us.publishedMedian, text: `${us.publishedMedian}%` }, { label: 'China', pct: cn.publishedMedian, text: `${cn.publishedMedian}%` }]} />}
          onClick={() => go('attitudes')}
        />,
      );
    }
    const a = opinion.africa.medianPositive;
    tiles.push(
      <StatTile
        key="afro"
        tone="soft"
        label="Africa: influence rated positive"
        figure={`${a.us}% vs ${a.cn}%`}
        note="The U.S. (first) and China, median of 38 countries."
        visual={<MiniBars tone="soft" rows={[{ label: 'U.S.', pct: a.us, text: `${a.us}%` }, { label: 'China', pct: a.cn, text: `${a.cn}%` }]} />}
        onClick={() => go('attitudes')}
      />,
    );
  }

  const spark = (ind: PowerIndicator, cc: string) => <Sparkline points={ind.series[cc] ?? []} color={SERIES_COLORS[0]} width={140} height={34} fill />;
  const students = byId(inds, 'students_inbound');
  if (students?.standings.US) {
    const s = students.standings.US;
    tiles.push(
      <StatTile key="stu" tone="soft" label="International students hosted" figure={formatValue(students.unit, s.value)} note={`United States, ${ordinal(s.rank)} of ${s.of} (${s.year}).`} visual={spark(students, 'US')} onClick={() => go('culture')} />,
    );
  }
  const hdi = byId(inds, 'hdi');
  if (hdi?.standings.US && hdi.standings.CN) {
    tiles.push(
      <StatTile
        key="hdi"
        tone="soft"
        label="Human Development Index"
        figure={formatValue(hdi.unit, hdi.standings.US.value)}
        note={`United States, ${ordinal(hdi.standings.US.rank)} of ${hdi.standings.US.of}. China ${formatValue(hdi.unit, hdi.standings.CN.value)}.`}
        visual={spark(hdi, 'US')}
        onClick={() => go('values')}
      />,
    );
  }
  const giving = byId(inds, 'humanitarian_per_person');
  if (giving?.standings.US) {
    const s = giving.standings.US;
    tiles.push(
      <StatTile key="giv" tone="soft" label="Humanitarian funding per resident" figure={formatValue(giving.unit, s.value).replace(' per person', '')} note={`United States, ${ordinal(s.rank)} of ${s.of} donors (${s.year}).`} visual={spark(giving, 'US')} onClick={() => go('foreign')} />,
    );
  }
  const ref = byId(inds, 'refugees_per_1000');
  if (ref?.standings.US && ref.standings.CN) {
    tiles.push(
      <StatTile
        key="ref"
        tone="soft"
        label="Refugees sheltered, per 1,000 residents"
        figure={formatValue(ref.unit, ref.standings.US.value).replace(' per 1,000', '')}
        note={`United States. China ${formatValue(ref.unit, ref.standings.CN.value).replace(' per 1,000', '')}.`}
        visual={spark(ref, 'US')}
        onClick={() => go('foreign')}
      />,
    );
  }

  const ladder = LADDER.map((id) => byId(inds, id)).filter((i): i is PowerIndicator => !!i && !!(i.standings.US || i.standings.CN));
  const culture = byId(inds, 'students_inbound');
  const values = byId(inds, 'women_parliament') ?? byId(inds, 'hdi');
  const foreign = byId(inds, 'humanitarian_per_person');

  return (
    <div className="flex flex-col gap-8">
      {tiles.length > 0 && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{tiles}</div>}

      {ladder.length > 0 && (
        <section className="card p-4 sm:p-5">
          <h2 className="font-display text-xl font-bold text-ink">Where the U.S. and China stand</h2>
          <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-ink-muted">
            Each row is one measure, and the marker is the country's rank among all countries with a reading. Rows are never added up. Open any measure for its map, ranking and caveats.
          </p>
          <div className="mt-4">
            <RankLadder indicators={ladder} codes={['US', 'CN']} />
          </div>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <EntryCard title="Culture & exchange" text="Students, tourists, migrants, researchers and Nobel laureates: the footprints of attraction." ind={culture} onOpen={() => go('culture')} />
        <EntryCard title="Political values" text="How each country's governance is rated, and how women are represented in its parliament." ind={values} onOpen={() => go('values')} />
        <EntryCard title="Foreign policy & aid" text="Aid, humanitarian funding, refugees sheltered, and how closely each country votes with the U.S., China or Russia." ind={foreign} onOpen={() => go('foreign')} />
      </div>

      <details className="card group px-4 py-3 text-sm text-ink-muted">
        <summary className="cursor-pointer list-none font-semibold text-ink [&::-webkit-details-marker]:hidden">
          <span className="mr-2 inline-block text-ink-faint group-open:rotate-90">›</span>What is soft power, and why no score?
        </summary>
        <div className="mt-2 max-w-3xl pl-4 leading-relaxed">
          <p>
            Soft power is the ability to get others to want what you want through attraction rather than payment or force. Scholars say it rests on three things: a country's culture where it appeals to
            others, its political values when it lives up to them, and its foreign policy when others see it as legitimate. Surveys of what people actually think are the best test, so they come first here,
            and what a country has is shown apart from what people say about it.
          </p>
          <p className="mt-2">
            There is no combined score: indices that add these up hide their weights. For the coercive side (sanctions, tariffs, the dollar, defense), see{' '}
            <Link to="/hard-power" className="text-accent hover:underline">
              Hard Power
            </Link>
            .
          </p>
        </div>
      </details>
    </div>
  );
}
