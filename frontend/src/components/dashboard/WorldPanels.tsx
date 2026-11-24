import type { TodayData, WorldDashData } from '../../lib/api';
import { COUNTRY_LABELS } from '../../lib/pulseCountries';
import { MyCountries } from '../../pages/Today';
import { Bars, Panel, shortDate } from './Panel';

// "People, politics and the world": what is coming up, the headlines by topic, where it is unsafe to travel, where displaced people and
// humanitarian money are, and natural events. Plain words, with the source and date on every panel.

export const WORLD_PANELS = [
  { id: 'upcoming', label: 'Coming up' },
  { id: 'headlines', label: 'Headlines by topic' },
  { id: 'travel', label: 'Travel warnings' },
  { id: 'events', label: 'Earthquakes, storms and fires' },
  { id: 'displacement', label: 'Refugees' },
  { id: 'humanitarian', label: 'Humanitarian aid' },
];

const NAME_FIX: Record<string, string> = { US: 'United States', HK: 'Hong Kong', MO: 'Macao', PS: 'Palestine' };
const name = (cc: string) => NAME_FIX[cc] ?? COUNTRY_LABELS[cc] ?? cc;
const compact = (v: number) => (v >= 1e9 ? `${(v / 1e9).toFixed(1)} billion` : v >= 1e6 ? `${(v / 1e6).toFixed(1)} million` : v >= 1e3 ? `${Math.round(v / 1e3)},000`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : String(Math.round(v)));
const usd = (v: number) => (v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `$${Math.round(v / 1e6)}M` : `$${Math.round(v).toLocaleString('en-US')}`);

