import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { OpinionResponse, PowerIndicator } from '../lib/api';
import { formatValue, ordinal } from '../lib/powerFormat';
import { nameFor } from '../lib/powerCountries';
import { atlasAfricaGap, atlasFromIndicator, atlasOpinionGap, commonCountryMedians } from '../lib/softPowerMeasures';
import { MeasureAtlas, type AtlasMeasure } from './MeasureAtlas';
import { MeasureHero, type HeroMeasure } from './MeasureHero';

type MeasureId = 'opinion' | 'africa' | 'aid' | 'students' | 'tourists' | 'migrants';

const find = (indicators: PowerIndicator[], id: string) => indicators.find((i) => i.id === id && i.distribution.length > 0);

// Top of the Soft Power page. Each measure is one real, sourced reading shown as a world map: what publics say about the U.S. and China,
// where students study, who gives humanitarian aid, who shelters refugees. A map is one measure; maps are never added together.
export function SoftPowerHero({
  indicators,
  opinion,
  onExplore,
}: {
  indicators: PowerIndicator[] | null;
  opinion: OpinionResponse | null;
  onExplore: () => void;
}) {
  const [measure, setMeasure] = useState<MeasureId>('opinion');
  const [active, setActive] = useState<string | null>(null);

  const built = useMemo(() => {
    const list: (HeroMeasure<MeasureId> & { atlas: AtlasMeasure })[] = [];
    const inds = indicators ?? [];

    if (opinion) {
      const year = Math.max(...opinion.surveys.map((s) => s.year));
      const gap = atlasOpinionGap(opinion, year);
      const med = commonCountryMedians(opinion, year);
      if (gap && med) {
        list.push({
          id: 'opinion',
          label: 'Views of the U.S. and China',
          figure: `${med.us}% vs ${med.cn}%`,
          caption: (
            <>
              median share with a favorable view of the U.S. (first number) and of China, across the {med.n} countries Pew polled about both in {year}. This is a median of countries, each counted once, not
              the world's opinion; Pew did not poll most of the world. Countries are shaded by which is ahead; where Pew did not poll, there is no reading.
            </>
          ),
          atlas: gap,
          body: null,
        });
      }
      const africa = atlasAfricaGap(opinion.africa);
      list.push({
        id: 'africa',
        label: 'Africa: influence rated positive',
        figure: `${opinion.africa.medianPositive.us}% vs ${opinion.africa.medianPositive.cn}%`,
        caption: (
          <>
            median share of adults, across {Object.keys(africa.values).length} African countries, who rate the influence of the U.S. (first number) and of China on their country as positive.
            An unweighted median of countries, not of people. Afrobarometer Round 10, 2024 to 2025 (fieldwork straddles the January 2025 U.S. aid freeze).
          </>
        ),
        atlas: africa,
        body: null,
      });
    }

    // Four everyday measures anyone can read: who gives the most aid, where students study, which countries tourists visit, where migrants live.
    // Aid as a share of income is the default: dollar totals mostly redraw the size of the economy. Falls back to dollars if the share series is absent.
    const aid = find(inds, 'oda_given_gni') ?? find(inds, 'oda_given_usd');
    if (aid) {
      const top = [...aid.distribution].sort((x, y) => y[1] - x[1])[0];
      const share = aid.id === 'oda_given_gni';
      list.push({
        id: 'aid',
        label: 'Aid given by donor countries',
        figure: formatValue(aid.unit, top[1]),
        caption: (
          <>
            {share ? 'of national income given as official development aid by ' : 'in official development aid from '}
            <span className="text-hero-ink">{nameFor(top[0])}</span>, the highest among the {aid.distribution.length} donor countries in this series ({aid.latestYear}). Only members of the OECD's Development Assistance Committee
            report to it, so China, the Gulf states and India are blank here, not zero. The World Bank.
          </>
        ),
        atlas: atlasFromIndicator(aid),
        body: null,
      });
    }
    const students = find(inds, 'students_inbound');
    if (students) {
      const sorted = [...students.distribution].sort((x, y) => y[1] - x[1]);
      const us = sorted.findIndex(([cc]) => cc === 'US') + 1;
      list.push({
        id: 'students',
        label: 'Where students go to study',
        figure: formatValue(students.unit, sorted[0][1]),
        caption: (
          <>
            international students studying in <span className="text-hero-ink">{nameFor(sorted[0][0])}</span>, the most of any country ({students.latestYear}). A count, so it also tracks size, language and neighbors.
            {us ? <> The United States ranks {ordinal(us)} of {sorted.length}.</> : null} UNESCO Institute for Statistics.
          </>
        ),
        atlas: atlasFromIndicator(students),
        body: null,
      });
    }
    const tourists = find(inds, 'tourist_arrivals');
    if (tourists) {
      const sorted = [...tourists.distribution].sort((x, y) => y[1] - x[1]);
      list.push({
        id: 'tourists',
        label: 'Most visited countries',
        figure: formatValue(tourists.unit, sorted[0][1]),
        caption: (
          <>
            international tourist arrivals in <span className="text-hero-ink">{nameFor(sorted[0][0])}</span>, the most of any country ({tourists.latestYear}); a count that tracks geography and price as much as appeal. World Bank, from the UN Tourism organization.
          </>
        ),
        atlas: atlasFromIndicator(tourists),
        body: null,
      });
    }
    const migrants = find(inds, 'migrant_share');
    if (migrants) {
      const sorted = [...migrants.distribution].sort((x, y) => y[1] - x[1]);
      const us = sorted.find(([cc]) => cc === 'US');
      list.push({
        id: 'migrants',
        label: 'Where people move to',
        figure: us ? formatValue(migrants.unit, us[1]) : formatValue(migrants.unit, sorted[0][1]),
        caption: us ? (
          <>
            of people living in the United States were born abroad ({migrants.latestYear}). The highest share is <span className="text-hero-ink">{nameFor(sorted[0][0])}</span> at{' '}
            {formatValue(migrants.unit, sorted[0][1])}. United Nations estimates, via the World Bank.
          </>
        ) : (
          <>
            of residents of <span className="text-hero-ink">{nameFor(sorted[0][0])}</span> were born abroad, the highest share ({migrants.latestYear}).
          </>
        ),
        atlas: atlasFromIndicator(migrants),
        body: null,
      });
    }
    return list;
  }, [indicators, opinion]);

  const current = built.find((m) => m.id === measure) ?? built[0];
  // Until the first readings arrive the hero still needs one measure to show; it is replaced as soon as there is data.
  const measures: HeroMeasure<MeasureId>[] = built.length
    ? built.map((m) => ({
        id: m.id,
        label: m.label,
        figure: m.figure,
        caption: m.caption,
        body: <MeasureAtlas measure={m.atlas} activeCountry={active} onSelect={setActive} />,
      }))
    : [{ id: 'opinion', label: 'Views of the U.S. and China', figure: '…', caption: 'Loading the latest numbers.', body: null }];

  const value = current && active ? current.atlas.values[active] : undefined;
  const card = active && current ? (
    <div className="border border-hero-border bg-hero-card-bg p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="display text-2xl">{nameFor(active)}</p>
          <p className="mt-1 text-sm text-hero-ink-muted">
            {current.label}: {value === undefined ? 'no reading' : current.atlas.format(value)}
            {current.atlas.asOf ? ` (${current.atlas.asOf})` : ''}
          </p>
        </div>
        <button type="button" onClick={() => setActive(null)} className="text-sm text-hero-ink-muted hover:text-hero-ink" aria-label="Close country card">
          &times;
        </button>
      </div>
      <Link to={`/country/${active.toLowerCase()}?tab=soft`} className="btn-hero mt-3 inline-block">
        Open {nameFor(active)}'s soft power profile
      </Link>
    </div>
  ) : null;

  return (
    <MeasureHero
      title="Soft power: footprints and reach"
      sub="What people say, who gives aid, where students study, which countries tourists visit and where people move: footprints of reach, not proof of attraction. One sourced map at a time, never added into a score; a blank is a country nobody asked or counted, not a zero."
      measures={measures}
      active={current?.id ?? 'opinion'}
      onMeasure={(id) => {
        setMeasure(id);
        setActive(null);
      }}
      activeCountry={active}
      onCountry={setActive}
      card={card}
      primary={{ label: 'See what people say', onClick: onExplore }}
      ready={built.length > 0}
      centered
    />
  );
}
