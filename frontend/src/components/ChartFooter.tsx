import type { ReactNode } from 'react';
import { downloadCsv } from '../lib/downloadCsv';

// The standard line under every chart or table, the way a research publication closes a figure: where the
// numbers come from, the date they are as of, a CSV download and, where it makes sense, a citable link.
export function ChartFooter({
  source,
  sourceUrl,
  asOf,
  csv,
  children,
}: {
  source: string;
  sourceUrl?: string;
  asOf?: string;
  csv?: { filename: string; header: string[]; rows: unknown[][] };
  children?: ReactNode; // for example the Cite button
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-hairline pt-2.5 text-[12px] text-ink-faint">
      <span>
        Source:{' '}
        {sourceUrl ? (
          <a href={sourceUrl} target="_blank" rel="noreferrer" className="text-ink-muted underline hover:text-ink">
            {source}
          </a>
        ) : (
          <span className="text-ink-muted">{source}</span>
        )}
      </span>
      {asOf && <span>As of {asOf}</span>}
      {csv && csv.rows.length > 0 && (
        <button type="button" onClick={() => downloadCsv(csv.filename, csv.header, csv.rows)} className="font-semibold text-ink-muted underline hover:text-ink">
          Download CSV
        </button>
      )}
      {children}
    </div>
  );
}