export function WorldSection({ world, today, chosen, show }: { world: WorldDashData | null; today: TodayData | null; chosen: string[]; show: (id: string) => boolean }) {
  const events = today?.events;
  const travel = world?.travel;
  const maxRef = world?.displacement ? Math.max(...world.displacement.top.map((t) => t.count), 1) : 1;
  const maxHum = world?.humanitarian ? Math.max(...world.humanitarian.top.map((t) => t.usd), 1) : 1;
  const maxLevel = travel ? Math.max(...travel.counts.map((c) => c.countries), 1) : 1;
  const LEVEL: Record<number, string> = { 1: 'Level 1: normal precautions', 2: 'Level 2: be more careful', 3: 'Level 3: reconsider travel', 4: 'Level 4: do not travel' };

  return (
    <div className="flex flex-col gap-6">
      {chosen.length > 0 && today && <MyCountries codes={chosen} data={today} />}
      <div className="gap-4 md:columns-2 xl:columns-3">
        {world && world.upcoming.length > 0 && show('upcoming') && (
          <Panel id="upcoming" title="Coming up" what="Dates in the next two months when a public comment period ends or a new U.S. trade rule takes effect." source="Federal Register" sourceUrl="https://www.federalregister.gov/" asOf={null} table={{ head: ['Date', 'What happens', 'Notice'], rows: world.upcoming.map((u) => [u.date, u.kind, u.title]) }}>
            <ul className="flex flex-col gap-2.5 text-[13px] leading-snug">
              {world.upcoming.map((u) => (
                <li key={`${u.url}-${u.kind}`}>
                  <p className="text-xs font-semibold text-ink-muted">
                    {shortDate(u.date)} · {u.kind}
                  </p>
                  <a href={u.url} target="_blank" rel="noreferrer" className="text-ink underline">
                    {u.title}
                  </a>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {world && world.headlines.length > 0 && show('headlines') && (
          <Panel id="headlines" title="Headlines by topic" what="The latest stories from the news outlets and official feeds this site follows, grouped by topic." source="News outlets, listed on each item" sourceUrl="/methodology" asOf={world.headlines[0].items[0]?.date ?? null} limit="Headlines are the outlets' own words; the site does not rate them.">
            <div className="flex flex-col gap-4">
              {world.headlines.map((h) => (
                <div key={h.topic}>
                  <h3 className="text-sm font-bold text-ink">{h.topic}</h3>
                  <ul className="mt-1 flex flex-col gap-1.5 text-[13px] leading-snug">
                    {h.items.map((n) => (
                      <li key={n.url}>
                        <a href={n.url} target="_blank" rel="noreferrer" className="text-ink underline">
                          {n.title}
                        </a>{' '}
                        <span className="text-xs text-ink-faint">
                          {n.source}, {shortDate(n.date)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {travel && show('travel') && (
          <Panel id="travel" title="Travel warnings" what="How the U.S. State Department rates each country for travel, from 1 (normal) to 4 (do not travel)." source="U.S. Department of State" sourceUrl="https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html" asOf={travel.asOf} table={{ head: ['Level', 'Countries'], rows: travel.counts.map((c) => [LEVEL[c.level], c.countries]) }}>
            <Bars rows={travel.counts.map((c) => ({ label: LEVEL[c.level].split(':')[0], size: c.countries / maxLevel, text: String(c.countries) }))} />
            <p className="mb-1 mt-3 text-xs font-semibold text-ink-muted">Do not travel (Level 4), most recently updated first</p>
            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
              {travel.level4.map((a) => (
                <li key={a.country}>
                  <a href={a.url} target="_blank" rel="noreferrer" className="text-ink underline">
                    {name(a.country.toUpperCase())}
                  </a>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {events && show('events') && (
          <Panel id="events" title="Earthquakes, storms and fires" what="The strongest earthquakes of the past week, and storms, volcanoes, wildfires and floods that are active now." source={events.source} sourceUrl={events.sourceUrl} asOf={events.asOf}>
            <ul className="flex flex-col gap-2 text-[13px] leading-snug">
              {events.data.map((e) => (
                <li key={e.url}>
                  <a href={e.url} target="_blank" rel="noreferrer" className="text-ink underline">
                    {e.title}
                  </a>{' '}
                  <span className="text-xs text-ink-faint">
                    {e.kind === 'earthquake' ? '' : `${e.kind}, `}
                    {shortDate(e.date)}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {world?.displacement && show('displacement') && (
          <Panel id="displacement" title="Where refugees live" what="The countries that shelter the most refugees." source="UN refugee agency (UNHCR)" sourceUrl="https://www.unhcr.org/refugee-statistics" asOf={`${world.displacement.year}-12-31`} more={{ to: '/soft-power', label: 'Soft Power: people on the move' }} table={{ head: ['Country', 'Refugees'], rows: world.displacement.top.map((t) => [name(t.cc), t.count.toLocaleString('en-US')]) }} limit="Counts people recognized as refugees, not everyone who has been displaced.">
            <p className="mb-2 text-[13px] text-ink-muted">
              <span className="display text-2xl tabular-nums text-ink">{compact(world.displacement.total)}</span> refugees counted worldwide.
            </p>
            <Bars rows={world.displacement.top.map((t) => ({ label: name(t.cc), size: t.count / maxRef, text: compact(t.count) }))} />
          </Panel>
        )}

        {world?.humanitarian && show('humanitarian') && (
          <Panel id="humanitarian" title="Who gives humanitarian aid" what="The countries that give the most money for emergency relief, such as food and shelter after a crisis." source="UN Office for the Coordination of Humanitarian Affairs" sourceUrl="https://fts.unocha.org/" asOf={`${world.humanitarian.year}-12-31`} more={{ to: '/soft-power', label: 'Soft Power: aid' }} table={{ head: ['Country', 'Dollars given'], rows: world.humanitarian.top.map((t) => [name(t.cc), usd(t.usd)]) }}>
            <p className="mb-2 text-[13px] text-ink-muted">
              <span className="display text-2xl tabular-nums text-ink">{usd(world.humanitarian.total)}</span> given by all donors in {world.humanitarian.year}.
            </p>
            <Bars rows={world.humanitarian.top.map((t) => ({ label: name(t.cc), size: t.usd / maxHum, text: usd(t.usd) }))} />
          </Panel>
        )}
      </div>
    </div>
  );
}
