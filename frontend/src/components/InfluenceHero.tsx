import { useEffect, useMemo, useState } from 'react';
import type { NewsItem, PulseAction, PulseMarkets, PulseSummary } from '../types/pulse';
import { PulseCountryCard } from './PulseCountryCard';
import { MeasureHero, type HeroMeasure } from './MeasureHero';
import { RankedBars, type BarRow } from './RankedBars';
import { PulseDelta } from './PulseDelta';
import { COUNTRY_LABELS } from '../lib/pulseCountries';
import { TARIFF_COUNTRY_LABELS } from '../lib/pulseTariffCountries';
import { getSanctionCounts, type SanctionCounts } from '../lib/api';

type MeasureId = 'tariff' | 'sanctions' | 'notices';

const nameOf = (code: string) => TARIFF_COUNTRY_LABELS[code] ?? COUNTRY_LABELS[code] ?? code;
const fmt = (n: number) => n.toLocaleString('en-US');

// Top of the U.S. abroad page. Three real measures of how U.S. policy reaches other countries,
// each in plain words: the extra tariff in force, the number of sanctioned parties located there,
// and the count of new official notices. No globe here; it lives on Pulse.
export function InfluenceHero({
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
      title="How U.S. policy reaches other countries"
      sub="Pick a measure to see which countries are affected most, then open any country for the full picture."
      measures={measures}
      active={measure}
      onMeasure={setMeasure}
      activeCountry={activeCountry}
      onCountry={onCountry}
      card={card}
      primary={{ label: 'See pressure tools', onClick: onExplore }}
      onRefresh={onRefresh}
      syncing={syncing}
      updatedText={updatedText}
      ready={summary !== null}
    />
  );
}
