import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Breadcrumb } from '../components/Breadcrumb';
import { PulsePanel } from '../components/PulsePanel';
import { getListChangeDay, getListChanges, type ChangeParty, type ListChangeDay, type ListChangeSummary } from '../lib/api';

// What changed on the sanctions and screening lists, day by day: parties added and removed from the OFAC SDN list, the Consolidated
// Screening List (which carries the Entity List), the UN list and the UK list. Derived by the daily list sync, which compares each
// official file with the day before; each party links to its entry on the official list.

type Lists = Record<string, { label: string; sourceUrl: string }>;

function PartyList({ title, parties, total }: { title: string; parties: ChangeParty[]; total: number }) {
  if (total === 0) return null;
  return (
    <div className="mt-2">
      <p className="text-sm font-semibold text-ink">
        {title} ({total})
      </p>
      <ul className="mt-1 divide-y divide-hairline border-y border-hairline">
        {parties.map((p) => (
          <li key={p.uid} className="py-1.5 text-sm">
            {p.url ? (
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">
                {p.name ?? `Entry ${p.uid} (name not recorded)`}
              </a>
            ) : (
              <span className="font-semibold text-ink">{p.name ?? `Entry ${p.uid} (name not recorded)`}</span>
            )}
            <span className="ml-2 text-xs text-ink-faint">
              entry {p.uid}
              {p.detail ? `; ${p.detail}` : ''}
            </span>
          </li>
        ))}
      </ul>
      {parties.length < total && <p className="mt-1 text-xs text-ink-faint">Showing the first {parties.length} of {total}.</p>}
    </div>
  );
}

function DayView({ date }: { date: string }) {
  const [data, setData] = useState<{ lists: Lists; day: Record<string, ListChangeDay> } | null>(null);
  const [state, setState] = useState<'loading' | 'missing' | 'error' | 'ok'>('loading');
  useEffect(() => {
    setState('loading');
    getListChangeDay(date)
      .then((r) => {
        setData(r);
        setState('ok');
      })
      .catch((e: Error) => setState(/No list changes/i.test(e.message) ? 'missing' : 'error'));
  }, [date]);
  if (state === 'loading') return <p className="mt-6 text-sm text-ink-faint">Loading...</p>;
  if (state === 'missing') return <p className="mt-6 text-sm text-ink-muted">No list changes are recorded for {date}. Days with no change are not listed.</p>;
  if (state === 'error' || !data) return <p className="mt-6 text-sm text-stop">Could not load this day.</p>;
  return (
    <div className="mt-6 flex flex-col gap-5">
      {Object.entries(data.day).map(([source, d]) => (
        <PulsePanel key={source} title={data.lists[source]?.label ?? source} subtitle={`${d.addedCount} added, ${d.removedCount} removed, ${d.updatedCount} entries updated.`}>
          <PartyList title="Added" parties={d.added} total={d.addedCount} />
          <PartyList title="Removed" parties={d.removed} total={d.removedCount} />
          {d.addedCount === 0 && d.removedCount === 0 && <p className="text-sm text-ink-muted">No party was added or removed; the details of {d.updatedCount} existing entries changed.</p>}
          <p className="mt-2 text-xs text-ink-faint">
            Official list:{' '}
            <a href={data.lists[source]?.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              {data.lists[source]?.sourceUrl}
            </a>
          </p>
        </PulsePanel>
      ))}
    </div>
  );
}

export function Changes() {
  const { date } = useParams();
  const [days, setDays] = useState<ListChangeSummary[] | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    getListChanges()
      .then((r) => {
        setDays(r.days);
        setAsOf(r.generatedAt);
      })
      .catch(() => setFailed(true));
  }, []);
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Breadcrumb trail={date ? [{ label: 'What changed', to: '/changes' }, { label: date }] : [{ label: 'What changed' }]} />
      <h1 className="display mt-3 text-4xl text-ink sm:text-5xl">{date ? `List changes on ${date}` : 'What changed on the sanctions lists'}</h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-muted">
        Parties added to and removed from the OFAC SDN list, the Consolidated Screening List (which includes the Entity List), the UN Security Council list and the UK sanctions list.
        Each day is compared with the day before by this site's daily sync; each party links to its entry on the official list.
      </p>
      <p className="mt-2 flex flex-wrap items-center gap-x-4 text-sm">
        <a href="/changes.xml" className="text-accent hover:underline">
          RSS feed
        </a>
        <Link to="/hard-power?tab=sanctions" className="text-accent hover:underline">
          Search the lists
        </Link>
        {asOf && <span className="text-xs text-ink-faint">File updated {asOf.slice(0, 10)}</span>}
      </p>
      {date ? (
        <DayView date={date} />
      ) : (
        <div className="mt-6">
          {failed && <p className="text-sm text-stop">Could not load the changes right now.</p>}
          {!days && !failed && <p className="text-sm text-ink-faint">Loading...</p>}
          {days && days.length === 0 && <p className="text-sm text-ink-muted">No change has been recorded yet.</p>}
          {days && days.length > 0 && (
            <ul className="divide-y divide-hairline border-y border-hairline">
              {days.map((d) => (
                <li key={d.date} className="py-3">
                  <Link to={`/changes/${d.date}`} className="text-base font-semibold text-accent hover:underline">
                    {d.date}
                  </Link>
                  <span className="ml-3 text-sm text-ink-muted">
                    {d.addedTotal} added, {d.removedTotal} removed
                  </span>
                  <p className="mt-0.5 text-xs text-ink-faint">{d.lists.map((l) => `${l.label.split(' (')[0]}: +${l.addedCount} -${l.removedCount} ~${l.updatedCount}`).join('; ')}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 max-w-prose text-xs leading-relaxed text-ink-faint">
            History starts on 2026-11-22, when the daily sync began keeping the lists' fingerprints; earlier days cannot be reconstructed. A day appears only if something changed. The
            first full snapshot of each list is a starting point, not a change.
          </p>
        </div>
      )}
    </div>
  );
}
