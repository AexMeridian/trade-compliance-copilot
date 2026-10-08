import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SITE } from '../lib/site';
import { getPulseCoverage, type PulseCoverage } from '../lib/api';

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="display mt-10 border-t-2 border-ink pt-4 text-2xl text-ink">{children}</h2>;
}

const SOURCES: { name: string; used: string; terms: string; coverageKey?: keyof PulseCoverage }[] = [
  {
    name: 'Federal Register (federalregister.gov)',
    used: 'Every U.S. trade action on this page: title, agency, document type, dates and abstract.',
    terms: 'Official U.S. government publication. Public information; we add topic labels and a plain-English sentence.',
    coverageKey: 'federal_register',
  },
  {
    name: 'Yahoo Finance',
    used: 'Stock indexes, company shares, oil, natural gas, gold, copper, the 10-year Treasury yield and the dollar index.',
    terms: 'Public chart data, roughly 15 minutes delayed, provided for personal, informational use. Not an official or guaranteed feed.',
    coverageKey: 'yahoo_finance',
  },
  {
    name: 'European Central Bank, via Frankfurter (frankfurter.dev)',
    used: 'Currency exchange rates against the U.S. dollar.',
    terms: "The ECB's daily reference rates, published once each business day.",
    coverageKey: 'ecb_fx',
  },
  {
    name: 'BBC News, The Guardian, NPR, Al Jazeera, Deutsche Welle, CNBC, the European Central Bank and the U.S. Federal Reserve (RSS feeds)',
    used: 'News headlines. We show the headline, a short summary, a link to the original story and, for BBC and Guardian items, their own lead photo.',
    terms: 'Each publisher owns its content. We link to the original and do not copy article text. Photos load directly from the publisher.',
    coverageKey: 'news',
  },
  {
    name: 'U.S. Bureau of Labor Statistics (bls.gov)',
    used: 'Consumer prices (CPI), the unemployment rate, nonfarm payrolls, producer prices (PPI), and import and export price indexes.',
    terms: 'Official U.S. government statistics, published on the BLS release schedule. Public information; keyless public API.',
    coverageKey: 'bls',
  },
  {
    name: 'International Monetary Fund, COFER (data.imf.org)',
    used: "The U.S. dollar's share of the world's allocated foreign-exchange reserves.",
    terms: 'Official IMF statistics, published quarterly with roughly a one-quarter lag. Public information; keyless public API.',
    coverageKey: 'imf_cofer',
  },
  {
    name: 'Global Trade Alert (globaltradealert.org)',
    used: "On each country's page: that country's own trade measures evaluated as harmful or likely-harmful to foreign commercial interests, affecting the United States, in roughly the last 3 years.",
    terms: "This is the one source on this page that is not a government or official statistics body -- it's an independent research database (University of St. Gallen-affiliated), free for non-commercial use under a CC BY-NC 4.0 license. Requires a free API key; limited here to a recent window, not its full archive back to 2009.",
  },
  {
    name: 'U.S. Customs and Border Protection, Withhold Release Orders & Findings (cbp.gov)',
    used: "On each country's page: forced-labor merchandise/entity orders under Section 307 (19 U.S.C. 1307) naming that country, active and historical.",
    terms: 'Official U.S. government enforcement data, published as a CSV that CBP updates periodically. A separate, newer DHS list (the UFLPA Entity List) is linked to directly rather than ingested, since DHS publishes it only as a web page with no bulk data file.',
  },
];

export function About() {
  // Loaded, not hardcoded: each "tracked here since" date below is a live
  // MIN() over that source's own table (src/routes/pulse.ts's /coverage
  // route), so it can never drift from what's actually stored. A failed
  // fetch just means the dates don't render -- never a guessed fallback.
  const [coverage, setCoverage] = useState<PulseCoverage | null>(null);
  useEffect(() => {
    getPulseCoverage()
      .then(setCoverage)
      .catch(() => {});
  }, []);

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
        {SOURCES.map((s) => {
          const since = s.coverageKey && coverage ? coverage[s.coverageKey] : null;
          return (
            <li key={s.name} className="px-4 py-3">
              <p className="text-ink">{s.name}</p>
              <p className="mt-0.5">{s.used}</p>
              <p className="mt-0.5 text-ink-faint">{s.terms}</p>
              {since && <p className="mt-0.5 text-ink-faint">Tracked on this site since {since}.</p>}
            </li>
          );
        })}
      </ul>

      <H>How it works</H>
      <p className="mt-3">
        Nothing on the news and policy pages is written or ranked by an AI model. Everything is produced by fixed, published rules applied to the source data:
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>
          <span className="text-ink">Topic labels</span> (tariff, sanctions, export control, trade agreement) come from keyword rules applied to each
          document's title and abstract, checked in a fixed order. A document from the sanctions office (OFAC) or the export-control bureau (BIS) gets that
          label from agency membership alone, since that is effectively their entire function; every other agency is labelled only when the text itself
          matches a topic's keywords (for example "tariff," "Section 301," "Section 232," "antidumping" for Tariff; "entity list," "EAR," "ITAR" for Export
          Control). This order matters: it is why a State Department notice is only tagged Export Control when it is actually about arms-trade controls, not
          whenever State publishes anything. A document matching none of the rules is labelled "Other."
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
        is a different tool. It uses an AI model to help work through a shipment and shows its sources. One part of it is not AI at all: party screening
        matches a name against watchlists with a deterministic two-stage algorithm (a fast word-order-independent pre-filter, then a character-similarity
        score called Jaro-Winkler), and shows both numbers next to each candidate so you can see why a match was or wasn't flagged, not just a single
        unexplained score.
      </p>

      <H>Follow along</H>
      <p className="mt-3">
        New U.S. trade actions are available as a feed you can add to any feed reader -- no account needed:{' '}
        <a href="/rss.xml" className="text-accent">
          RSS
        </a>
        ,{' '}
        <a href="/atom.xml" className="text-accent">
          Atom
        </a>{' '}
        or{' '}
        <a href="/feed.json" className="text-accent">
          JSON Feed
        </a>
        . Narrow any of them with <code className="tabular-nums text-xs text-ink">?tag=</code>,{' '}
        <code className="tabular-nums text-xs text-ink">?country=</code> or <code className="tabular-nums text-xs text-ink">?q=</code> (a keyword search
        against the title and abstract, useful for a specific program like "Section 301"). Each accepts a comma-separated list, matched as "any of
        these": <code className="tabular-nums text-xs text-ink">{'?q=Section 301,Section 232&country=CN,MX,CA'}</code> is one link for "Section 301 or 232
        actions naming China, Mexico or Canada." Topics are Tariff, Sanctions, Export Control, Trade Agreement and Other; countries are two-letter codes.
      </p>
      <p className="mt-3">
        Feeds contain only the title, agency, document type and the opening of the official summary from the Federal Register, with a link to the official
        notice. That source is a U.S. government publication in the public domain; feeds don't carry other publishers' news. Feeds refresh about every ten
        minutes, so please don't poll more often than that. They are free to use for your own reading and internal alerts; the information-only limits below
        apply to them too.
      </p>

      <H>Important limits</H>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>
          <span className="text-ink">The globe's arcs are real; the background routes are decoration.</span> Each arc on the globe runs from the United States to
          a country named in recent Federal Register actions, and its counts and latest notices refresh about every five minutes while the page is open. The
          faint routes and dots behind the globe are scenery between invented points and mean nothing.
        </li>
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
        </Link>{' '}
        and{' '}
        <Link to="/accessibility" className="text-accent">
          Accessibility
        </Link>
        .
      </p>
    </main>
  );
}
