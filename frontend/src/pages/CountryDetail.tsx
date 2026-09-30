import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { getPulseCountry, getPulseHome } from '../lib/api';
import { COUNTRY_TABS, CountryTabs, type CountryTabId } from '../components/CountryTabs';
import { PulsePanel } from '../components/PulsePanel';
import { PulseTempoChart } from '../components/PulseTempoChart';
import { PulseFeedList } from '../components/PulseFeedList';
import { DutyStackTable } from '../components/DutyStackTable';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { NewsThumb, timeAgo } from '../components/PulseNews';
import { TARIFF_COUNTRY_LABELS } from '../lib/pulseTariffCountries';
import { parseCountries } from '../lib/pulseCountries';
import { blocsFor, BLOC_FULL_NAMES } from '../lib/pulseBlocs';
import type { PulseCountryDetail, PulseMarkets, NewsItem } from '../types/pulse';

// A country doesn't have its own attributed exchange rate unless the U.S.
// tracks a direct pair against it (see lib/pulse/markets.ts's FX_META) --
// Eurozone countries share the EUR pair rather than each having their own,
// which is disclosed in the panel copy, not hidden.
const CURRENCY_FOR: Record<string, string> = {
  DE: 'EUR',
  FR: 'EUR',
  IT: 'EUR',
  CN: 'CNY',
  JP: 'JPY',
  MX: 'MXN',
  CA: 'CAD',
  GB: 'GBP',
  IN: 'INR',
  KR: 'KRW',
};

// The HTS source data's description field carries its own inline markup
// (e.g. "<il>4.75 mm</il>" for italics) meant for USITC's own renderer, not
// plain text -- this is the first place in the app that shows this field
// directly to a reader, so it needs stripping rather than passing it through.
const stripHtsMarkup = (s: string) => s.replace(/<\/?[a-z]+>/gi, '');

const STATUS_LABEL: Record<PulseCountryDetail['exportControl']['status'], string> = {
  curated: 'Verified export-control status',
  comprehensive_embargo: 'Comprehensively embargoed',
  broad_restriction_746_5: 'Near-comprehensive license requirement',
  not_curated: 'Not yet verified by this app',
};

