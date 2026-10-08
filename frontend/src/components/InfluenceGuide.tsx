import { Link } from 'react-router-dom';
import { BLOC_FULL_NAMES, BLOC_LABELS, type Bloc } from '../lib/pulseBlocs';
import { BLOC_HUE } from '../lib/pulseColors';
import { SITE } from '../lib/site';

const BLOCS: Bloc[] = ['USMCA', 'G7', 'NATO', 'BRICS', 'G20'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-hairline pt-6">
      <h2 className="display text-2xl text-ink">{title}</h2>
      <div className="mt-3 text-sm leading-relaxed text-ink-muted">{children}</div>
    </section>
  );
}

const QA: [string, string][] = [
  [
    'Is this an editorial judgment about who is "winning"?',
    'No. Every figure on this page is a real, sourced count or a real, sourced membership list -- never a computed "footprint score." Where a real concept (like cultural reach) can\'t be measured here without inventing a number, it is left off the page rather than estimated.',
  ],
  [
    'Does a bigger tariff/sanctions count mean the U.S. sees that country as an adversary?',
    'Not necessarily. It only means more of the tracked Federal Register actions named that country in the last 30 days. A routine renewal, a new sanction and a trade-agreement update all count the same way; the count is a tally of activity, not a judgment.',
  ],
  [
    "Does a country's absence from a bloc mean it's opposed to the U.S.?",
    "No. The Alliances tab lists formal membership only (see below), not sentiment, alignment or rivalry. Most countries this page tracks aren't members of any of the five groups shown, and that's simply because those groups don't include them -- not a claim about their relationship with the U.S.",
  ],
  [
    'Does it use AI?',
    `No. Every number and grouping here comes from fixed rules and public reference data, the same as ${SITE.name} -- no model call, no summarization, no scoring.`,
  ],
];

export function InfluenceGuide() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="display text-3xl text-ink">A short guide to this page</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
          This page reframes real {SITE.name} data through a "pressure and reach" lens -- what tools the U.S. uses to apply pressure abroad, what gives
          the dollar and U.S. diplomacy reach, and who it's formally allied with. Nothing here is a new data source built just for this framing except the
          alliance list below; everything else is the same figures used on{' '}
          <Link to="/" className="text-accent hover:underline">
            {SITE.name}
          </Link>
          , read differently.
        </p>
      </div>

      <Section title="What counts as “pressure” here">
        <p>
          Tariffs, sanctions, export controls and trade agreements published in the Federal Register -- the tools a government can use to raise costs, cut off,
          or condition access for another country. The Pressure tab is Pulse's own U.S.-policy data (activity by country, by agency, and over time), simply
          framed as instruments of pressure rather than neutral policy tracking.
        </p>
      </Section>

      <Section title="What counts as “reach” here">
        <p>
          Three real proxies, not a measure of culture or favorability: the dollar's strength and reach (the dollar index, Treasury yields, exchange rates
          against major trade partners, and world stock indexes); U.S. import and export price indexes from the Bureau of Labor Statistics, the closest real,
          published read on whether tariffs are actually showing up in prices rather than just in policy announcements; and diplomatic/political news (headlines
          from 8 outlets -- BBC, The Guardian, NPR, Al Jazeera, Deutsche Welle, CNBC, the ECB and the Fed -- filtered to their Elections & Politics and Official
          categories). All three are the same market,
          price and news data Pulse already collects.
        </p>
      </Section>

      <Section title="What “alliances” means here">
        <p className="mb-3">
          Formal, public membership in five real groupings, current as of the date noted in the code and cited to each group's own founding or governing body --
          not a judgment about closeness or agreement:
        </p>
        <ul className="space-y-2">
          {BLOCS.map((b) => (
            <li key={b} className="flex items-start gap-2.5">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${BLOC_HUE[b].bg}`} aria-hidden="true" />
              <span>
                <span className="text-ink">{BLOC_LABELS[b]}.</span> {BLOC_FULL_NAMES[b]}.
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3">
          BRICS is shown with its original five founding members (2010); the 2024 expansion is left out to avoid disputed or partial membership as of the date
          this list was written. A country can belong to more than one group, and the globe shows only one color per country (its most specific group) as a
          display simplification -- the Alliances tab lists full membership.
        </p>
      </Section>

      <Section title="Where the reused data comes from">
        <p>
          Federal Register (policy actions), Yahoo Finance (stocks, commodities, rates, the dollar index), the European Central Bank via Frankfurter (exchange
          rates), the U.S. Bureau of Labor Statistics (import/export prices), and BBC/The Guardian/NPR/ECB/Fed (news) -- the exact sources and freshness are
          listed on{' '}
          <Link to="/?tab=guide" className="text-accent hover:underline">
            {SITE.name}'s own guide
          </Link>
          . The alliance membership list is a static reference file in the app's source, dated and cited to each group's own published membership.
        </p>
      </Section>

      <Section title="Common questions">
        <div className="card divide-y divide-hairline">
          {QA.map(([q, a]) => (
            <details key={q} className="group px-4 py-3">
              <summary className="cursor-pointer list-none text-ink [&::-webkit-details-marker]:hidden">
                <span className="mr-2 inline-block text-ink-faint group-open:rotate-90">›</span>
                {q}
              </summary>
              <p className="mt-2 pl-4">{a}</p>
            </details>
          ))}
        </div>
      </Section>
    </div>
  );
}
