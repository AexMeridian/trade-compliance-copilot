import { useState } from 'react';
import { createSnapshot } from '../lib/api';

// Freezes exactly what the chart is showing right now into its own citable
// row (see migrations/0021_schema_pulse_snapshots.sql) and hands back a
// permalink -- for a reader (e.g. a journalist) who wants to quote today's
// figure without it silently changing under them if the underlying series
// is revised or extended later. Same copy-link UX as PulseCustomize's feed
// link (clipboard, with a window.prompt fallback).
export function CiteThisButton({
  chartType,
  title,
  params,
  data,
  sourceNote,
}: {
  chartType: 'tempo' | 'markets' | 'cofer';
  title: string;
  params: unknown;
  data: unknown;
  sourceNote: string;
}) {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [permalink, setPermalink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    if (permalink) {
      // Already captured this click-session -- the button becomes a copy
      // shortcut rather than minting a fresh, identical snapshot row.
      await copyLink(permalink);
      return;
    }
    setState('loading');
    try {
      const { id } = await createSnapshot({ chart_type: chartType, title, params, data, source_note: sourceNote });
      const url = `${window.location.origin}/snapshot/${id}`;
      setPermalink(url);
      setState('idle');
      await copyLink(url);
    } catch {
      setState('error');
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt('Copy this citable link:', url);
    }
  }

  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <button type="button" onClick={handleClick} disabled={state === 'loading'} className="font-semibold text-ink-faint underline decoration-dotted hover:text-ink disabled:cursor-wait">
        {state === 'loading' ? 'Capturing…' : permalink ? 'Copy citable link' : 'Cite this chart'}
      </button>
      {copied && <span className="text-clear">Link copied</span>}
      {state === 'error' && <span className="text-stop">Couldn't capture a snapshot -- try again.</span>}
      {permalink && !copied && (
        <a href={permalink} className="text-ink-faint underline hover:text-ink">
          View snapshot
        </a>
      )}
    </span>
  );
}
