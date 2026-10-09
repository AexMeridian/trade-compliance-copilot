import { Link } from 'react-router-dom';
import { SITE } from '../lib/site';

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="display mt-10 border-t-2 border-ink pt-4 text-2xl text-ink">{children}</h2>;
}

// Written to describe what the site actually does today. If any of it
// changes (analytics added, accounts introduced, a new third-party service),
// this page and its date must change with it.
export function Privacy() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-sm leading-relaxed text-ink-muted">
      <h1 className="display text-4xl text-ink sm:text-5xl">Privacy</h1>
      <p className="mt-3 text-base text-ink">
        {SITE.name} has no accounts, no ads and no tracking scripts. This page explains exactly what is and isn't collected. Last updated {SITE.privacyUpdated}.
      </p>

      <H>The short version</H>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>We don't ask who you are, and the news, policy and markets pages work without giving us anything.</li>
        <li>The site doesn't set cookies and doesn't load analytics, advertising or third-party fonts.</li>
        <li>Your feed choices stay in your own browser.</li>
        <li>
          If you use the Compliance calculator (Beta), what you enter is stored for 30 days and processed by an AI service. You can delete a case
          sooner. See below before entering anything sensitive.
        </li>
      </ul>

      <H>Who is responsible</H>
      <p className="mt-3">
        The operator of {SITE.name} is {SITE.legalName || SITE.operator}
        {SITE.location ? `, ${SITE.location}` : ''}, and is the controller of the personal data described here.
        {SITE.contactEmail && (
          <>
            {' '}
            Contact:{' '}
            <a href={`mailto:${SITE.contactEmail}`} className="text-accent">
              {SITE.contactEmail}
            </a>
            .
          </>
        )}
      </p>

      <H>What stays on your device</H>
      <p className="mt-3">
        The site remembers two things using your browser's local storage: the topics, countries and markets you chose under "Filter", and whether you
        have dismissed the welcome card. This never leaves your device. Clearing your browser's site data, or using "Reset to default", removes it.
      </p>

      <H>What our hosting records</H>
      <p className="mt-3">
        The site runs on Cloudflare. To deliver pages, protect against abuse and keep the service reliable, Cloudflare and the site's operational logs record
        technical details of each request, such as the page or data requested, the time, the response status and network information such as your IP address. We
        use these logs to keep the site running and secure, not to profile visitors. IP addresses are also used briefly to limit how fast one visitor can call
        the site.
      </p>

      <H>Other companies your browser may contact</H>
      <p className="mt-3">
        The site itself loads nothing from other companies: no fonts, scripts, analytics, advertising or photographs. If you follow a link to an article or an
        official source, that site's own policies apply.
      </p>

      <H>News feeds (RSS)</H>
      <p className="mt-3">
        The RSS, Atom and JSON feeds are ordinary web requests, handled like any other page above. They contain no tracking links, images or per-reader
        identifiers, set no cookies and load nothing from other companies. Feed readers usually fetch them automatically, so your reader's own service may
        see which feeds you follow; that is governed by its policy, not ours.
      </p>

      <H>The Compliance calculator</H>
      <p className="mt-3">
        When you create a case in the{' '}
        <Link to="/calculator" className="text-accent">
          Compliance calculator
        </Link>
        , the details you enter (for example a product description and countries) are saved so you can return to your report, and are sent to an AI service
        (Anthropic) to produce classification and determination suggestions. Each case lives at its own link, and anyone who has that link can open it, so don't
        share it with people you don't want to see it. Please don't enter confidential or personal information; party names you screen are the one place
        personal data may appear, and screening them is optional.
      </p>
      <p className="mt-3">
        A case is deleted automatically 30 days after it is created. The browser that created it can delete it earlier with the "Delete this case now" button
        on its report; the secret that allows this is kept only in that browser, and we store just a hash of it. If you lose it, the case still expires on
        schedule, or email us with the case link and we will remove it.
      </p>

      <H>Why we process data, and for how long</H>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>
          <span className="text-ink">Delivering and securing the site</span> (request logs, rate limiting): our legitimate interest in running a secure
          service. Kept by Cloudflare for the periods in its own policy; we do not build visitor profiles.
        </li>
        <li>
          <span className="text-ink">Calculator cases</span> (what you enter, the AI exchange and the results): to provide the tool you asked for. Deleted
          after 30 days or when you delete the case. The audit trail of AI requests is deleted with the case.
        </li>
        <li>
          <span className="text-ink">Saved chart snapshots</span> contain only public data the site published, no personal data, and are kept so a citation
          link keeps working.
        </li>
        <li>
          <span className="text-ink">Emails you send us</span>: to answer you, kept as long as needed for that purpose.
        </li>
      </ul>

      <H>Who processes data for us, and where</H>
      <p className="mt-3">
        Cloudflare, Inc. hosts the site and its database. Anthropic, PBC processes calculator text to generate suggestions. Both may process data in the United
        States and other countries; where personal data leaves the UK or the European Economic Area we rely on the safeguards those providers offer, such as
        standard contractual clauses. We do not sell personal data and do not use it for advertising.
      </p>

      <H>Your rights</H>
      <p className="mt-3">
        Depending on where you live (including under the GDPR, the UK GDPR and the California Consumer Privacy Act), you may ask us for access to, correction
        or deletion of personal data we hold about you, object to or restrict its use, and complain to your data protection authority. Because we do not keep
        accounts, we may need the case link to find what you entered. This site is not directed at children.
      </p>

      <H>Questions</H>
      <p className="mt-3">
        {SITE.contactEmail ? (
          <>
            Email{' '}
            <a href={`mailto:${SITE.contactEmail}`} className="text-accent">
              {SITE.contactEmail}
            </a>{' '}
            with any privacy question or to ask about a case you created.
          </>
        ) : (
          <>This page will be updated with a contact address for privacy questions.</>
        )}
      </p>
      <p className="mt-6">
        See also:{' '}
        <Link to="/methodology" className="text-accent">
          Methodology and sources
        </Link>
        ,{' '}
        <Link to="/terms" className="text-accent">
          Terms of use
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
