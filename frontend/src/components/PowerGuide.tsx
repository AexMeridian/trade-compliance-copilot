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
    'Is "American power" a score this page computes?',
    'No. There is no power index, no weighting, and no single number that claims to answer "is the U.S. more or less powerful." Every figure here is a real, independently sourced count or rate -- hard power and soft power are shown as two separate, real trends, not combined into one.',
  ],
  [
    'Does more tariff/sanctions activity mean the U.S. is more powerful?',
    "It means more of the tracked Federal Register actions took effect. That's real pressure being exercised, but exercising a tool and that tool working are different things -- this page doesn't claim the second.",
  ],
  [
    "Does the dollar's falling reserve share mean the dollar is being replaced?",
    "No single figure supports that claim. It means central banks, in aggregate, hold a smaller share of their reserves in dollars than they did in 1999 -- a real, slow-moving trend, not a prediction about what replaces it or how fast.",
  ],
  [
    'Why isn\'t there a "cultural power" or "soft power index" section?',
    "Because nothing on this page would be a genuine measurement of it. Media reach, cultural influence and similar ideas are real, but this app doesn't have a real, sourced number for them -- so they're left out rather than estimated.",
  ],
  [
    'Does it use AI?',
    `No. Every number and grouping here comes from fixed rules and public reference data, the same as ${SITE.name} -- no model call, no summarization, no scoring.`,
  ],
];

export function PowerGuide() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="display text-3xl text-ink">A short guide to this page</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
          This page puts two real, opposing trends side by side: hard power (the tariffs, sanctions and export controls the U.S. is actively using) and soft
          power (the dollar's shrinking share of world reserves, plus its market reach and diplomatic headlines). Almost everything here is the same data
          already tracked by{' '}
          <Link to="/" className="text-accent hover:underline">
            {SITE.name}
          </Link>{' '}
          and{' '}
          <Link to="/influence" className="text-accent hover:underline">
            American influence
          </Link>
          , read through this specific lens. The one genuinely new piece is the IMF's reserve-currency data (below).
        </p>
      </div>

      <Section title="What counts as “hard power” here">
        <p>
          Tariffs, sanctions, export controls and trade agreements published in the Federal Register -- tools that raise costs, cut off access, or condition
          trade for another country. The same real data as Pulse's U.S.-policy feed and Influence's Pressure tab, framed here as instruments of coercion rather
          than neutral policy tracking. See the full duty-stack and tariff-program detail on{' '}
          <Link to="/?tab=data" className="text-accent hover:underline">
            {SITE.name}'s Data tab
          </Link>
          , or a specific country's exposure on its own{' '}
          <Link to="/country/cn" className="text-accent hover:underline">
            country page
          </Link>
          .
        </p>
      </Section>

      <Section title="What counts as “soft power” here">
        <p className="mb-3">
          One genuinely new, real measure, plus the same market and news data Pulse already collects:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="text-ink">The dollar's reserve-currency share.</span> The IMF's COFER series: the percent of the world's allocated
            foreign-exchange reserves held in U.S. dollars, published quarterly since 1999. This is the standard real-world measure economists use for "how
            much does the world still trust the dollar as a place to hold savings" -- not this app's own invention.
          </li>
          <li>
            <span className="text-ink">The dollar's market reach.</span> The dollar index, Treasury yields, and exchange rates against major trade partners.
          </li>
          <li>
            <span className="text-ink">Diplomatic and political headlines.</span> From 8 outlets, filtered to their Elections & Politics and Official
            categories.
          </li>
        </ul>
      </Section>

      <Section title="What “alliances” means here">
        <p className="mb-3">
          Formal, public membership in five real groupings, current as of the date noted in the code and cited to each group's own founding or governing body
          -- not a judgment about closeness or agreement:
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
          A country can belong to more than one group, and the globe shows only one color per country (its most specific group) as a display simplification --
          the Alliances tab lists full membership.
        </p>
      </Section>

      <Section title="Where the data comes from">
        <p>
          Federal Register (policy actions), Yahoo Finance (stocks, commodities, rates, the dollar index), the European Central Bank via Frankfurter (exchange
          rates), the U.S. Bureau of Labor Statistics (macro data), BBC/The Guardian/NPR/ECB/Fed (news), and the IMF's COFER series (reserve-currency share) --
          exact sources and freshness are listed on{' '}
          <Link to="/about" className="text-accent hover:underline">
            About and sources
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
