import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getOpinion, getPower, type OpinionResponse, type PowerResponse } from '../lib/api';
import { AfricaAtlas } from '../components/AfricaAtlas';
import { AfricaPanel } from '../components/AfricaPanel';
import { AttitudesPanel } from '../components/AttitudesPanel';
import { IndicatorExplorer } from '../components/IndicatorExplorer';
import { LanguageTies } from '../components/LanguageTies';
import { LeftOut } from '../components/LeftOut';
import { ResourceGap } from '../components/ResourceGap';
import { SectionHeader } from '../components/SectionHeader';
import { SectionTabs } from '../components/SectionTabs';
import { SoftPowerHero } from '../components/SoftPowerHero';
import { UnAlignmentGlobe } from '../components/UnAlignmentGlobe';
import { CountryCompare } from './CountryCompare';
import { POWER_CODES } from '../lib/powerCountries';
import { POWER_TERMS } from '../lib/pulseGlossary';
import { SOFT_TABS, softTabFrom, type SoftTabId } from '../lib/powerTabs';

const byDimension = (data: PowerResponse | null, ...dims: string[]) => (data?.indicators ?? []).filter((i) => dims.includes(i.dimension));
// Aid a country receives is the receiving side of foreign policy, so it sits with aid given rather than with cultural exchange.
const isAidReceived = (id: string) => id.startsWith('oda_received');

const Item = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex min-w-0 flex-col border-t-4 border-ink p-4">
    <h2 className="font-sans text-[13px] font-semibold tracking-normal text-ink">{label}</h2>
    <div className="mt-2 flex-1">{children}</div>
  </div>
);

