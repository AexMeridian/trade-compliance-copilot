import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Skeleton } from '../components/Skeleton';
import { Sparkline } from '../components/Sparkline';
import { getToday, type TodayData } from '../lib/api';
import { COUNTRY_LABELS } from '../lib/pulseCountries';

// "Today": one plain-English page for "what is going on right now". Everything on it comes from the sources the rest of the site uses;
// the sentences at the top are filled-in templates (no AI), every card names its source and date, and nothing here is advice.

const STORE = 'today-countries';
const MAX_COUNTRIES = 5;

const pct = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(1)}%`;
const word = (n: number) => (n >= 0 ? 'up' : 'down');
export const dateLabel = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const monthYear = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

export function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (mins < 2) return 'just now';
  if (mins < 90) return `${mins} minutes ago`;
  const hours = Math.round(mins / 60);
  return hours < 36 ? `${hours} hours ago` : `${Math.round(hours / 24)} days ago`;
}

function readStored(): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(STORE) ?? '[]');
    return Array.isArray(v) ? v.filter((c) => typeof c === 'string' && COUNTRY_LABELS[c]).slice(0, MAX_COUNTRIES) : [];
  } catch {
    return [];
  }
}

function Card({ id, title, source, asOf, sourceUrl, more, children }: { id: string; title: string; source: string; asOf: string | null; sourceUrl: string; more?: { to: string; label: string }; children: ReactNode }) {
  const external = /^https?:/.test(sourceUrl);
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="card flex min-w-0 scroll-mt-24 flex-col gap-3 p-4 sm:p-5">
      <h2 id={`${id}-h`} className="font-display text-xl font-bold text-ink">
        {title}
      </h2>
      <div className="flex-1">{children}</div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-hairline pt-3 text-xs text-ink-faint">
        <span>
          Source:{' '}
          {external ? (
            <a href={sourceUrl} target="_blank" rel="noreferrer" className="text-ink-muted underline">
              {source}
            </a>
          ) : (
            <Link to={sourceUrl} className="text-ink-muted underline">
              {source}
            </Link>
          )}
          {asOf ? `, as of ${dateLabel(asOf)}` : ''}
        </span>
        {more && (
          <Link to={more.to} className="font-semibold text-accent hover:underline">
            {more.label}
          </Link>
        )}
      </div>
    </section>
  );
}

function BigFigure({ figure, label }: { figure: ReactNode; label: string }) {
  return (
    <div>
      <p className="display text-4xl leading-none tabular-nums text-ink">{figure}</p>
      <p className="mt-1 text-[13px] leading-snug text-ink-muted">{label}</p>
    </div>
  );
}

export function CountryPicker({ chosen, onChange }: { chosen: string[]; onChange: (next: string[]) => void }) {
  const options = useMemo(() => Object.keys(COUNTRY_LABELS).filter((c) => c !== 'EU').sort((a, b) => COUNTRY_LABELS[a].localeCompare(COUNTRY_LABELS[b])), []);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="today-country" className="text-sm font-semibold text-ink">
        My countries
      </label>
      <select
        id="today-country"
        value=""
        disabled={chosen.length >= MAX_COUNTRIES}
        onChange={(e) => e.target.value && !chosen.includes(e.target.value) && onChange([...chosen, e.target.value])}
        className="border border-hairline-strong bg-paper-raised px-2 py-1.5 text-sm text-ink"
      >
        <option value="">{chosen.length >= MAX_COUNTRIES ? `Up to ${MAX_COUNTRIES}` : 'Add a country…'}</option>
        {options.filter((c) => !chosen.includes(c)).map((c) => (
          <option key={c} value={c}>
            {COUNTRY_LABELS[c]}
          </option>
        ))}
      </select>
      {chosen.map((c) => (
        <button key={c} type="button" onClick={() => onChange(chosen.filter((x) => x !== c))} className="rounded-full border border-hairline-strong px-3 py-1 text-sm text-ink hover:border-accent" aria-label={`Remove ${COUNTRY_LABELS[c]}`}>
          {COUNTRY_LABELS[c]} <span aria-hidden="true">×</span>
        </button>
      ))}
    </div>
  );
}

export function MyCountries({ codes, data }: { codes: string[]; data: TodayData }) {
  return (
    <section id="mine" aria-labelledby="mine-h" className="scroll-mt-24">
      <h2 id="mine-h" className="font-display text-xl font-bold text-ink">
        Your countries
      </h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {codes.map((code) => {
          const name = COUNTRY_LABELS[code];
          const notice = data.forCountries.notices.find((n) => n.countries.includes(code));
          const story = data.forCountries.news.find((n) => n.countries.includes(code));
          const adv = data.forCountries.advisories.find((a) => a.country.toUpperCase() === code);
          return (
            <div key={code} className="card flex flex-col gap-2 p-4 text-sm">
              <Link to={`/country/${code.toLowerCase()}`} className="font-display text-lg font-bold text-ink hover:underline">
                {name}
              </Link>
              {adv && (
                <p className="text-ink-muted">
                  Travel advice: <span className="font-semibold text-ink">Level {adv.level}</span> (updated {dateLabel(adv.updated)}).{' '}
                  <a href={adv.url} target="_blank" rel="noreferrer" className="underline">
                    Read it
                  </a>
                </p>
              )}
              {notice ? (
                <p className="text-ink-muted">
                  Latest U.S. trade notice ({dateLabel(notice.date)}):{' '}
                  <a href={notice.url} target="_blank" rel="noreferrer" className="text-ink underline">
                    {notice.title}
                  </a>
                </p>
              ) : (
                <p className="text-ink-faint">No recent U.S. trade notice names {name}.</p>
              )}
              {story && (
                <p className="text-ink-muted">
                  In the news ({story.source}):{' '}
                  <a href={story.url} target="_blank" rel="noreferrer" className="text-ink underline">
                    {story.title}
                  </a>
                </p>
              )}
              <Link to={`/country/${code.toLowerCase()}`} className="mt-auto pt-1 font-semibold text-accent hover:underline">
                Everything about {name}
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function useChosenCountries(): [string[], (next: string[]) => void] {
  const [params, setParams] = useSearchParams();
  const fromUrl = (params.get('c') ?? '').split(',').map((c) => c.trim().toUpperCase()).filter((c) => COUNTRY_LABELS[c]).slice(0, MAX_COUNTRIES);
  const [chosen, setChosen] = useState<string[]>(() => (fromUrl.length ? fromUrl : readStored()));
  function change(next: string[]) {
    setChosen(next);
    try {
      window.localStorage.setItem(STORE, JSON.stringify(next));
    } catch {
      /* private window: the choice just is not remembered */
    }
    setParams((prev) => {
      const n = new URLSearchParams(prev);
      if (next.length) n.set('c', next.join(','));
      else n.delete('c');
      return n;
    }, { replace: true });
  }
  return [chosen, change];
}

export function TodayBody({ data, chosen }: { data: TodayData; chosen: string[] }) {
  return (
    <div className="flex flex-col gap-8">
      {data.sentences.length > 0 && (
        <section aria-labelledby="short-h" className="card p-4 sm:p-5">
          <h2 id="short-h" className="font-display text-xl font-bold text-ink">
            The short version
          </h2>
          <ul className="mt-3 flex flex-col gap-2 text-[15px] leading-snug text-ink">
            {data.sentences.map((s) => (
              <li key={s.id}>
                <a href={`#${s.card}`} className="text-ink no-underline hover:underline">
                  {s.text}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {chosen.length > 0 && <MyCountries codes={chosen} data={data} />}

      <div className="grid gap-4 md:grid-cols-2">
        {data.trade && (
          <Card id="trade" title="Trade and tariffs" source={data.trade.source} sourceUrl={data.trade.sourceUrl} asOf={data.trade.asOf} more={{ to: '/', label: 'All trade notices' }}>
            <BigFigure figure={data.trade.data.last7} label={`new U.S. trade notices in the last 7 days${data.trade.data.last30 ? `; ${data.trade.data.last30} in the last 30` : ''}`} />
            {data.trade.data.openForComment != null && <p className="mt-2 text-[13px] text-ink-muted">{data.trade.data.openForComment} are open for public comment.</p>}
            <ul className="mt-3 flex flex-col gap-2 text-[13px] leading-snug">
              {data.trade.data.recent.map((a) => (
                <li key={a.url}>
                  <a href={a.url} target="_blank" rel="noreferrer" className="text-ink underline">
                    {a.title}
                  </a>{' '}
                  <span className="text-ink-faint">{dateLabel(a.date)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {data.prices && (
          <Card id="prices" title="Prices" source={data.prices.source} sourceUrl={data.prices.sourceUrl} asOf={data.prices.asOf} more={{ to: '/prices', label: 'Tariffs and your wallet' }}>
            <p className="mb-2 text-[13px] text-ink-muted">How much more or less these cost than about a year ago.</p>
            <ul className="flex flex-col divide-y divide-hairline">
              {data.prices.data.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-ink">{p.label}</p>
                    <p className="text-xs text-ink-faint">{p.since ? `since ${monthYear(p.since)}` : 'no comparable reading'}</p>
                  </div>
                  <Sparkline points={p.points.map(([d, v]) => [Date.parse(d), v] as [number, number])} color="var(--color-accent)" width={72} height={24} />
                  <p className="w-16 text-right text-[15px] font-semibold tabular-nums text-ink">{p.changePct == null ? '—' : pct(p.changePct)}</p>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {data.money && (
          <Card id="money" title="Money" source={data.money.source} sourceUrl={data.money.sourceUrl} asOf={data.money.asOf} more={{ to: '/hard-power', label: 'The dollar and money' }}>
            <p className="mb-2 text-[13px] text-ink-muted">How the dollar has moved against other currencies over 30 days.</p>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
              {data.money.data.currencies.map((c) => (
                <li key={c.quote} className="text-[15px]">
                  <span className="text-ink">{c.name}</span>{' '}
                  {c.change30dPct != null && (
                    <span className="font-semibold tabular-nums text-ink">
                      {word(c.change30dPct)} {Math.abs(c.change30dPct).toFixed(1)}%
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-hairline pt-3 text-[13px]">
              {data.money.data.oil && (
                <div>
                  <dt className="text-ink-faint">Oil (Brent), per barrel</dt>
                  <dd className="text-[15px] font-semibold tabular-nums text-ink">${Math.round(data.money.data.oil.value)}</dd>
                </div>
              )}
              {data.money.data.tenYearPct != null && (
                <div>
                  <dt className="text-ink-faint">U.S. 10-year borrowing rate</dt>
                  <dd className="text-[15px] font-semibold tabular-nums text-ink">{data.money.data.tenYearPct.toFixed(2)}%</dd>
                </div>
              )}
            </dl>
          </Card>
        )}

        {data.sanctions && (
          <Card id="sanctions" title="Sanctions" source={data.sanctions.source} sourceUrl={data.sanctions.sourceUrl} asOf={data.sanctions.asOf} more={{ to: '/changes', label: 'What changed' }}>
            {data.sanctions.data ? (
              <>
                <BigFigure figure={`+${data.sanctions.data.added} / −${data.sanctions.data.removed}`} label={`people and companies added to and removed from the sanctions lists on ${dateLabel(data.sanctions.data.date)}`} />
                <p className="mt-2 text-[13px] text-ink-muted">Sanctions are limits the U.S., UN and UK place on named people and companies.</p>
              </>
            ) : (
              <p className="text-[15px] text-ink-muted">No people or companies have been added to or removed from the sanctions lists since this site began comparing them each day.</p>
            )}
          </Card>
        )}

        {data.politics && (
          <Card id="politics" title="Politics and diplomacy" source={data.politics.source} sourceUrl={data.politics.sourceUrl} asOf={data.politics.asOf} more={{ to: '/', label: 'More headlines' }}>
            <ul className="flex flex-col gap-3 text-[15px] leading-snug">
              {data.politics.data.map((n) => (
                <li key={n.url}>
                  <a href={n.url} target="_blank" rel="noreferrer" className="text-ink underline">
                    {n.title}
                  </a>
                  <p className="text-xs text-ink-faint">
                    {n.source} · {dateLabel(n.date)}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {data.travel && (
          <Card id="travel" title="Travel warnings" source={data.travel.source} sourceUrl={data.travel.sourceUrl} asOf={data.travel.asOf}>
            <p className="mb-2 text-[13px] text-ink-muted">Countries the State Department tells Americans not to travel to (Level 4). {data.travel.data.level3Count} more carry a "Reconsider travel" warning (Level 3).</p>
            <ul className="flex flex-col gap-1.5 text-[15px]">
              {data.travel.data.level4.map((a) => (
                <li key={a.country}>
                  <a href={a.url} target="_blank" rel="noreferrer" className="text-ink underline">
                    {COUNTRY_LABELS[a.country.toUpperCase()] ?? a.country}
                  </a>{' '}
                  <span className="text-xs text-ink-faint">updated {dateLabel(a.updated)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {data.events && (
          <Card id="events" title="Major world events" source={data.events.source} sourceUrl={data.events.sourceUrl} asOf={data.events.asOf}>
            <p className="mb-2 text-[13px] text-ink-muted">The strongest earthquakes of the past week, and storms, volcanoes, wildfires and floods that are active now.</p>
            <ul className="flex flex-col gap-2 text-[15px] leading-snug">
              {data.events.data.map((e) => (
                <li key={e.url}>
                  <a href={e.url} target="_blank" rel="noreferrer" className="text-ink underline">
                    {e.title}
                  </a>{' '}
                  <span className="text-xs text-ink-faint">
                    {e.kind === 'earthquake' ? '' : `${e.kind}, `}
                    {dateLabel(e.date)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <p className="text-[13px] leading-snug text-ink-faint">
        This page is a summary of public data, refreshed through the day, not advice. The sentences at the top are written by fixed rules from the numbers below them. See{' '}
        <Link to="/methodology" className="underline">
          the sources and methods
        </Link>
        .
      </p>
    </div>
  );
}

export function Today() {
  const [data, setData] = useState<TodayData | null>(null);
  const [error, setError] = useState(false);
  const [chosen, change] = useChosenCountries();

  useEffect(() => {
    let cancelled = false;
    getToday()
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-8 sm:pt-12">
      <header>
        <h1 className="display text-4xl leading-tight text-ink sm:text-5xl">Today</h1>
        <p className="mt-2 text-[15px] text-ink-muted">
          {today}
          {data ? ` · updated ${ago(data.asOf)}` : ''}
        </p>
        <p className="mt-3 max-w-2xl text-[15px] leading-snug text-ink-muted">What is going on in trade, prices, money and politics right now, in plain words. Every number names its source and date.</p>
        <div className="mt-5">
          <CountryPicker chosen={chosen} onChange={change} />
        </div>
      </header>

      {error && (
        <p role="alert" className="mt-8 text-ink-muted">
          Today's numbers could not be loaded. Try again in a few minutes, or read the <Link to="/" className="underline">latest trade notices</Link>.
        </p>
      )}
      {!data && !error && (
        <div className="mt-8" aria-busy="true">
          <Skeleton rows={8} className="text-ink" />
        </div>
      )}

      {data && <TodayBody data={data} chosen={chosen} />}
    </div>
  );
}
