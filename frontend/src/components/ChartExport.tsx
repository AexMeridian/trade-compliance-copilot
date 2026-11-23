import { useEffect, useRef, useState } from 'react';
import { downloadPng, downloadSvg, findChartSvg, slugify, type ExportMeta } from '../lib/chartExport';

// "Save PNG", "Save SVG" and "Copy link" for the chart that sits in the same card. It finds the chart by itself (the largest chart-like SVG in
// the nearest card or section), so any chart with a ChartFooter gets it with no extra wiring, and it renders nothing when there is no chart.
// The image carries the chart's title, source and as-of date. The link is this page's address (the page's own query string already holds the
// tab, country and other choices) plus an anchor on the chart's card, so a reader lands on the chart. `state` adds choices that are not in the URL.
export function ChartExport({ source, asOf, title, id, state }: { source: string; asOf?: string; title?: string; id?: string; state?: Record<string, string | undefined> }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [has, setHas] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const card = () => ref.current?.closest('section, article, [data-chart-card]') ?? ref.current?.parentElement?.parentElement ?? null;
  const chartTitle = () => {
    const c = card();
    const heading = c?.querySelector('h1, h2, h3, h4')?.textContent?.trim();
    return (title ?? heading ?? findChartSvg(c)?.getAttribute('aria-label')?.split('.')[0] ?? document.title).slice(0, 140);
  };

  useEffect(() => {
    const c = card();
    if (!c) return;
    const check = () => setHas(!!findChartSvg(c));
    check();
    const mo = new MutationObserver(check);
    mo.observe(c, { childList: true, subtree: true });
    // Give the card its anchor, and scroll to it when the page was opened from a chart link.
    const anchor = id ?? `chart-${slugify(chartTitle())}`;
    if (!c.id) {
      let n = 1;
      let candidate = anchor;
      while (document.getElementById(candidate)) candidate = `${anchor}-${++n}`;
      c.id = candidate;
    }
    if (window.location.hash === `#${c.id}`) c.scrollIntoView({ block: 'start' });
    return () => mo.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function permalink(): string {
    const c = card();
    const url = new URL(window.location.href);
    for (const [k, v] of Object.entries(state ?? {})) if (v !== undefined) url.searchParams.set(k, v);
    url.hash = c?.id ?? '';
    return url.toString();
  }
  function meta(): ExportMeta {
    return { title: chartTitle(), source, asOf, url: permalink() };
  }
  const fileBase = () => `aex-terminal-${slugify(chartTitle())}${asOf ? `-${asOf}` : ''}`;

  async function run(kind: 'png' | 'svg') {
    const svg = findChartSvg(card());
    if (!svg) return;
    setBusy(true);
    setStatus('');
    try {
      if (kind === 'png') await downloadPng(svg, meta(), fileBase());
      else downloadSvg(svg, meta(), fileBase());
      setStatus(`${kind.toUpperCase()} saved`);
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    const url = permalink();
    try {
      await navigator.clipboard.writeText(url);
      setStatus('Link to this chart copied');
    } catch {
      window.prompt('Copy this link to the chart:', url);
    }
  }

  const btn = 'font-semibold text-ink-muted underline hover:text-ink disabled:cursor-wait disabled:opacity-60';
  return (
    <span ref={ref} data-chart-export-ui className={`${has ? 'inline-flex' : 'hidden'} flex-wrap items-center gap-x-4 gap-y-1`}>
      <button type="button" className={btn} disabled={busy} onClick={() => run('png')} aria-label="Download this chart as a PNG image with its source and date">
        Save PNG
      </button>
      <button type="button" className={btn} disabled={busy} onClick={() => run('svg')} aria-label="Download this chart as an SVG file with its source and date">
        Save SVG
      </button>
      <button type="button" className={btn} onClick={copy} aria-label="Copy a link to this chart">
        Copy chart link
      </button>
      <span role="status" aria-live="polite" className="text-clear empty:hidden">
        {status}
      </span>
    </span>
  );
}
