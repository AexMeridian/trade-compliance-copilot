import { NEWS_HUE, TAG_HUE } from '../lib/pulseColors';
import { NEWS_CATEGORY_HINTS, TAG_HINTS } from '../lib/pulseGlossary';
import { PulseDelta } from './PulseDelta';
import { PulseGlossary } from './PulseGlossary';
import { agoText } from '../lib/pulsePlain';
import type { PulseHome } from '../types/pulse';

const MARKET_TERMS: [string, string][] = [
  [
    'Stock index',
    'A single number that tracks a group of company shares, for example the S&P 500 (500 large U.S. companies). When it rises, those shares are worth more on average.',
  ],
  ['VIX', 'A gauge of how nervous investors are. Low numbers mean calm markets; high numbers mean people expect big swings.'],
  [
    'Commodity',
    'A raw material that is traded around the world, such as oil, natural gas, gold or copper. Prices matter for shipping and manufacturing costs.',
  ],
  ['Treasury yield', 'The interest rate the U.S. government pays to borrow money. It influences borrowing costs and currency values worldwide.'],
  [
    'Dollar index',
    'A score for how strong the U.S. dollar is against other major currencies. A stronger dollar makes imports cheaper and U.S. exports pricier abroad.',
  ],
  ['Tariff', 'A tax a government charges on goods brought in from another country.'],
  ['Sanctions', 'Restrictions on doing business with certain people, companies or countries.'],
  ['Export control', 'Rules about what technology or goods may be sold or shipped to other countries.'],
];

const SOURCES: { name: string; what: string; fresh: string }[] = [
  {
    name: 'Federal Register',
    what: 'Official U.S. government trade actions (tariffs, sanctions, export controls).',
    fresh: 'Checked daily, or press "Check for updates".',
  },
  {
    name: 'Yahoo Finance',
    what: 'Stock indexes, company shares, oil, gold, copper, Treasury yield and the dollar index.',
    fresh: 'Up to about 15 minutes behind, refreshed every 15 minutes.',
  },
  { name: 'European Central Bank (via Frankfurter)', what: 'Currency exchange rates against the U.S. dollar.', fresh: 'Published once each business day.' },
  {
    name: 'BBC, The Guardian, NPR, ECB, Federal Reserve',
    what: 'News headlines about trade, markets and elections.',
    fresh: 'Checked about every 30 minutes.',
  },
];

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
    'Is this legal or financial advice?',
    'No. It is general information, gathered from public sources. For decisions about a shipment, a filing or an investment, talk to a licensed customs broker, trade attorney or financial adviser.',
  ],
  [
    'Does it use AI?',
    'No. Every number, ranking, plain-English sentence and topic label on this page comes from fixed rules applied to the source data. (The separate Compliance calculator is a different tool and does use AI.)',
  ],
  [
    'Why are some market numbers a day old?',
    'Markets close overnight, on weekends and on holidays, and Asian and European markets close before U.S. ones. Each number shows the date it is for, so you always know how fresh it is.',
  ],
  [
    'Why do many entries share the same title?',
    "The government publishes lots of routine notices under identical headings, for example updates to sanctions lists. We group them so they don't crowd out the important items.",
  ],
  [
    'Why is a country missing from an item?',
    'Countries are picked out by matching names in the text of each item, so it is a good guide but not a guarantee. Open the item to read the official wording.',
  ],
  [
    'Where are my choices stored?',
    "Only in your own browser. Nothing about you is sent to or kept on a server, and clearing your browser's site data resets everything.",
  ],
];

export function PulseGuide({ status }: { status: PulseHome['status'] | null }) {
  const checked: Record<string, string | null> = {
    'Federal Register': status?.policy ?? null,
    'Yahoo Finance': status?.quotes ?? null,
    'European Central Bank (via Frankfurter)': status?.fx ?? null,
    'BBC, The Guardian, NPR, ECB, Federal Reserve': status?.news ?? null,
  };
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="display text-3xl text-ink">A short guide to this page</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Trade Policy Pulse follows how governments, markets and news are changing the way goods and money move around the world, and explains it in plain
          English. Here is how to get the most out of it.
        </p>
      </div>

      <Section title="How to use it">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <span className="text-ink">Start with the four highlights at the top.</span> They show the biggest U.S. trade action, the top headline, the dollar's
            biggest move and how many proposed rules are open for public comment.
          </li>
          <li>
            <span className="text-ink">Use the tabs to go deeper.</span> U.S. policy has the government actions, Markets has stocks, commodities and currencies,
            and News has the headlines.
          </li>
          <li>
            <span className="text-ink">Select "What's this?"</span> on a panel for a plain explanation of it. The explanations stay closed until you ask.
          </li>
          <li>
            <span className="text-ink">Make it yours.</span> "Customize feed" lets you pick the topics, countries and markets you care about, and hide the rest.
          </li>
        </ol>
      </Section>

      <Section title="Reading the numbers">
        <p>
          <PulseDelta change={1} text="2.1%" /> green with an up arrow means a number went up, and <PulseDelta change={-1} text="2.1%" /> red with a down arrow
          means it went down. It doesn't say whether that is good or bad: a falling oil price is bad news for an oil producer and good news for a shipper.
        </p>
        <p className="mt-3">Each topic has its own color, and is also named in plain text:</p>
        <div className="mt-2 grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
          <ul className="space-y-1.5">
            {Object.keys(TAG_HUE).map((t) => (
              <li key={t} className="flex items-start gap-2">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TAG_HUE[t].bg}`} aria-hidden="true" />
                <span>
                  <span className="text-ink">{t}.</span> {TAG_HINTS[t]}
                </span>
              </li>
            ))}
          </ul>
          <ul className="space-y-1.5">
            {Object.keys(NEWS_HUE).map((t) => (
              <li key={t} className="flex items-start gap-2">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${NEWS_HUE[t].bg}`} aria-hidden="true" />
                <span>
                  <span className="text-ink">{t}.</span> {NEWS_CATEGORY_HINTS[t]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section title="Words you might see">
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {MARKET_TERMS.map(([term, def]) => (
            <div key={term}>
              <dt className="text-ink">{term}</dt>
              <dd>{def}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6">
          <PulseGlossary defaultOpen />
        </div>
      </Section>

      <Section title="Where the information comes from">
        <ul className="card divide-y divide-hairline">
          {SOURCES.map((s) => (
            <li key={s.name} className="grid gap-1 px-4 py-3 sm:grid-cols-[14rem_1fr_16rem] sm:gap-4">
              <span className="text-ink">{s.name}</span>
              <span>{s.what}</span>
              <span className="text-ink-faint">
                {s.fresh}
                {checked[s.name] && <span className="mt-1 block text-ink-muted">Last updated {agoText(checked[s.name])}.</span>}
              </span>
            </li>
          ))}
        </ul>
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
