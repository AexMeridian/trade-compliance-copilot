import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { OpinionResponse, PowerIndicator } from '../lib/api';
import { formatValue, ordinal } from '../lib/powerFormat';
import { nameFor } from '../lib/powerCountries';
import { atlasAfricaGap, atlasFromIndicator, atlasOpinionGap } from '../lib/softPowerMeasures';
import { MeasureAtlas, type AtlasMeasure } from './MeasureAtlas';
import { MeasureHero, type HeroMeasure } from './MeasureHero';

type MeasureId = 'opinion' | 'africa' | 'students' | 'giving' | 'refugees';

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
      const us = opinion.surveys.find((s) => s.subject === 'US' && s.year === year);
      const cn = opinion.surveys.find((s) => s.subject === 'CN' && s.year === year);
      if (gap && us && cn) {
        list.push({
          id: 'opinion',
          label: 'Views of the U.S. and China',
          figure: `${us.publishedMedian}% vs ${cn.publishedMedian}%`,
          caption: (
            <>
              median share with a favorable view of the U.S. (first number) and of China, in {Object.keys(gap.values).length} countries Pew polled in spring {year}. Countries are shaded by which
              is ahead. Where Pew did not poll, there is no reading.
            </>
          ),
          atlas: gap,
          body: null,
        });
      }
      const africa = atlasAfricaGap(opinion.africa);
      list.push({
        id: 'africa',
        label: 'Africa: whose influence is positive',
        figure: `${opinion.africa.medianPositive.us}% vs ${opinion.africa.medianPositive.cn}%`,
        caption: (
          <>
            median share of adults, across {Object.keys(africa.values).length} African countries, who rate the influence of the U.S. (first number) and of China on their country as positive.
            Afrobarometer, 2024 to 2025.
          </>
        ),
        atlas: africa,
        body: null,
      });
    }

    const students = find(inds, 'students_inbound');
    if (students) {
      const a = atlasFromIndicator(students);
      const top = [...students.distribution].sort((x, y) => y[1] - x[1])[0];
      list.push({
        id: 'students',
        label: 'Students hosted',
        figure: formatValue(students.unit, top[1]),
        caption: (
          <>
            international students study in <span className="text-hero-ink">{nameFor(top[0])}</span>, the most of any country ({students.latestYear}). UNESCO Institute for Statistics.
          </>
        ),
        atlas: a,
        body: null,
      });
    }

    const giving = find(inds, 'humanitarian_per_person');
    if (giving) {
      const a = atlasFromIndicator(giving);
      const sorted = [...giving.distribution].sort((x, y) => y[1] - x[1]);
      const usRank = sorted.findIndex(([cc]) => cc === 'US') + 1;
      list.push({
        id: 'giving',
        label: 'Humanitarian giving',
        figure: usRank ? ordinal(usRank) : formatValue(giving.unit, sorted[0][1]),
        caption: usRank ? (
          <>
            among {sorted.length} donor governments for humanitarian funding reported to the UN per resident ({giving.latestYear}). The U.S. ranks higher in total dollars.{' '}
            <span className="text-hero-ink">{nameFor(sorted[0][0])}</span> gives the most per resident.
          </>
        ) : (
          <>per resident, the most of any donor is {nameFor(sorted[0][0])}.</>
        ),
        atlas: a,
        body: null,
      });
    }

    const refugees = find(inds, 'refugees_per_1000');
    if (refugees) {
      const a = atlasFromIndicator(refugees);
      const top = [...refugees.distribution].sort((x, y) => y[1] - x[1])[0];
      list.push({
        id: 'refugees',
        label: 'Refugees sheltered',
        figure: formatValue(refugees.unit, top[1]),
        caption: (
          <>
            is the highest burden of hosted refugees: <span className="text-hero-ink">{nameFor(top[0])}</span> ({refugees.latestYear}). UNHCR counts people under its mandate by country of asylum.
          </>
        ),
        atlas: a,
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
      title="What draws people to a country"
      sub="Opinion, students, aid and refuge, one sourced map at a time. Nothing here is added into a score; a blank is a country nobody asked or counted."
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
    />
  );
}
