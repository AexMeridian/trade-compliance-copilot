import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getActiveMeasures, getPulseFeed, getPulseSummary, getPulseTempo, syncPulse } from '../lib/api';
import { ActiveMeasuresTable } from '../components/ActiveMeasuresTable';
import { PulseAgencyBreakdown } from '../components/PulseAgencyBreakdown';
import { PulseCountryBreakdown } from '../components/PulseCountryBreakdown';
import { PulseFeedList } from '../components/PulseFeedList';
import { PulseGlossary } from '../components/PulseGlossary';
import { PulsePanel } from '../components/PulsePanel';
import { PulseSignalStrip } from '../components/PulseSignalStrip';
import { PulseTempoChart } from '../components/PulseTempoChart';
import { PulseTicker } from '../components/PulseTicker';
import { PulseTopSignals } from '../components/PulseTopSignals';
import { COUNTRY_LABELS } from '../lib/pulseCountries';
import type { ActiveMeasure, PulseAction, PulseSummary, PulseTag, TempoPoint } from '../types/pulse';

const TAGS: PulseTag[] = ['Tariff', 'Sanctions', 'Export Control', 'Trade Agreement', 'Other'];

// Ranking/ticker material -- a wider, unfiltered sample than the browsable
// feed's default page, fetched once and independent of the tag filter below
// (both the ticker and the top-signals panel need the full category mix).
const SIGNAL_SAMPLE_SIZE = 60;

