import { useState } from 'react';
import type { PulseAction } from '../types/pulse';
import { RailModule } from './RailModule';

// Upcoming dates taken straight from the notices themselves: when a comment period closes and when a rule
// takes effect. Only dates that are still ahead are shown, soonest first. Nothing is predicted.
// Routine paperwork notices (OMB information-collection requests) are left out by default: their comment dates are not policy deadlines.
type Entry = { key: string; date: string; kind: 'Comments due' | 'Takes effect'; title: string; href: string; agency: string };

const fmt = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export const PAPERWORK_RE = /agency information collection|paperwork reduction act|submission (for|to the) (omb|office of management)/i;

export function upcomingDates(actions: PulseAction[], today = new Date().toISOString().slice(0, 10), limit = 5, includePaperwork = false): Entry[] {
  const out: Entry[] = [];
  for (const a of actions) {
    if (!includePaperwork && PAPERWORK_RE.test(a.title)) continue;
    if (a.comments_close_on && a.comments_close_on >= today)
      out.push({ key: `${a.document_number}-c`, date: a.comments_close_on, kind: 'Comments due', title: a.title, href: a.html_url, agency: a.agency });
    if (a.effective_on && a.effective_on >= today)
      out.push({ key: `${a.document_number}-e`, date: a.effective_on, kind: 'Takes effect', title: a.title, href: a.html_url, agency: a.agency });
  }
  return out.sort((x, y) => x.date.localeCompare(y.date)).slice(0, limit);
}

// An .ics calendar file built in the browser from the same entries, so a reader can put every deadline in their own calendar.
const icsEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, ' ');
export function toIcs(entries: Entry[], stamp = new Date()): string {
  const dtstamp = stamp.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Aex Terminal//Key dates//EN', 'CALSCALE:GREGORIAN'];
  for (const e of entries) {
    const d = e.date.slice(0, 10).replace(/-/g, '');
    const next = new Date(Date.parse(`${e.date.slice(0, 10)}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10).replace(/-/g, '');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.key}@aexterminal.com`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${d}`,
      `DTEND;VALUE=DATE:${next}`,
      `SUMMARY:${icsEscape(`${e.kind}: ${e.title}`).slice(0, 250)}`,
      `DESCRIPTION:${icsEscape(`${e.agency}. Source: ${e.href}`)}`,
      `URL:${e.href}`,
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function downloadIcs(entries: Entry[]) {
  const blob = new Blob([toIcs(entries)], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'aex-terminal-key-dates.ics';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function KeyDates({ actions }: { actions: PulseAction[] }) {
  const [showAll, setShowAll] = useState(false);
  const [paperwork, setPaperwork] = useState(false);
  const all = upcomingDates(actions, undefined, 200, paperwork);
  const entries = showAll ? all : all.slice(0, 5);
  return (
    <RailModule title="Key dates">
      {entries.length === 0 ? (
        <p className="text-sm text-ink-faint">No upcoming deadlines in the latest notices.</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {entries.map((e) => (
            <li key={e.key} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 py-2.5 first:pt-0">
              <span className="text-[13px] font-semibold tabular-nums text-ink">{fmt(e.date)}</span>
              <span className="min-w-0">
                <a href={e.href} target="_blank" rel="noreferrer" className="line-clamp-2 font-serif text-[15px] leading-snug text-ink no-underline hover:text-accent">
                  {e.title}
                </a>
                <span className="text-[12px] text-ink-faint">
                  {e.kind}
                  {e.agency ? ` · ${e.agency}` : ''}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
        {all.length > 5 && (
          <button type="button" onClick={() => setShowAll((v) => !v)} className="font-semibold text-accent hover:underline">
            {showAll ? 'Show fewer' : `See all ${all.length}`}
          </button>
        )}
        {all.length > 0 && (
          <button type="button" onClick={() => downloadIcs(all)} className="font-semibold text-accent hover:underline">
            Add to calendar (.ics)
          </button>
        )}
        <label className="flex items-center gap-1 text-ink-faint">
          <input type="checkbox" checked={paperwork} onChange={(e) => setPaperwork(e.target.checked)} />
          Include paperwork notices
        </label>
      </div>
    </RailModule>
  );
}