// Soft power: what draws people to a country, in Joseph Nye's terms resting on its culture, its political values and its foreign
// policy, and best tested by what people in other countries actually say. Every figure carries its value, unit, year, source and
// caveat. Resources (what a country has) and outcomes (what people say) are shown apart, and nothing is combined into a score.
export function SoftPower() {
  const [data, setData] = useState<PowerResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [opinion, setOpinion] = useState<OpinionResponse | null>(null);
  const [opinionYear, setOpinionYear] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const [params, setParams] = useSearchParams();
  const tab = softTabFrom(params.get('tab'));
  const setTab = (id: SoftTabId, reveal = false) => {
    const next = new URLSearchParams(params);
    if (id === 'overview') next.delete('tab');
    else next.set('tab', id);
    setParams(next, { replace: true });
    if (reveal) requestAnimationFrame(() => document.getElementById('soft-tabs')?.scrollIntoView({ block: 'start' }));
  };
  // Countries highlighted in the opinion charts; the Compare tab edits the same list.
  const codes = useMemo(() => {
    const picked = (params.get('countries') ?? '')
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter((c) => POWER_CODES.includes(c));
    return picked.length > 0 ? [...new Set(picked)].slice(0, 4) : ['US', 'CN'];
  }, [params]);

  useEffect(() => {
    let cancelled = false;
    getPower(['US', 'CN'])
      .then((r) => !cancelled && setData(r))
      .catch(() => !cancelled && setFailed(true));
    getOpinion()
      .then((r) => !cancelled && setOpinion(r))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const latestYear = opinion && opinion.surveys.length > 0 ? Math.max(...opinion.surveys.map((x) => x.year)) : null;
  const year = opinionYear ?? latestYear;
  const loading = !data && !failed;
  const loaded = !!data?.loaded;
  const notLoaded = (
    <p className="max-w-xl text-sm leading-relaxed text-ink-muted">
      {failed ? "Couldn't load the country indicators. Please try again in a moment." : loading ? 'Loading…' : "The country indicators haven't been loaded yet. They are collected once a week, so this will fill in after the next update."}
    </p>
  );

  return (
    <div>
      <SoftPowerHero indicators={loaded ? data!.indicators : null} opinion={opinion} onExplore={() => setTab('attitudes', true)} />

      <div className="relative mx-auto mt-0 max-w-7xl px-4 pb-8">
        <SectionTabs tabs={SOFT_TABS} active={tab} onChange={(id) => setTab(id)} idPrefix="soft" label="Soft Power sections" />

        <div role="tabpanel" id="soft-tabpanel" aria-labelledby={`soft-tab-${tab}`} className="pt-6">
          {tab === 'overview' && (
            <div className="flex flex-col gap-6">
              <div className="card grid grid-cols-1 divide-y divide-hairline overflow-hidden sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3 lg:divide-x">
                <Item label="What people say">
                  <p className="text-[15px] leading-snug text-ink">
                    Pew polls 24 to 37 countries a year on views of the U.S. and China; Afrobarometer asks 38 African countries whose influence is positive.
                  </p>
                  <button type="button" onClick={() => setTab('attitudes', true)} className="mt-3 text-[13px] text-accent hover:underline">
                    Open Attitudes
                  </button>
                </Item>
                <Item label="What draws people in">
                  <p className="text-[15px] leading-snug text-ink">Students, tourists, migrants, researchers and Nobel laureates: the footprints of attraction, by country and year.</p>
                  <button type="button" onClick={() => setTab('culture', true)} className="mt-3 text-[13px] text-accent hover:underline">
                    Open Culture & exchange
                  </button>
                </Item>
                <Item label="What a country gives and how it votes">
                  <p className="text-[15px] leading-snug text-ink">Aid, humanitarian funding, refugees sheltered, and how closely each country votes with the U.S., China or Russia at the UN.</p>
                  <button type="button" onClick={() => setTab('foreign', true)} className="mt-3 text-[13px] text-accent hover:underline">
                    Open Foreign policy & aid
                  </button>
                </Item>
              </div>
              <div className="max-w-3xl text-sm leading-relaxed text-ink-muted">
                <p>
                  Soft power is the ability to get others to want what you want through attraction rather than payment or force. Scholars say it rests on three things: a country's culture where it appeals
                  to others, its political values when it lives up to them, and its foreign policy when others see it as legitimate. Surveys of what people actually think are the best test, so they come
                  first here, and what a country has is shown apart from what people say about it.
                </p>
                <p className="mt-2">
                  There is no combined score: indices that add these up hide their weights. For the coercive side (sanctions, tariffs, the dollar, defense), see{' '}
                  <Link to="/hard-power" className="text-accent hover:underline">
                    Hard Power
                  </Link>
                  .
                </p>
              </div>
            </div>
          )}

          {tab === 'attitudes' && (
            <div className="flex flex-col gap-5">
              <SectionHeader
                title="Attitudes: what people say"
                description="The test of soft power is whether people feel drawn to a country. These are published survey results, each shown on its own, never averaged across pollsters and never extended to countries nobody asked."
              />
              {opinion && year ? (
                <>
                  <AttitudesPanel data={opinion} year={year} onYear={setOpinionYear} codes={codes} showTable={showTable} />
                  <AfricaPanel data={opinion.africa} codes={codes} showTable={showTable} />
                  <AfricaAtlas data={opinion.africa} />
                  {loaded && <ResourceGap indicators={data!.indicators} opinion={opinion} year={year} codes={codes} />}
                  <label className="flex items-center gap-2 text-[13px] text-ink-muted">
                    <input type="checkbox" checked={showTable} onChange={(e) => setShowTable(e.target.checked)} /> Show every figure as a table
                  </label>
                </>
              ) : (
                <p className="text-sm text-ink-faint">Loading…</p>
              )}
            </div>
          )}

          {tab === 'culture' && (
            <div className="flex flex-col gap-8">
              <SectionHeader title="Culture and exchange" description="Where people study, visit, move and publish together, and the research a country is known for. These are footprints of attraction, not proof of it." />
              {loaded ? (
                <>
                  <IndicatorExplorer
                    heading="Ties and exchange"
                    blurb="The people, money and visits that connect a country to others."
                    indicators={byDimension(data, 'culture', 'ties').filter((i) => !isAidReceived(i.id))}
                  />
                  <IndicatorExplorer heading="Knowledge and technology" blurb="Research, innovation and recognition that other countries want to be near." indicators={byDimension(data, 'knowledge')} />
                </>
              ) : (
                notLoaded
              )}
              <LanguageTies />
            </div>
          )}

          {tab === 'values' && (
            <div className="flex flex-col gap-8">
              <SectionHeader title="Political values" description="How each country's governance is rated. Attraction rests on values that a country lives up to at home." />
              {loaded ? (
                <IndicatorExplorer
                  heading="Governance indicators"
                  blurb="The World Bank's Worldwide Governance Indicators combine many expert and survey sources. They are perceptions of governance, not verdicts."
                  indicators={byDimension(data, 'political_values')}
                />
              ) : (
                notLoaded
              )}
            </div>
          )}

          {tab === 'foreign' && (
            <div className="flex flex-col gap-8">
              <SectionHeader title="Foreign policy and aid" description="What a country gives abroad and how it votes. Legitimacy comes from policies that others see as generous and fair." />
              {loaded ? (
                <IndicatorExplorer
                  heading="Aid, humanitarian giving and refuge"
                  blurb="Official aid, humanitarian funding reported to the UN, and refugees sheltered."
                  indicators={[...byDimension(data, 'foreign_policy'), ...byDimension(data, 'ties').filter((i) => isAidReceived(i.id))]}
                />
              ) : (
                notLoaded
              )}
              <section className="flex flex-col gap-3">
                <h3 className="font-display text-xl font-bold text-ink">Voting at the United Nations</h3>
                <p className="max-w-3xl text-sm leading-relaxed text-ink-muted">How closely each country's General Assembly votes track the United States and China. A behavior, not an opinion or proof of influence.</p>
                <UnAlignmentGlobe />
              </section>
            </div>
          )}

          {tab === 'compare' && <CountryCompare view="power" embedded />}

          {tab === 'method' && (
            <div className="flex flex-col gap-8">
              <SectionHeader title="Method and gaps" description="Where each figure comes from, what it cannot tell you, and what was looked for and left out." />
              <LeftOut />
              <section>
                <h3 className="font-display text-xl font-bold text-ink">Sources and licences</h3>
                <p className="mt-1 max-w-3xl text-sm text-ink-muted">
                  Every measure names its source under its heading. Licences, citations and update schedules for all of them are on the{' '}
                  <Link to="/methodology#sources" className="text-accent hover:underline">
                    Methodology
                  </Link>{' '}
                  page. Pew figures are excerpts used with attribution; Pew bears no responsibility for the analyses or interpretations of the data presented here.
                </p>
              </section>
              <section>
                <h3 className="font-display text-xl font-bold text-ink">Terms used</h3>
                <dl className="mt-2 grid max-w-3xl gap-y-2 text-[13px] text-ink-muted">
                  {POWER_TERMS.map(([term, def]) => (
                    <div key={term}>
                      <dt className="font-semibold text-ink">{term}</dt>
                      <dd>{def}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
