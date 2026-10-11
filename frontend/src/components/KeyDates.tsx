import type { PulseAction } from '../types/pulse';
import { RailModule } from './RailModule';

// Upcoming dates taken straight from the notices themselves: when a comment period closes and when a rule
// takes effect. Only dates that are still ahead are shown, soonest first. Nothing is predicted.
type Entry = { key: string; date: string; kind: 'Comments due' | 'Takes effect'; title: string; href: string };

const fmt = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export function upcomingDates(actions: PulseAction[], today = new Date().toISOString().slice(0, 10), limit = 5): Entry[] {
  const out: Entry[] = [];
  for (const a of actions) {
    if (a.comments_close_on && a.comments_close_on >= today) out.push({ key: `${a.document_number}-c`, date: a.comments_close_on, kind: 'Comments due', title: a.title, href: a.html_url });
    if (a.effective_on && a.effective_on >= today) out.push({ key: `${a.document_number}-e`, date: a.effective_on, kind: 'Takes effect', title: a.title, href: a.html_url });
  }
  return out.sort((x, y) => x.date.localeCompare(y.date)).slice(0, limit);
}

export function KeyDates({ actions }: { actions: PulseAction[] }) {
  const entries = upcomingDates(actions);
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
                <span className="text-[12px] text-ink-faint">{e.kind}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </RailModule>
  );
}
