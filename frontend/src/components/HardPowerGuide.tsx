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
    'No. Every figure on this page is a real, sourced count, rate or membership list. Nothing is combined into a "hard power score", and where a concept cannot be measured here without inventing a number it is left off the page.',
  ],
  [
    'Does a bigger tariff or sanctions count mean the U.S. treats that country as an adversary?',
    'Not necessarily. It only means more of the tracked Federal Register actions or listed parties name that country. A routine renewal, a new sanction and a trade-agreement update all count the same way; the count is a tally of activity, not a judgment.',
  ],
  [
    "Does a country's absence from a bloc mean it's opposed to the U.S.?",
    "No. The Military & alliances tab lists formal membership only, not sentiment, alignment or rivalry. Most countries aren't members of any of the five groups shown, and that is simply because those groups don't include them.",
  ],
  [
    "Does the dollar's falling reserve share mean the dollar is being replaced?",
    'No single figure supports that claim. Central banks, in aggregate, hold a smaller share of their reserves in dollars than in 1999: a real, slow-moving trend, not a prediction about what replaces it or how fast.',
  ],
  [
    'Where is culture, opinion and aid?',
    'On the Soft Power page. Hard power is what a state can compel or withhold; soft power is attraction, and it is measured with polls, exchange and aid rather than tariffs and sanctions.',
  ],
  [
    'Does it use AI?',
    `No. Every number and grouping here comes from fixed rules and public reference data, the same as ${SITE.name}: no model call, no summarization, no scoring.`,
  ],
];

export function HardPowerGuide() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="display text-3xl text-ink">A short guide to this page</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Hard Power gathers the tools a state uses to compel or withhold: sanctions, tariffs and export controls, the dollar and who holds U.S. debt, and defense spending and alliances. It is
          organized by country, with each figure shown with its source and no combined score. For attraction rather than coercion, see{' '}
          <Link to="/soft-power" className="text-accent hover:underline">
            Soft Power
          </Link>
          ; for the live feed of new notices, see the{' '}
          <Link to="/" className="text-accent hover:underline">
            Wire
          </Link>
          .
        </p>
      </div>

      <Section title="Trade tools">
        <p>
          Tariffs, export controls and trade agreements published in the Federal Register: measures that raise costs on, or restrict or condition access to, another country's trade. The tab shows
          activity by country, by agency and over time, the extra duties in force, and the full tariff and export-control reference tables. It reports what was published and takes no position on
          whether a measure is justified.
        </p>
      </Section>

      <Section title="Sanctions">
        <p>
          The U.S. Treasury's OFAC list and the Commerce/State Consolidated Screening List, plus the UN and UK lists, counted and browsable by country. A country filter is a text match on each
          entry's address, not a legal finding about the country, and a count says how many parties are listed, not how severe the measures are.
        </p>
      </Section>

      <Section title="Money and the dollar">
        <p>
          Three real measures of financial leverage: the dollar's share of the world's allocated foreign-exchange reserves (IMF COFER, quarterly), the largest foreign holders of U.S. Treasury
          securities (monthly), and the dollar's moves against other currencies (European Central Bank daily rates). Treasury holdings are reported where securities are held, so financial centers can
          hold securities for investors elsewhere.
        </p>
      </Section>

      <Section title="Military and alliances">
        <p className="mb-3">
          Formal, public membership in five real groupings, cited to each group's own governing body, and NATO's own published defense-spending estimates. Membership is not a judgment about closeness or
          agreement:
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
          BRICS is shown with its original five founding members (2010); the 2024 expansion is left out to avoid disputed or partial membership. A country can belong to more than one group, and the
          globe shows one color per country (its most specific group) as a display simplification.
        </p>
      </Section>

      <Section title="Compare">
        <p>Up to three countries side by side on tariff programs, export-control status and a typical shipping lane, using the same data as each country's own page.</p>
      </Section>

      <Section title="Where the data comes from">
        <p>
          Federal Register (policy actions), OFAC, Commerce and State, UN and UK sanctions lists, the IMF, the U.S. Treasury, the European Central Bank, NATO, and hand-verified tariff and
          export-control tables. Exact sources, licences and freshness are on the{' '}
          <Link to="/methodology#sources" className="text-accent hover:underline">
            Methodology
          </Link>{' '}
          page.
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