export function Pulse() {
  const [actions, setActions] = useState<PulseAction[]>([]);
  const [recentAll, setRecentAll] = useState<PulseAction[]>([]);
  const [months, setMonths] = useState<TempoPoint[]>([]);
  const [overlays, setOverlays] = useState<ActiveMeasure[]>([]);
  const [summary, setSummary] = useState<PulseSummary | null>(null);
  const [activeTag, setActiveTag] = useState<PulseTag | null>(null);
  const [activeCountry, setActiveCountry] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [loadingPanels, setLoadingPanels] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Typing shouldn't fire a request per keystroke -- wait for a short pause.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const loadFeed = useCallback(async (tag: PulseTag | null, country: string | null, q: string) => {
    const { actions } = await getPulseFeed(30, tag ?? undefined, { country: country ?? undefined, search: q || undefined });
    setActions(actions);
  }, []);

  // Every number and ranking on this page comes from plain SQL aggregation
  // (routes/pulse.ts's /summary) or plain client-side sort/group (see
  // lib/pulseGrouping.ts) over data already fetched here -- no Anthropic
  // call, no extra request per stat.
  const loadPanels = useCallback(async () => {
    const [tempo, overlaysRes, summaryRes, recentRes] = await Promise.all([
      getPulseTempo(),
      getActiveMeasures(),
      getPulseSummary(),
      getPulseFeed(SIGNAL_SAMPLE_SIZE),
    ]);
    setMonths(tempo.months);
    setOverlays(overlaysRes.overlays);
    setSummary(summaryRes);
    setRecentAll(recentRes.actions);
  }, []);

  // Tempo/active-measures/summary/signal-sample aren't affected by the tag
  // filter, so they load once on mount, independently of the feed -- a tag
  // click below only refetches the feed, not everything else.
  useEffect(() => {
    setLoadingPanels(true);
    loadPanels()
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoadingPanels(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Runs on mount (initial feed load) and again whenever a tag, country, or
  // search filter changes, independently of the effect above -- one panel's
  // fetch failing doesn't clear data another panel already loaded, it only
  // reports its own error.
  useEffect(() => {
    setLoadingFeed(true);
    loadFeed(activeTag, activeCountry, search)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoadingFeed(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTag, activeCountry, search]);

  async function handleRefresh() {
    setSyncing(true);
    setError(null);
    try {
      await syncPulse();
      // A sync can touch every table this page reads, so refresh everything
      // together here -- unlike the tag-filter click above, this is one
      // user-initiated action where "did it fully refresh" matters more
      // than isolating each panel's fetch.
      await Promise.all([loadFeed(activeTag, activeCountry, search), loadPanels()]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  // Client-side CSV of exactly what's currently loaded in the feed (same
  // filtered set the person is looking at) -- no new backend route, the
  // data's already here. Quotes/commas in title or abstract text are escaped
  // per RFC 4180 (double the quotes, wrap the field), not stripped.
  function exportCsv() {
    const cols: (keyof PulseAction)[] = [
      'publication_date',
      'title',
      'doc_type',
      'tag',
      'agency',
      'citation',
      'effective_on',
      'comments_close_on',
      'html_url',
    ];
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [cols.join(','), ...actions.map((a) => cols.map((c) => escape(a[c])).join(','))].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trade-policy-pulse-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const lastSynced = recentAll.reduce<string | null>((latest, a) => (!latest || a.fetched_at > latest ? a.fetched_at : latest), null);

  const TagFilter = (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => setActiveTag(null)}
        aria-pressed={activeTag === null}
        className={`border px-2.5 py-1 text-xs ${activeTag === null ? 'border-accent text-accent' : 'border-hairline-strong text-ink-muted hover:text-ink'}`}
      >
        All
      </button>
      {TAGS.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => setActiveTag(tag)}
          aria-pressed={activeTag === tag}
          className={`border px-2.5 py-1 text-xs ${activeTag === tag ? 'border-accent text-accent' : 'border-hairline-strong text-ink-muted hover:text-ink'}`}
        >
          {tag}
        </button>
      ))}
      {activeCountry && (
        <button
          type="button"
          onClick={() => setActiveCountry(null)}
          className="border border-accent px-2.5 py-1 text-xs text-accent"
        >
          {COUNTRY_LABELS[activeCountry] ?? activeCountry} &times;
        </button>
      )}
      <input
        type="search"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder="Search title or abstract"
        className="ml-auto w-48 border border-hairline-strong bg-paper px-2.5 py-1 font-sans text-xs text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
      />
      <button
        type="button"
        onClick={exportCsv}
        disabled={actions.length === 0}
        className="border border-hairline-strong px-2.5 py-1 font-mono text-xs text-ink-muted hover:border-accent hover:text-accent disabled:opacity-50"
      >
        Export CSV
      </button>
    </div>
  );

  return (
    <div>
      <PulseTicker actions={recentAll} lastSynced={lastSynced} />

      <div className="mx-auto max-w-5xl px-4 py-6 font-sans">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-5">
          <div>
            <h1 className="font-serif text-3xl font-semibold text-ink sm:text-4xl">Trade Policy Pulse</h1>
            <p className="mt-1.5 max-w-xl text-sm text-ink-muted">
              A running record of the tariffs, sanctions, and export rules the U.S. government publishes -- new
              entries the moment the Federal Register posts them, with the legal detail underneath for anyone who
              needs it.
            </p>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs text-ink-faint">
            <span>{lastSynced ? `Last synced ${new Date(lastSynced).toLocaleString()}` : 'Not yet synced'}</span>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={syncing}
              className="border border-hairline-strong px-3 py-1.5 font-sans text-xs text-ink hover:border-accent hover:text-accent disabled:opacity-50"
            >
              {syncing ? 'Refreshing…' : 'Refresh now'}
            </button>
          </div>
        </div>

        {error && (
          <p className="mb-4 border border-stop bg-stop-soft px-3 py-2 font-sans text-sm text-stop">
            Couldn't refresh -- showing last-synced data. ({error})
          </p>
        )}

        <PulseGlossary />

        <div className="grid grid-cols-1 gap-px bg-hairline lg:grid-cols-12">
          <div className="lg:col-span-12">
            {loadingPanels || !summary ? (
              <div className="border border-hairline bg-paper py-6 text-center font-sans text-sm text-ink-faint">Loading…</div>
            ) : (
              <PulseSignalStrip summary={summary} activeMeasureCount={overlays.length} />
            )}
          </div>

          <div className="min-w-0 lg:col-span-8">
            <PulsePanel
              title="What matters most"
              subtitle="Standalone actions only (not part of a routine batch), ranked by document type and recency. Plain sort, not a model's judgment call."
            >
              {loadingPanels ? <p className="font-sans text-sm text-ink-faint">Loading…</p> : <PulseTopSignals actions={recentAll} />}
            </PulsePanel>
          </div>
          <div className="grid min-w-0 gap-px bg-hairline lg:col-span-4">
            <PulsePanel title="Activity by agency" subtitle="Primary agency, last 30 days.">
              {loadingPanels ? (
                <p className="font-sans text-sm text-ink-faint">Loading…</p>
              ) : (
                <PulseAgencyBreakdown breakdown={summary?.agencyBreakdown ?? []} />
              )}
            </PulsePanel>
            <PulsePanel title="Activity by country" subtitle="Named in the text, last 30 days -- best-effort, not authoritative.">
              {loadingPanels ? (
                <p className="font-sans text-sm text-ink-faint">Loading…</p>
              ) : (
                <PulseCountryBreakdown
                  breakdown={summary?.countryBreakdown ?? []}
                  activeCountry={activeCountry}
                  onSelect={setActiveCountry}
                />
              )}
            </PulsePanel>
          </div>

          <div className="min-w-0 lg:col-span-8">
            <PulsePanel title="Full activity">
              {TagFilter}
              {loadingFeed ? (
                <p className="font-sans text-sm text-ink-faint">Loading…</p>
              ) : (
                <div className="max-h-[36rem] overflow-y-auto pr-1">
                  <PulseFeedList actions={actions} />
                </div>
              )}
            </PulsePanel>
          </div>
          <div className="grid min-w-0 gap-px bg-hairline lg:col-span-4">
            <PulsePanel title="Active measures" subtitle="Section 232 / 301 / 338 overlays currently in force.">
              {loadingPanels ? <p className="font-sans text-sm text-ink-faint">Loading…</p> : <ActiveMeasuresTable overlays={overlays} />}
            </PulsePanel>
            <PulsePanel title="Policy tempo" subtitle="Actions published per month, last 24 months.">
              {loadingPanels ? (
                <p className="font-sans text-sm text-ink-faint">Loading…</p>
              ) : (
                <PulseTempoChart months={months} trendPct={summary?.trendPct ?? null} />
              )}
            </PulsePanel>
          </div>
        </div>

        <Link
          to="/calculator"
          className="mt-6 flex items-center justify-between border border-hairline-strong px-4 py-3 no-underline hover:border-accent"
        >
          <span>
            <span className="font-sans text-sm text-ink">Compliance calculator</span>
            <span className="ml-2 font-sans text-xs text-ink-faint">
              Classify a shipment through HTS, USMCA origin, denied-party screening, and duty determination.
            </span>
          </span>
          <span className="shrink-0 font-mono text-xs text-ink-muted">Run a case</span>
        </Link>
      </div>
    </div>
  );
}
