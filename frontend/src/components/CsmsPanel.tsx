import { useEffect, useState } from 'react';
import { getCsms, type CsmsResponse } from '../lib/api';
import { PulsePanel } from './PulsePanel';

// CBP CSMS bulletins on the Wire, tagged by program from each message's title. Source: CBP's official GovDelivery feed.
export function CsmsPanel() {
  const [data, setData] = useState<CsmsResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [program, setProgram] = useState<string>('All');
  useEffect(() => {
    getCsms().then(setData).catch(() => setFailed(true));
  }, []);
  const items = (data?.items ?? []).filter((m) => program === 'All' || m.programs.includes(program));
  const asOf = data?.asOf ? data.asOf.slice(0, 10) : null;
  return (
    <PulsePanel
      title="CBP messages to importers (CSMS)"
      subtitle="Customs' own bulletins on duties, systems and rules."
      help="The Cargo Systems Messaging Service is how U.S. Customs and Border Protection tells brokers and importers about new duties, reporting rules and system changes. Tags are taken from each message's title; a message that does not name a program is left untagged."
    >
      {failed && <p className="text-sm text-ink-muted">CBP's message feed could not be loaded right now.</p>}
      {!data && !failed && <p className="text-sm text-ink-faint">Loading...</p>}
      {data && (
        <>
          <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Filter by program">
            {['All', ...data.programs].map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={program === p}
                onClick={() => setProgram(p)}
                className={`border px-2 py-0.5 text-xs font-semibold ${program === p ? 'border-ink bg-ink text-paper' : 'border-hairline-strong bg-paper-raised text-ink-muted hover:border-ink hover:text-ink'}`}
              >
                {p}
              </button>
            ))}
          </div>
          {items.length === 0 ? (
            <p className="text-sm text-ink-muted">{data.items.length === 0 ? 'No messages stored yet; they load on the next daily update.' : `No recent message names ${program} in its title.`}</p>
          ) : (
            <ul className="max-h-[22rem] divide-y divide-hairline overflow-y-auto border-y border-hairline pr-1">
              {items.slice(0, 40).map((m) => (
                <li key={m.id} className="py-2">
                  <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold leading-snug text-ink hover:text-accent">
                    {m.title}
                  </a>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
                    <span className="tabular-nums">{m.published}</span>
                    <span className="tabular-nums">CSMS #{m.id}</span>
                    {m.programs.map((p) => (
                      <span key={p} className="border border-hairline px-1.5 text-[11px] text-ink-muted">
                        {p}
                      </span>
                    ))}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
            <a
              href={data.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 border border-hairline bg-paper-raised px-2 py-0.5 text-ink-muted no-underline hover:border-accent hover:text-accent"
            >
              <span>Primary source: CBP CSMS</span>
              <span className="tabular-nums text-[11px] text-ink-faint">
                {asOf ? `checked ${asOf}` : 'not yet checked'}
                {data.latest ? `; newest message ${data.latest}` : ''}
              </span>
            </a>
          </p>
        </>
      )}
    </PulsePanel>
  );
}