export function CountryDetail() {
  const { code: rawCode } = useParams<{ code: string }>();
  const code = (rawCode ?? '').toUpperCase();
  const name = TARIFF_COUNTRY_LABELS[code] ?? code;

  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab');
  const tab: CountryTabId = COUNTRY_TABS.some((t) => t.id === tabParam) ? (tabParam as CountryTabId) : 'overview';
  const setTab = (id: CountryTabId) => {
    const next = new URLSearchParams(params);
    if (id === 'overview') next.delete('tab');
    else next.set('tab', id);
    setParams(next, { replace: true });
  };

  const [data, setData] = useState<PulseCountryDetail | null>(null);
  const [markets, setMarkets] = useState<PulseMarkets | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([getPulseCountry(code, name), getPulseHome()])
      .then(([detail, home]) => {
        setData(detail);
        if (home.markets) setMarkets(home.markets);
        if (home.news) setNews(home.news.items);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [code, name]);

  const blocs = blocsFor(code);
  const currency = CURRENCY_FOR[code];
  const fxRow = markets?.currencies.find((c) => c.quote === currency) ?? null;
  const countryNews = news.filter((n) => parseCountries(n.countries).includes(code)).slice(0, 8);

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <p className="card py-6 text-center text-sm text-ink-faint">Loading {name}…</p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <p className="border border-stop/30 bg-stop-soft px-3 py-2 text-sm text-stop">Couldn't load this page. ({error ?? 'No data'})</p>
      </div>
    );
  }

  const { tariffs, dutyStack, exportControl, sanctions } = data;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link to="/" className="text-sm text-ink-faint no-underline hover:text-accent">
        &larr; Trade Policy Pulse
      </Link>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="display text-4xl text-ink sm:text-5xl">{name}</h1>
        {blocs.length > 0 && (
          <p className="text-sm text-ink-faint">
            {blocs.map((b) => BLOC_FULL_NAMES[b]).join(' · ')}
          </p>
        )}
      </div>
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">
        Everything this app tracks about {name} in one place: U.S. policy actions naming it, the real tariff rates it faces, a sample duty-stack breakdown,
        export-control status, and a sanctioned-entity count. See the Guide on the main page for what each of these does and doesn't mean.
      </p>

      <CountryTabs active={tab} onChange={setTab} />

      <div role="tabpanel" id="country-tabpanel" className="mt-6">
        {tab === 'overview' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <PulsePanel title="U.S. policy actions naming it">
              <p className="text-3xl font-bold tabular-nums text-ink">{data.actions.length}</p>
              <p className="mt-1 text-sm text-ink-faint">In the full Federal Register history this app tracks.</p>
            </PulsePanel>
            <PulsePanel title="Section 301 forced-labor rate">
              {tariffs.forcedLabor ? (
                <>
                  <p className="text-3xl font-bold tabular-nums text-ink">{tariffs.forcedLabor.ratePct}%</p>
                  <p className="mt-1 text-sm text-ink-faint">Applies across almost every product category, not one chapter.</p>
                </>
              ) : (
                <p className="text-sm text-ink-faint">Not on the Section 301 forced-labor list.</p>
              )}
            </PulsePanel>
            <PulsePanel title="Export-control status">
              <p className="text-base font-semibold text-ink">{STATUS_LABEL[exportControl.status]}</p>
              {exportControl.status === 'not_curated' && (
                <p className="mt-1 text-sm text-ink-faint">Only 12 destinations are hand-verified in this app; see the Export controls tab.</p>
              )}
            </PulsePanel>
            <PulsePanel title="Sanctioned entities (OFAC/BIS)">
              {sanctions.sdnCount !== null ? (
                <>
                  <p className="text-3xl font-bold tabular-nums text-ink">
                    {sanctions.sdnCount + (sanctions.cslCount ?? 0)}
                  </p>
                  <p className="mt-1 text-sm text-ink-faint">{sanctions.sdnCount} SDN, {sanctions.cslCount} CSL. {sanctions.note}</p>
                </>
              ) : (
                <p className="text-sm text-ink-faint">{sanctions.note}</p>
              )}
            </PulsePanel>
            {fxRow && (
              <PulsePanel title={`USD / ${fxRow.quote}`}>
                <p className="text-3xl font-bold tabular-nums text-ink">{fxRow.rate.toFixed(2)}</p>
                <p className="mt-1 text-sm text-ink-faint">
                  {currency === 'EUR' ? 'A Eurozone-wide rate, not specific to this country. ' : ''}
                  {fxRow.change30dPct !== null ? `${fxRow.change30dPct >= 0 ? 'Up' : 'Down'} ${Math.abs(fxRow.change30dPct).toFixed(1)}% vs. 30 days ago.` : ''}
                </p>
              </PulsePanel>
            )}
            {tariffs.capped && (
              <PulsePanel title="Section 232 metals cap">
                <p className="text-3xl font-bold tabular-nums text-ink">{tariffs.capped.ratePct}%</p>
                <p className="mt-1 text-sm text-ink-faint">
                  Capped below the standard {tariffs.capped.standardPct}% baseline ({tariffs.capped.note}).
                </p>
              </PulsePanel>
            )}
          </div>
        )}

        {tab === 'policy' && (
          <div className="flex flex-col gap-6">
            <PulsePanel title="Policy tempo" subtitle="Every month this country was named in a U.S. trade action, full history.">
              <PulseTempoChart months={data.tempo} trendPct={null} />
            </PulsePanel>
            <PulsePanel title={`All ${data.actions.length} actions naming ${name}`}>
              <PulseFeedList actions={data.actions} />
            </PulsePanel>
          </div>
        )}

        {tab === 'tariffs' && (
          <div className="flex flex-col gap-6">
            <PulsePanel
              title="Tariff programs"
              help="Section 301's forced-labor determination is the one program here that's both country-specific and broad -- it applies across nearly the whole tariff schedule, not one product category. Section 338 (Canada) and the Section 232 metals country caps are real but narrower or a reduction, so they're shown as separate facts rather than folded into one misleadingly-precise total."
            >
              <ul className="flex flex-col gap-3 text-sm">
                {tariffs.forcedLabor && (
                  <li>
                    <span className="font-semibold text-ink">Section 301 forced-labor determination: {tariffs.forcedLabor.ratePct}%.</span>{' '}
                    <a href={tariffs.forcedLabor.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                      Source
                    </a>{' '}
                    <span className="text-ink-faint">(as of {tariffs.forcedLabor.asOf})</span>
                  </li>
                )}
                {tariffs.extra.map((e, i) => (
                  <li key={i}>
                    <span className="font-semibold text-ink">Section 338 extra duty: {e.ratePct}%</span> ({e.note}).{' '}
                    <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                      Source
                    </a>
                  </li>
                ))}
                {tariffs.capped && (
                  <li>
                    <span className="font-semibold text-ink">Section 232 metals cap: {tariffs.capped.ratePct}%</span> instead of the standard{' '}
                    {tariffs.capped.standardPct}% ({tariffs.capped.note}).{' '}
                    <a href={tariffs.capped.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                      Source
                    </a>
                  </li>
                )}
                {!tariffs.forcedLabor && tariffs.extra.length === 0 && !tariffs.capped && (
                  <li className="text-ink-faint">No country-specific tariff program applies to {name} right now.</li>
                )}
              </ul>
            </PulsePanel>

            <PulsePanel
              title="Sample duty-stack breakdown"
              subtitle={`A representative sample of ${dutyStack.length} HTS headings with known tariff-program exposure, not the full ~31,000-line schedule.`}
              help="Each heading below runs through the same duty-stack logic used by the compliance calculator: the HTS general (or USMCA-special) rate, plus whichever Section 232/301/338 layers apply to this country and this product, with the real anti-stacking and country-cap rules already applied. Pick a different product in the calculator for an exact answer on your own shipment."
            >
              <div className="flex flex-col gap-6">
                {dutyStack.map((h) => (
                  <div key={h.htsno}>
                    <h3 className="text-sm font-semibold text-ink">
                      {h.label} <span className="font-normal text-ink-faint">HTS {h.htsno}{h.description ? ` -- ${stripHtsMarkup(h.description)}` : ''}</span>
                    </h3>
                    {h.error ? (
                      <p className="mt-1 text-sm text-ink-faint">{h.error}</p>
                    ) : (
                      <div className="mt-2 overflow-x-auto">
                        <DutyStackTable lines={h.lines} totalPct={h.totalPct} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </PulsePanel>
          </div>
        )}

        {tab === 'export' && (
          <PulsePanel title="Commerce Country Chart status">
            {exportControl.status === 'not_curated' ? (
              <p className="text-sm text-ink-muted">
                This app has hand-verified export-control chart status for only 12 destinations so far. {name} isn't one of them yet, so no status is shown
                here rather than a guessed one -- an export case involving {name} should be flagged for manual review.
              </p>
            ) : (
              <>
                <p className="text-base font-semibold text-ink">{STATUS_LABEL[exportControl.status]}</p>
                {exportControl.notes && <p className="mt-2 text-sm text-ink-muted">{exportControl.notes}</p>}
                {exportControl.sourceUrl && (
                  <p className="mt-2">
                    <ProvenanceBadge source={{ source_url: exportControl.sourceUrl, source_tier: 1, last_updated: exportControl.lastUpdated ?? '' }} />
                  </p>
                )}
                {exportControl.rows.length > 0 && (
                  <table className="mt-4 w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-hairline-strong text-left text-ink-muted">
                        <th className="py-1.5 pr-3 font-normal">Reason for control</th>
                        <th className="py-1.5 font-normal">Column</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exportControl.rows.map((r) => (
                        <tr key={r.id} className="border-b border-hairline">
                          <td className="py-2 pr-3">{r.control_level}</td>
                          <td className="py-2 tabular-nums">{r.reason_for_control}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </PulsePanel>
        )}

        {tab === 'sanctions' && (
          <PulsePanel title="OFAC / BIS sanctioned entities">
            {sanctions.sdnCount !== null ? (
              <>
                <p className="text-sm text-ink-muted">
                  <span className="font-semibold text-ink">{sanctions.sdnCount}</span> entries on OFAC's Specially Designated Nationals list and{' '}
                  <span className="font-semibold text-ink">{sanctions.cslCount}</span> on the Commerce/State Consolidated Screening List have an address
                  naming {name}.
                </p>
                <p className="mt-2 text-xs text-ink-faint">{sanctions.note}</p>
                <Link to={`/influence?tab=sanctions&country=${encodeURIComponent(name)}`} className="mt-3 inline-block text-sm font-semibold text-accent hover:underline">
                  Browse these entries &rarr;
                </Link>
              </>
            ) : (
              <p className="text-sm text-ink-faint">{sanctions.note}</p>
            )}
          </PulsePanel>
        )}

        {tab === 'markets' && (
          <div className="flex flex-col gap-6">
            {fxRow && (
              <PulsePanel title={`USD / ${fxRow.quote}`} subtitle={currency === 'EUR' ? 'A Eurozone-wide rate, not specific to this country.' : undefined}>
                <p className="text-3xl font-bold tabular-nums text-ink">{fxRow.rate.toFixed(4)}</p>
                {fxRow.change30dPct !== null && (
                  <p className="mt-1 text-sm text-ink-faint">{fxRow.change30dPct >= 0 ? 'Up' : 'Down'} {Math.abs(fxRow.change30dPct).toFixed(1)}% vs. 30 days ago.</p>
                )}
              </PulsePanel>
            )}
            <PulsePanel title={`Recent news naming ${name}`}>
              {countryNews.length === 0 ? (
                <p className="text-sm text-ink-faint">No recent headlines name {name} in this app's news feed.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {countryNews.map((n) => (
                    <li key={n.id} className="flex gap-3 border-b border-hairline pb-3 last:border-0 last:pb-0">
                      <NewsThumb src={n.image_url} className="h-14 w-14" />
                      <div className="min-w-0">
                        <div className="text-xs text-ink-faint">
                          {n.source}, {timeAgo(n.published_at)}
                        </div>
                        <a href={n.url} target="_blank" rel="noreferrer" className="block text-sm leading-snug text-ink no-underline hover:text-accent">
                          {n.title}
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </PulsePanel>
          </div>
        )}
      </div>
    </div>
  );
}
