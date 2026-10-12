import { Link } from 'react-router-dom';
import { SITE } from '../lib/site';

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="display mt-10 border-t-2 border-ink pt-4 text-2xl text-ink">{children}</h2>;
}

// A standalone, plain-language statement of the limits of the information. It restates, and does not replace, section 1 to 4 of the Terms.
export function Disclaimer() {
  const co = SITE.legalName || SITE.operator;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 text-sm leading-relaxed text-ink-muted">
      <h1 className="display text-4xl text-ink sm:text-5xl">Disclaimer</h1>
      <p className="mt-3 text-base text-ink">
        {SITE.name} is a free information service run by {co}. Please read these limits before relying on anything you see here. Last updated {SITE.disclaimerUpdated}.
      </p>

      <H>Not professional advice</H>
      <p className="mt-3">
        Nothing on this site is legal, customs, tax, accounting, financial, investment or sanctions-compliance advice, and nothing on it is an offer or a
        recommendation to buy or sell anything. Using the site does not make us your lawyer, customs broker, financial adviser or compliance officer. We are not
        a registered investment adviser, broker-dealer or customs broker. Speak to a qualified professional who can look at your facts.
      </p>

      <H>Market data</H>
      <p className="mt-3">
        Currency rates and indicators are taken from public sources, can be delayed or revised, and are shown for context only. They are not live quotes and must
        not be used to trade, price a contract or value a position. Past movements say nothing reliable about the future.
      </p>

      <H>Sanctions and export controls</H>
      <p className="mt-3">
        A name matching, or not matching, a sanctions list on this site is not a clearance. Lists change daily and matching is imperfect. Before dealing with
        anyone, use the official source (for example the OFAC Sanctions List Search) and your own compliance process.
      </p>

      <H>The Compliance calculator (Beta)</H>
      <p className="mt-3">
        Its classification, origin and duty outputs are AI-assisted suggestions to be checked, not determinations. Customs authorities decide classification,
        origin and duty, and you are responsible for what you declare. See the{' '}
        <Link to="/terms" className="text-accent">
          Terms of use
        </Link>
        .
      </p>

      <H>Accuracy, sources and links</H>
      <p className="mt-3">
        We summarize and label public sources automatically, so errors, delays and omissions happen. Every item links to its source, and the source governs. We
        explain how we work on the{' '}
        <Link to="/methodology" className="text-accent">
          Methodology page
        </Link>
        . We are not responsible for other websites we link to. Maps, names and boundaries are for reference and take no position on any territory.
      </p>

      <H>No affiliation</H>
      <p className="mt-3">
        {SITE.name} is independent. It is not affiliated with, endorsed by or speaking for any government, agency, exchange, news organization or company it mentions.
        Trademarks belong to their owners.
      </p>

      <H>Corrections</H>
      <p className="mt-3">
        If you find a mistake, tell us and we will check it against the source and fix it.
        {SITE.contactEmail && (
          <>
            {' '}
            Email{' '}
            <a href={`mailto:${SITE.contactEmail}`} className="text-accent">
              {SITE.contactEmail}
            </a>
            .
          </>
        )}
      </p>
    </div>
  );
}

export default Disclaimer;
