import { Link } from 'react-router-dom';
import { SITE } from '../lib/site';

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="display mt-10 border-t-2 border-ink pt-4 text-2xl text-ink">{children}</h2>;
}

const SOURCES: { name: string; used: string; terms: string }[] = [
  {
    name: 'Federal Register (federalregister.gov)',
    used: 'Every U.S. trade action on this page: title, agency, document type, dates and abstract.',
    terms: 'Official U.S. government publication. Public information; we add topic labels and a plain-English sentence.',
  },
  {
    name: 'Yahoo Finance',
    used: 'Stock indexes, company shares, oil, natural gas, gold, copper, the 10-year Treasury yield and the dollar index.',
    terms: 'Public chart data, roughly 15 minutes delayed, provided for personal, informational use. Not an official or guaranteed feed.',
  },
  {
    name: 'European Central Bank, via Frankfurter (frankfurter.dev)',
    used: 'Currency exchange rates against the U.S. dollar.',
    terms: "The ECB's daily reference rates, published once each business day.",
  },
  {
    name: 'BBC News, The Guardian, NPR, the European Central Bank and the U.S. Federal Reserve (RSS feeds)',
    used: 'News headlines. We show the headline, a short summary, a link to the original story and, for BBC and Guardian items, their own lead photo.',
    terms: 'Each publisher owns its content. We link to the original and do not copy article text. Photos load directly from the publisher.',
  },
];

export function About() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-sm leading-relaxed text-ink-muted">
      <h1 className="display text-4xl text-ink sm:text-5xl">About {SITE.name}</h1>
      <p className="mt-3 text-base text-ink">
        {SITE.name} explains what is changing in world trade, in plain English: new U.S. tariff, sanctions and export-control actions, the markets they move,
        and the news around them. It is free and needs no sign-up.
      </p>
      <p className="mt-3">
        It is published by {SITE.operator}. The site is built so that anyone, expert or not, can see what changed today, why it might matter and where the
        information came from. Last updated {SITE.aboutUpdated}.
      </p>

      <H>Where the information comes from</H>
      <ul className="mt-3 divide-y divide-hairline border border-hairline">
        {SOURCES.map((s) => (
          <li key={s.name} className="px-4 py-3">
            <p className="text-ink">{s.name}</p>
            <p className="mt-0.5">{s.used}</p>
            <p className="mt-0.5 text-ink-faint">{s.terms}</p>
          </li>
        ))}
      </ul>

      <H>How it works</H>
      <p className="mt-3">
        Nothing on the news and policy pages is written or ranked by an AI model. Everything is produced by fixed, published rules applied to the source data:
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>
          <span className="text-ink">Topic labels</span> (tariff, sanctions, export control, trade agreement) come from keyword rules applied to each document's
          title and abstract, and to its issuing agency.
        </li>
        <li>
          <span className="text-ink">The plain-English sentence</span> on each action is a template filled from its document type, agency, topic label, dates
          and countries. It does not describe what the document says beyond those fields, so always open the official document for the details.
        </li>
        <li>
          <span className="text-ink">"What matters most"</span> is a simple sort: presidential orders and final rules first, then proposed rules and notices,
          newest first within each. Routine notices that share one title are grouped.
        </li>
        <li>
          <span className="text-ink">Countries</span> are found by matching country names in each item's text. It is a good guide, not a guarantee.
        </li>
        <li>
          <span className="text-ink">News</span> is kept only when a headline matches published rules for trade, markets or elections. Most general news is left
          out. Election coverage comes from headlines; there is no election calendar.
        </li>
        <li>
          <span className="text-ink">Market numbers</span> are the latest close or price the source reports, with the date shown. Percent changes are simple
          differences between two stored values.
        </li>
      </ul>
      <p className="mt-3">
        The separate{' '}
        <Link to="/calculator" className="text-accent">
          Compliance calculator
        </Link>{' '}
        is a different tool. It uses an AI model to help work through a shipment and shows its sources.
      </p>

      <H>Follow along</H>
      <p className="mt-3">
        New U.S. trade actions are available as an{' '}
        <a href="/api/pulse/rss" className="text-accent">
          RSS feed
        </a>{' '}
        you can add to any feed reader. Add <code className="tabular-nums text-xs text-ink">?tag=Tariff</code> or{' '}
        <code className="tabular-nums text-xs text-ink">?country=CN</code> to narrow it.
      </p>

      <H>Important limits</H>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>
          <span className="text-ink">Information only.</span> Nothing here is legal, customs, tax, financial or investment advice. For a shipment, a filing or
          an investment decision, talk to a licensed customs broker, trade attorney or financial adviser.
        </li>
        <li>
          <span className="text-ink">It can be wrong or late.</span> Sources can be delayed, revised, incomplete or unavailable, and automatic labelling makes
          mistakes. Market data is delayed and must not be used for trading. The site is provided as is, without warranties.
        </li>
        <li>
          <span className="text-ink">Other people's content stays theirs.</span> Company, index and publication names, and the news content and photos we link
          to, belong to their owners. Their inclusion does not imply endorsement.
        </li>
      </ul>

      <H>Corrections and contact</H>
      <p className="mt-3">
        {SITE.contactEmail ? (
          <>
            Spotted a mistake or have a question? Email{' '}
            <a href={`mailto:${SITE.contactEmail}`} className="text-accent">
              {SITE.contactEmail}
            </a>
            .
          </>
        ) : (
          <>Every item links to its official source, which is the place to confirm anything before relying on it.</>
        )}
      </p>
      <p className="mt-6">
        See also:{' '}
        <Link to="/privacy" className="text-accent">
          Privacy
        </Link>
        .
      </p>
    </main>
  );
}
