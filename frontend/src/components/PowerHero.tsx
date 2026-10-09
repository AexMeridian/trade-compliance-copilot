import { useMemo, useState } from 'react';
import type { NewsItem, PulseAction, PulseMarkets, PulseSummary } from '../types/pulse';
import type { NatoDefenseCountry } from '../lib/api';
import { PulseCountryCard } from './PulseCountryCard';
import { MeasureHero, type HeroMeasure } from './MeasureHero';
import { RankedBars, type BarRow } from './RankedBars';
import { PowerCoferChart } from './PowerCoferChart';
import { PulseCurrencyMovers } from './PulseCharts';
import { COUNTRY_LABELS } from '../lib/pulseCountries';

type MeasureId = 'reserves' | 'defense' | 'currencies';

// Top of the Dollar & allies page: three plain measures of where the dollar and the U.S. alliance
// network stand, each with its own real, sourced figure and picture. No globe here; it lives on Pulse.
export function PowerHero({
  summary,
  markets,
  activeCountry,
  onCountry,
  onClearCountry,
  onSeeAll,
  recent,
  news,
  onExplore,
  updatedText,
  syncing,
  onRefresh,
  coferPoints,
  natoDefense,
}: {
  summary: PulseSummary | null;
  markets: PulseMarkets | null;
  activeCountry: string | null;
  onCountry: (code: string) => void;
  onClearCountry: () => void;
  onSeeAll: () => void;
  recent: PulseAction[];
  news: NewsItem[];
  onExplore: () => void;
  updatedText: string;
  syncing: boolean;
  onRefresh: () => void;
  coferPoints: [string, number][];
  natoDefense: Record<string, NatoDefenseCountry>;
}) {
  const [measure, setMeasure] = useState<MeasureId>('reserves');

  const coferLatest = coferPoints.length > 0 ? coferPoints[coferPoints.length - 1] : null;
  const coferFirst = coferPoints.length > 0 ? coferPoints[0] : null;

  const defenseRows: BarRow[] = useMemo(
    () =>
      Object.entries(natoDefense)
        .map(([code, d]) => ({ code, latest: d.points[d.points.length - 1] }))
        .filter((r) => r.latest)
        .sort((a, b) => b.latest[1] - a.latest[1])
        .map(({ code, latest }) => ({ code, label: `${code === 'US' ? 'United States' : COUNTRY_LABELS[code] ?? code} (${latest[0].slice(0, 4)})`, value: latest[1], text: `${latest[1].toFixed(1)}%` })),
    [natoDefense]
  );
  const us = defenseRows.find((r) => r.code === 'US');
  // Based on the ECB reference rates (always on), not on a stock-quote feed.
  const fx = (markets?.currencies ?? []).filter((r) => r.change30dPct !== null);
  const dollarUp = fx.filter((r) => (r.change30dPct ?? 0) > 0).length;

  const measures: HeroMeasure<MeasureId>[] = [
    {
      id: 'reserves',
      label: "Dollar's reserve share",
      figure: coferLatest ? `${coferLatest[1].toFixed(0)}%` : 'n/a',
      caption:
        coferLatest && coferFirst ? (
          <>
            of the world's central-bank foreign-currency reserves are held in U.S. dollars, down from{' '}
            <span className="text-hero-ink">{coferFirst[1].toFixed(0)}%</span> in {coferFirst[0].slice(0, 4)}. Source: the IMF, updated quarterly.
          </>
        ) : (
          'The IMF reserve data is not available right now.'
        ),
      body: <PowerCoferChart points={coferPoints} />,
    },
    {
      id: 'defense',
      label: 'Defense spending',
      figure: us ? us.text : 'n/a',
      caption: us ? (
        <>
          of the U.S. economy goes to defense ({us.label.match(/\((\d{4})\)/)?.[1]}), shown against the allies NATO publishes figures for. NATO's own target is
          2%. These are NATO's estimates, refreshed about once a year.
        </>
      ) : (
        'NATO defense-spending figures are not available right now.'
      ),
      body: <RankedBars rows={defenseRows} activeCountry={activeCountry} onSelect={onCountry} />,
    },
    {
      id: 'currencies',
      label: 'Dollar vs. currencies',
      figure: fx.length > 0 ? `${dollarUp} of ${fx.length}` : 'n/a',
      caption: fx.length > 0 ? (
        <>
          currencies fell against the U.S. dollar over the last 30 days (ECB daily reference rates). Each bar shows how far the dollar moved against one
          currency; a longer bar to the right means the dollar bought more of it.
        </>
      ) : (
        'Currency data is not available right now.'
      ),
      body: <PulseCurrencyMovers rows={markets?.currencies ?? []} />,
    },
  ];

  const breakdown = summary?.countryBreakdown ?? [];
  const card =
    activeCountry && summary ? (
      <PulseCountryCard
        code={activeCountry}
        count={breakdown.find((b) => b.country === activeCountry)?.count ?? 0}
        rank={(() => {
          const i = breakdown.findIndex((b) => b.country === activeCountry);
          return i >= 0 ? i + 1 : null;
        })()}
        summary={summary}
        markets={markets}
        actions={recent}
        news={news}
        onSeeAll={onSeeAll}
        onClose={onClearCountry}
      />
    ) : null;

  return (
    <MeasureHero
      title="The dollar, allies and trade tools"
      sub="Where the dollar stands in the world's reserves, how allies spend on defense, and how currencies are moving."
      measures={measures}
      active={measure}
      onMeasure={setMeasure}
      activeCountry={activeCountry}
      onCountry={onCountry}
      card={card}
      primary={{ label: 'See trade tools', onClick: onExplore }}
      onRefresh={onRefresh}
      syncing={syncing}
      updatedText={updatedText}
      ready={summary !== null}
    />
  );
}
