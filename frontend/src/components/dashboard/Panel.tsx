import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Sparkline } from '../Sparkline';

// The shell every Dashboard panel uses: a plain title, one line on what it means, the picture, the source with its date, and a way to see
// the same numbers as a table (for screen readers and for anyone who wants the figures).

/** One color per Dashboard section, set as --dash-hue so panels, bars and trend lines pick it up. */
export const SECTION_HUE: Record<string, string> = {
  economy: 'var(--color-hue-blue)',
  trade: 'var(--color-hue-orange)',
  power: 'var(--color-hue-violet)',
  world: 'var(--color-hue-green)',
};
export const hueStyle = (section: string) => ({ '--dash-hue': SECTION_HUE[section] ?? 'var(--color-accent)' }) as React.CSSProperties;

export const pct = (n: number, digits = 1) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(digits)}%`;
export const upDown = (n: number | null, span: string) => (n == null ? '' : Math.abs(n) < 0.05 ? `unchanged ${span}` : `${n > 0 ? 'up' : 'down'} ${Math.abs(n).toFixed(1)}% ${span}`);
export const shortDate = (iso: string) => {
  const d = new Date(`${iso.length === 7 ? `${iso}-01` : iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: iso.length === 7 ? undefined : 'numeric', year: iso.length === 7 ? 'numeric' : undefined, timeZone: 'UTC' });
};
export const monthYear = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

/** A sparkline from dated points, or from plain numbers. */
export function Spark({ points, values, width = 80, height = 24, fill = false }: { points?: [string, number][]; values?: number[]; width?: number; height?: number; fill?: boolean }) {
  const pts: [number, number][] = points ? points.map(([d, v]) => [Date.parse(d), v]) : (values ?? []).map((v, i) => [i, v]);
  if (pts.length < 2 || pts.some((p) => Number.isNaN(p[0]))) return null;
  return (
    <span role="img" aria-label="Trend line" className="inline-flex">
      <Sparkline points={pts} color="var(--dash-hue, var(--color-accent))" width={width} height={height} fill={fill} />
    </span>
  );
}

export function Direction({ value, children }: { value: number | null; children: ReactNode }) {
  // Words carry the meaning; the arrow is only a visual cue.
  const arrow = value == null || Math.abs(value) < 0.05 ? '' : value > 0 ? '▲ ' : '▼ ';
  return (
    <span className="tabular-nums">
      <span aria-hidden="true">{arrow}</span>
      {children}
    </span>
  );
}

export function Panel({
  id,
  title,
  what,
  source,
  sourceUrl,
  asOf,
  more,
  limit,
  table,
  className = '',
  children,
}: {
  id: string;
  title: string;
  what: string;
  source: string;
  sourceUrl: string;
  asOf: string | null;
  more?: { to: string; label: string };
  limit?: string;
  table?: { head: string[]; rows: (string | number)[][] };
  className?: string;
  children: ReactNode;
}) {
  const external = /^https?:/.test(sourceUrl);
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={`card mb-4 flex min-w-0 break-inside-avoid scroll-mt-28 flex-col gap-3 border-t-[3px] border-t-[color:var(--dash-hue,var(--color-hairline))] p-4 ${className}`}>
      <div>
        <h2 id={`${id}-h`} className="font-display text-lg font-bold leading-tight text-ink">
          {title}
        </h2>
        <p className="mt-0.5 text-[13px] leading-snug text-ink-muted">{what}</p>
      </div>
      <div className="flex-1">{children}</div>
      {limit && <p className="text-xs leading-snug text-ink-faint">{limit}</p>}
      {table && (
        <details className="text-xs text-ink-muted">
          <summary className="cursor-pointer font-semibold text-ink-muted">See the numbers as a table</summary>
          <div className="mt-2 max-h-56 overflow-auto border border-hairline">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-paper-raised text-ink-faint">
                <tr>
                  {table.head.map((h) => (
                    <th key={h} scope="col" className="px-2 py-1 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={i} className="border-t border-hairline">
                    {r.map((c, j) => (j === 0 ? (
                      <th key={j} scope="row" className="px-2 py-1 font-normal">
                        {c}
                      </th>
                    ) : (
                      <td key={j} className="px-2 py-1 tabular-nums">
                        {c}
                      </td>
                    )))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-hairline pt-2 text-xs text-ink-faint">
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
          {asOf ? `, as of ${shortDate(asOf)}` : ''}
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

/** Horizontal bars for a ranked list. `value` is shown as text; `size` (0 to 1) is the bar length. */
export function Bars({ rows }: { rows: { label: string; text: ReactNode; size: number; note?: string }[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-2 text-[13px]">
          <span className="truncate text-ink" title={r.label}>
            {r.label}
          </span>
          <span className="h-2 bg-hairline" aria-hidden="true">
            <span className="block h-2 bg-[color:var(--dash-hue,var(--color-accent))]" style={{ width: `${Math.max(2, Math.min(100, r.size * 100))}%` }} />
          </span>
          <span className="w-24 text-right font-semibold tabular-nums text-ink">{r.text}</span>
        </li>
      ))}
    </ul>
  );
}
