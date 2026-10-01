import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getSnapshot, type PulseSnapshot } from '../lib/api';
import { PulseTempoChart } from '../components/PulseTempoChart';
import { PulseLineChart, type LineSeries } from '../components/PulseCharts';
import { PowerCoferChart } from '../components/PowerCoferChart';
import type { TempoPoint } from '../types/pulse';

function friendlyTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';
}

function Chart({ snapshot }: { snapshot: PulseSnapshot }) {
  if (snapshot.chart_type === 'tempo') {
    const data = snapshot.data as { months: TempoPoint[]; trendPct: number | null };
    return <PulseTempoChart months={data.months} trendPct={data.trendPct} />;
  }
  if (snapshot.chart_type === 'markets') {
    const data = snapshot.data as { series: LineSeries[] };
    return <PulseLineChart series={data.series} />;
  }
  const data = snapshot.data as { points: [string, number][] };
  return <PowerCoferChart points={data.points} />;
}

// A frozen, never-updating view of one chart's data at the moment someone
// clicked "Cite this chart" (see CiteThisButton.tsx) -- the same chart
// component the live page uses, fed the saved data instead of a fresh fetch,
// with no range selector (there's nothing to re-range: this is the one
// window that was captured). See migrations/0021_schema_pulse_snapshots.sql.
export function Snapshot() {
  const { id = '' } = useParams();
  const [snapshot, setSnapshot] = useState<PulseSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [citationCopied, setCitationCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSnapshot(id)
      .then((s) => {
        if (!cancelled) setSnapshot(s);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Snapshot not found.');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="display text-2xl text-ink">Snapshot not found</h1>
        <p className="mt-2 text-sm text-ink-muted">{error} It may have been mistyped, or this link is simply wrong.</p>
      </div>
    );
  }
  if (!snapshot) {
    return <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-ink-faint">Loading snapshot…</div>;
  }

  const permalink = window.location.href;
  const citationText = `Aex Terminal, "${snapshot.title}," captured ${friendlyTimestamp(snapshot.created_at)}. ${snapshot.source_note} ${permalink}`;

  async function copyCitation() {
    try {
      await navigator.clipboard.writeText(citationText);
      setCitationCopied(true);
      window.setTimeout(() => setCitationCopied(false), 2500);
    } catch {
      window.prompt('Copy this citation:', citationText);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="card border-l-4 border-l-hue-violet p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-hue-violet-ink">Frozen snapshot -- will not update</p>
        <p className="mt-1 text-sm text-ink-muted">
          Captured {friendlyTimestamp(snapshot.created_at)}. This is an exact, saved copy of the chart below as it looked at that moment -- unlike every
          other chart on this site, it will never change, even as new data comes in. <a href="/" className="text-accent hover:underline">View the live, up-to-date version</a>.
        </p>
      </div>

      <h1 className="display mt-6 text-2xl text-ink">{snapshot.title}</h1>
      <div className="card mt-3 p-4">
        <Chart snapshot={snapshot} />
      </div>

      <div className="mt-6">
        <h2 className="font-display text-base font-bold text-ink">Cite this</h2>
        <p className="mt-1 text-sm text-ink-muted">{snapshot.source_note}</p>
        <div className="mt-2 flex flex-col gap-2 border border-hairline bg-paper-raised p-3 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <code className="break-all text-[13px]">{citationText}</code>
          <button type="button" onClick={copyCitation} className="btn shrink-0">
            {citationCopied ? 'Copied' : 'Copy citation'}
          </button>
        </div>
      </div>
    </div>
  );
}
