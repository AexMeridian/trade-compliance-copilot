import { Link } from 'react-router-dom';
import { SITE } from '../lib/site';

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="display mt-10 border-t-2 border-ink pt-4 text-2xl text-ink">{children}</h2>;
}

// A conformance *target*, not a claim of a completed third-party audit --
// stating "we aim for X and here's what's actually built toward it" is
// honest in a way "fully accessible" would not be without one.
export function Accessibility() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-sm leading-relaxed text-ink-muted">
      <h1 className="display text-4xl text-ink sm:text-5xl">Accessibility</h1>
      <p className="mt-3 text-base text-ink">
        {SITE.name} aims to meet <span className="text-ink">WCAG 2.1 Level AA</span>. This is a stated target, not a claim that an independent audit has
        confirmed full conformance -- if you hit a barrier, the fastest way to get it fixed is to tell us. Last updated {SITE.accessibilityUpdated}.
      </p>

      <H>What's built in today</H>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>
          <span className="text-ink">Skip-to-content link.</span> The first tab stop on every page jumps past the header navigation straight to the main
          content, for keyboard and screen-reader users.
        </li>
        <li>
          <span className="text-ink">Keyboard-operable tab bars.</span> Every section tab bar (Pulse, Global footprint, Global standing and country pages) is a native ARIA
          tab list with arrow-key, Home and End navigation and a roving tab stop, not a row of styled links.
        </li>
        <li>
          <span className="text-ink">Labelled, not just colored, status.</span> Severity and verdict states (clear, review required, stop; true match,
          inconclusive) are written out in text, not conveyed by color alone.
        </li>
        <li>
          <span className="text-ink">No required account, no time limit.</span> Nothing on the site expires a session or requires sign-up, so there is no
          risk of losing access to a case or a saved filter because of a timeout.
        </li>
        <li>
          <span className="text-ink">Plain-language support.</span> The Guide tabs on Pulse, Global footprint, Global standing and country pages, and the glossary in the
          compliance calculator, explain the site's own jargon (RVC, ECCN, EAR99 and so on) in context rather than assuming it.
        </li>
      </ul>

      <H>Known limits</H>
      <p className="mt-3">
        This is a small, independently built site without a dedicated accessibility audit. Charts convey some information visually (trends, comparative
        bars) that isn't fully restated in text everywhere; news photos from the BBC and The Guardian depend on their own alt text, which we don't control.
        If either of these -- or anything else -- blocks you, please report it.
      </p>

      <H>Report a barrier</H>
      <p className="mt-3">
        {SITE.contactEmail ? (
          <>
            Email{' '}
            <a href={`mailto:${SITE.contactEmail}`} className="text-accent">
              {SITE.contactEmail}
            </a>{' '}
            describing the page, what you were trying to do and the assistive technology (if any) you were using. We'll aim to acknowledge it and fix what
            we can.
          </>
        ) : (
          <>This page will be updated with a contact address for accessibility reports.</>
        )}
      </p>
      <p className="mt-6">
        See also:{' '}
        <Link to="/about" className="text-accent">
          About and sources
        </Link>{' '}
        and{' '}
        <Link to="/privacy" className="text-accent">
          Privacy
        </Link>
        .
      </p>
    </main>
  );
}
