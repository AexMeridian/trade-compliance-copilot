import { Link } from 'react-router-dom';
import type { PulseAction } from '../types/pulse';
import { rankSignals } from './PulseTopSignals';
import { friendlyDate, plainSummary } from '../lib/pulsePlain';

// "This week in plain English" and a front door for non-specialists, at the top of the Wire (user testing: ordinary visitors met a
// globe and Federal Register titles first, and never found the pages written for them). The three items are the same ranking as
// "What matters most", from the last seven days, each with its plain one-line summary. Fixed wording, no model.
const DAY = 86_400_000;

export function PlainWeek({ actions }: { actions: PulseAction[] }) {
  const since = new Date(Date.now() - 7 * DAY).toISOString().slice(0, 10);
  const top = rankSignals(actions.filter((a) => a.publication_date >= since), 3);
  return (
    <section aria-label="This week in plain English" className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="border border-hairline bg-paper-raised px-5 py-4 lg:col-span-2">
        <h2 className="text-lg font-semibold text-ink">This week in plain English</h2>
        {top.length === 0 ? (
          <p className="mt-2 text-[15px] text-ink-muted">No major new U.S. trade actions in the last seven days.</p>
        ) : (
          <ol className="mt-2 flex flex-col gap-2.5">
            {top.map((a) => (
              <li key={a.document_number} className="text-[15px] leading-snug">
                <a href={a.html_url} target="_blank" rel="noreferrer" className="font-semibold text-ink no-underline hover:text-accent">
                  {a.title}
                </a>
                <span className="block text-ink-muted">
                  {plainSummary(a)} <span className="text-ink-faint">({friendlyDate(a.publication_date)})</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="border border-hairline bg-paper-raised px-5 py-4">
        <h2 className="text-lg font-semibold text-ink">New here?</h2>
        <ul className="mt-2 flex flex-col gap-1.5 text-[15px]">
          <li><Link to="/prices" className="text-accent hover:underline">Tariffs and your wallet</Link></li>
          <li><Link to="/lookup" className="text-accent hover:underline">Look up the tariff on a product</Link></li>
          <li><Link to="/de-minimis" className="text-accent hover:underline">Why small packages now owe duty</Link></li>
          <li><Link to="/us-china" className="text-accent hover:underline">The U.S. and China, side by side</Link></li>
          <li><Link to="/glossary" className="text-accent hover:underline">Glossary of terms</Link></li>
        </ul>
      </div>
    </section>
  );
}
