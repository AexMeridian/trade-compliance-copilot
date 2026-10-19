import { useEffect, useMemo, useState } from 'react';
import type { NewsItem, PulseAction, PulseMarkets, PulseSummary } from '../types/pulse';
import { PulseCountryCard } from './PulseCountryCard';
import { MeasureHero, type HeroMeasure } from './MeasureHero';
import { RankedBars, type BarRow } from './RankedBars';
import { PulseDelta } from './PulseDelta';
import { COUNTRY_LABELS } from '../lib/pulseCountries';
import { TARIFF_COUNTRY_LABELS } from '../lib/pulseTariffCountries';
import { getSanctionCounts, type NatoDefenseCountry, type SanctionCounts } from '../lib/api';
import { PowerCoferChart } from './PowerCoferChart';
import { PulseCurrencyMovers } from './PulseCharts';

type MeasureId = 'sanctions' | 'tariff' | 'notices' | 'reserves' | 'defense' | 'currencies';

const nameOf = (code: string) => TARIFF_COUNTRY_LABELS[code] ?? COUNTRY_LABELS[code] ?? code;
const fmt = (n: number) => n.toLocaleString('en-US');

// Top of the Hard Power page. Six real measures of the coercive and financial tools: sanctioned parties, the extra tariff in force,
// the count of new official notices, the dollar's reserve share, defense spending and currency moves, each in plain words with its
// own sourced figure. Soft power is on its own page; nothing here is combined into a score.
export function HardPowerHero({
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
  const [measure, setMeasure] = useState<MeasureId>('sanctions');
  const [sanctions, setSanctions] = useState<SanctionCounts | null>(null);
  const [sanctionsFailed, setSanctionsFailed] = useState(false);

  // Only fetched once someone opens the Sanctioned parties measure; the endpoint is cached for hours.
  useEffect(() => {
    if (measure !== 'sanctions' || sanctions || sanctionsFailed) return;
    let live = true;
    getSanctionCounts()
      .then((s) => live && setSanctions(s))
      .catch(() => live && setSanctionsFailed(true));
    return () => {
      live = false;
    };
  }, [measure, sanctions, sanctionsFailed]);

  const tariffRows: BarRow[] = useMemo(
    () => (summary?.countryTariffs.forcedLabor ?? []).map((f) => ({ code: f.country, label: nameOf(f.country), value: f.ratePct, text: `${f.ratePct}%` })).sort((a, b) => b.value - a.value),
    [summary]
  );
  const sanctionRows: BarRow[] = useMemo(
    () => (sanctions?.countries ?? []).map((c) => ({ code: c.country, label: nameOf(c.country), value: c.count, text: fmt(c.count) })),
    [sanctions]
  );
  const noticeRows: BarRow[] = useMemo(
    () => (summary?.countryBreakdown ?? []).filter((b) => b.country !== 'US').map((b) => ({ code: b.country, label: nameOf(b.country), value: b.count, text: fmt(b.count) })),
    [summary]
  );

  const defenseRows: BarRow[] = useMemo(
    () =>
      Object.entries(natoDefense)
        .map(([code, d]) => ({ code, latest: d.points[d.points.length - 1] }))
        .filter((r) => r.latest)
        .sort((a, b) => b.latest[1] - a.latest[1])
        .map(({ code, latest }) => ({ code, label: `${code === 'US' ? 'United States' : COUNTRY_LABELS[code] ?? code} (${latest[0].slice(0, 4)})`, value: latest[1], text: `${latest[1].toFixed(1)}%` })),
    [natoDefense]
  );
  const usDefense = defenseRows.find((r) => r.code === 'US');
  const coferLatest = coferPoints.length > 0 ? coferPoints[coferPoints.length - 1] : null;
  const coferFirst = coferPoints.length > 0 ? coferPoints[0] : null;
  // Based on the ECB reference rates (always on), not on a stock-quote feed.
  const fx = (markets?.currencies ?? []).filter((r) => r.change30dPct !== null);
  const dollarUp = fx.filter((r) => (r.change30dPct ?? 0) > 0).length;

  const forcedLaborDate = summary?.countryTariffs.forcedLabor[0]?.asOf;
  const canadaExtra = summary?.countryTariffs.extra[0];
  // The extra tariff only takes a couple of distinct rates, so a ranked bar chart would be a
  // wall of identical bars. Group the countries by rate instead.
  const tiers = [...new Set(tariffRows.map((r) => r.value))].sort((x, y) => y - x).map((rate) => ({ rate, rows: tariffRows.filter((r) => r.value === rate) }));
  const measures: HeroMeasure<MeasureId>[] = [
    {
      id: 'sanctions',
      label: 'Sanctioned parties',
      figure: sanctions ? fmt(sanctions.total) : sanctionsFailed ? 'n/a' : '…',
      caption: sanctionsFailed ? (
        'The sanctions lists could not be counted just now.'
      ) : (
        <>
          People and companies on the U.S. (OFAC, Commerce and State), UN and UK sanctions lists
          {sanctionRows[0] ? (
            <>
              . <span className="text-hero-ink">{sanctionRows[0].label}</span> has the most, {sanctionRows[0].text}.
            </>
          ) : (
            '.'
          )}{' '}
          Counted by the country in each listed address, so it is a text match, not a legal finding.
        </>
      ),
      body: sanctionsFailed ? (
        <p className="text-sm text-hero-ink-faint">Not available right now.</p>
      ) : sanctions ? (
        <RankedBars rows={sanctionRows} activeCountry={activeCountry} onSelect={onCountry} />
      ) : (
        <p className="text-sm text-hero-ink-faint">Counting the lists…</p>
      ),
    },
    {
      id: 'tariff',
      label: 'Extra tariffs',
      figure: tariffRows.length > 0 ? String(tariffRows.length) : 'None',
      caption:
        tariffRows.length > 0 ? (
          <>
            countries and economies face an extra U.S. tariff on nearly all their goods, on top of the normal rate (the Section 301 forced-labor determination
            {forcedLaborDate ? `, data as of ${forcedLaborDate}` : ''}).
            {canadaExtra && ` Canada also faces ${canadaExtra.ratePct}% on ${canadaExtra.note}.`}
          </>
        ) : (
          'No country-specific extra tariff is on record right now.'
        ),
      body: (
        <div className="flex flex-col gap-5">
          {tiers.map((t) => (
            <div key={t.rate}>
              <p className="text-sm font-semibold">
                {t.rate}% extra <span className="font-normal text-hero-ink-muted">on {t.rows.length} countries</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {t.rows.map((r) => (
                  <button
                    key={r.code}
                    type="button"
                    onClick={() => onCountry(r.code)}
                    aria-pressed={activeCountry === r.code}
                    className={`rounded-full border px-2.5 py-1 text-[12.5px] ${
                      activeCountry === r.code ? 'border-hue-orange bg-hue-orange/15 text-hue-orange-ink' : 'border-hero-border text-hero-ink hover:border-hero-border-strong hover:bg-hero-card-bg'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'notices',
      label: 'New notices',
      figure: summary ? fmt(summary.last30) : '…',
      caption: summary ? (
        <>
          Official U.S. government notices about tariffs, sanctions or export rules published in the last 30 days
          {summary.trendPct !== null && (
            <>
              {' '}
              (<PulseDelta change={summary.trendPct} text={`${Math.abs(summary.trendPct)}%`} className="font-semibold" /> on the 30 days before)
            </>
          )}
          . A notice can name several countries.
        </>
      ) : null,
      body: <RankedBars rows={noticeRows} activeCountry={activeCountry} onSelect={onCountry} />,
    },
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
      figure: usDefense ? usDefense.text : 'n/a',
      caption: usDefense ? (
        <>
          of the U.S. economy goes to defense ({usDefense.label.match(/\((\d{4})\)/)?.[1]}), shown against the allies NATO publishes figures for. NATO's own target is 2%. These are
          NATO's estimates, refreshed about once a year.
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
      caption:
        fx.length > 0 ? (
          <>
            currencies fell against the U.S. dollar over the last 30 days (ECB daily reference rates). Each bar shows how far the dollar moved against one currency; a longer bar to
            the right means the dollar bought more of it.
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
      title="The hard tools of U.S. power"
      sub="Sanctions, tariffs, the dollar and defense spending: what the U.S. can compel or withhold, with the sources. Pick a measure, then open any country."
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
