import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPulseConnections } from '../lib/api';
import { COUNTRY_LABELS } from '../lib/pulseCountries';
import type { ConnectionEvent, ConnectionKind, ConnectionsResponse } from '../types/pulse';

export const KIND_LABEL: Record<ConnectionKind, string> = {
  action: 'U.S. action',
  news: 'News',
  gta: 'Trade barrier',
  wro: 'Forced-labor order',
  sanction: 'Sanctions or export listing',
};

const KIND_DOT: Record<ConnectionKind, string> = {
  action: 'bg-hue-orange',
  news: 'bg-hue-indigo',
  gta: 'bg-hue-pink',
  wro: 'bg-hue-violet',
  sanction: 'bg-hue-cyan',
};

export function TopicPill({ children }: { children: string }) {
  return <span className="border border-hairline px-1.5 py-px text-[11px] text-ink-muted">{children}</span>;
}

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function EventRow({ e, showCountries }: { e: ConnectionEvent; showCountries: boolean }) {
  return (
    <li className="grid grid-cols-[3.5rem_1fr] gap-x-3 border-b border-hairline py-2.5 last:border-0">
      <span className="pt-0.5 text-xs tabular-nums text-ink-faint">{shortDate(e.date)}</span>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[11px] text-ink-faint">
          <span className={`h-2 w-2 shrink-0 rounded-full ${KIND_DOT[e.kind]}`} aria-hidden="true" />
          {KIND_LABEL[e.kind]}
          {e.source && <span className="truncate">· {e.source}</span>}
          {showCountries && e.countries.length > 0 && <span className="truncate">· {e.countries.map((c) => COUNTRY_LABELS[c] ?? c).join(', ')}</span>}
        </p>
        {e.url ? (
          <a href={e.url} target="_blank" rel="noreferrer" className="mt-0.5 block text-sm leading-snug text-ink no-underline hover:text-accent">
            {e.title}
          </a>
        ) : (
          <p className="mt-0.5 text-sm leading-snug text-ink">{e.title}</p>
        )}
        {e.topics.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {e.topics.map((t) => (
              <TopicPill key={t}>{t}</TopicPill>
            ))}
          </div>
        )}
        {e.reactions.length > 0 && (
          <p className="mt-1 text-xs leading-snug text-ink-muted">
            <span className="text-ink-faint">Markets over the next 5 days: </span>
            {e.reactions.map((r) => r.reading).join('; ')}
          </p>
        )}
      </div>
    </li>
  );
}

// One country's politics, policy, trade and markets on a single dated
// timeline, filterable by topic. Every row is a real item from a source this
// app already tracks; grouping is by the deterministic rules in
// src/lib/pulse/links.ts, never an inference about cause.
export function ConnectionsPanel({ code, name, compact = false, group }: { code: string; name: string; compact?: boolean; group?: string[] }) {
  const [topic, setTopic] = useState<string | null>(null);
  const [data, setData] = useState<ConnectionsResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setFailed(false);
    getPulseConnections(code, { name, days: 60, topic: topic ?? undefined, countries: group })
      .then((r) => live && setData(r))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [code, name, topic, group?.join(',')]);

  if (failed) return <p className="text-sm text-ink-faint">Couldn't load connections right now.</p>;
  if (!data) return <p className="text-sm text-ink-faint">Loading…</p>;

  const events = compact ? data.events.slice(0, 5) : data.events;
  const chip = (active: boolean) =>
    `border px-2.5 py-1 text-xs font-semibold ${active ? 'border-ink bg-ink text-white' : 'border-hairline-strong bg-paper-raised text-ink-muted hover:border-ink hover:text-ink'}`;

  return (
    <div>
      {!compact && data.topicCounts.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter by topic">
          <button type="button" onClick={() => setTopic(null)} aria-pressed={topic === null} className={chip(topic === null)}>
            All
          </button>
          {data.topicCounts.map((t) => (
            <button key={t.topic} type="button" onClick={() => setTopic(t.topic)} aria-pressed={topic === t.topic} className={chip(topic === t.topic)}>
              {t.topic} <span className="ml-1 tabular-nums opacity-70">{t.count}</span>
            </button>
          ))}
        </div>
      )}

      {events.length === 0 ? (
        <p className="text-sm text-ink-faint">
          Nothing linked to {name} in the last {data.days} days{topic ? ` under ${topic}` : ''}. This app only shows items that actually name the country.
        </p>
      ) : (
        <ol className={compact ? '' : 'max-h-[34rem] overflow-y-auto pr-1'}>
          {events.map((e) => (
            <EventRow key={`${e.kind}:${e.id}`} e={e} showCountries={!!group} />
          ))}
        </ol>
      )}

      {compact && data.events.length > events.length && (
        <Link to={`/country/${code.toLowerCase()}`} className="mt-2 inline-block text-sm text-accent hover:underline">
          See all {data.events.length} connected items for {name}
        </Link>
      )}
      {!compact && Object.values(data.omitted ?? {}).some((n) => (n ?? 0) > 0) && (
        <p className="mt-3 text-xs text-ink-faint">
          Showing the newest from each source.{' '}
          {Object.entries(data.omitted)
            .filter(([, n]) => (n ?? 0) > 0)
            .map(([k, n]) => `${n} older ${KIND_LABEL[k as ConnectionKind].toLowerCase()} item${n === 1 ? '' : 's'}`)
            .join(', ')}{' '}
          not shown; the U.S. policy tab lists every action.
        </p>
      )}
      {!compact && events.some((e) => e.reactions.length > 0) && <p className="mt-3 text-xs text-ink-faint">{data.reactionNote}</p>}
      {!compact && data.events.length > 0 && (
        <p className="mt-1 text-xs text-ink-faint">Grouped by country and topic from each item's own text. Showing the last {data.days} days.</p>
      )}
    </div>
  );
}
