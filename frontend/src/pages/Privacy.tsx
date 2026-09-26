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
        <li>If you use the Compliance calculator, what you enter is stored and processed by an AI service. See below before entering anything sensitive.</li>
      </ul>

      <H>What stays on your device</H>
      <p className="mt-3">
        The site remembers two things using your browser's local storage: the topics, countries and markets you chose under "Customize feed", and whether you
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
        The site itself loads nothing from other companies except news photos: on items from the BBC and The Guardian, your browser fetches the photo directly
        from that publisher, which can therefore see your IP address as with any image on the web. If you follow a link to an article or an official source,
        that site's own policies apply.
      </p>

      <H>The Compliance calculator</H>
      <p className="mt-3">
        When you create a case in the{' '}
        <Link to="/calculator" className="text-accent">
          Compliance calculator
        </Link>
        , the details you enter (for example a product description and countries) are saved so you can return to your report, and are sent to an AI service
        (Anthropic) to produce classification and determination suggestions. Each case lives at its own link, and anyone who has that link can open it, so don't
        share it with people you don't want to see it. Please don't enter confidential or personal information. There is currently no self-service way to delete
        a case.
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
        <Link to="/about" className="text-accent">
          About and sources
        </Link>
        .
      </p>
    </main>
  );
}
