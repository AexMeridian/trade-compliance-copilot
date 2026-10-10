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
        {SITE.legalName || SITE.operator} is committed to making {SITE.name} usable by everyone, including people who use screen readers, keyboards, voice
        control or magnification. We aim to meet <span className="text-ink">WCAG 2.1 Level AA</span> (the standard referenced by the Americans with
        Disabilities Act guidance, Section 508 and EN 301 549). This is a target, not a claim that an independent audit has confirmed full conformance.
        Last updated {SITE.accessibilityUpdated}.
      </p>

      <H>What's built in today</H>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>
          <span className="text-ink">Skip-to-content link.</span> The first tab stop on every page jumps past the header navigation straight to the main
          content, for keyboard and screen-reader users.
        </li>
        <li>
          <span className="text-ink">Keyboard-operable tab bars.</span> Every section tab bar (Pulse, U.S. abroad, Dollar & allies and country pages) is a native ARIA
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
          <span className="text-ink">Plain-language support.</span> The Guide tabs on Pulse, U.S. abroad, Dollar & allies and country pages, and the glossary in the
          compliance calculator, explain the site's own jargon (RVC, ECCN, EAR99 and so on) in context rather than assuming it.
        </li>
      </ul>

      <H>How we test</H>
      <p className="mt-3">
        Before each release we run automated checks (axe-core, driven through a real browser) on every page, in light and dark themes, at desktop and phone
        widths. The most recent run found no serious or critical violations in any of those combinations. Automated tools detect only part of the possible
        problems, so we also test keyboard navigation and review contrast by hand. We have not yet commissioned an independent audit or a formal Voluntary
        Product Accessibility Template (VPAT); we will say here when we do.
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>
          <span className="text-ink">Colour and contrast.</span> Text meets the 4.5:1 contrast minimum (3:1 for large text) in both themes, and links inside
          running text are underlined so they do not depend on colour.
        </li>
        <li>
          <span className="text-ink">Names and labels.</span> Form controls and icon buttons have accessible names; the language of the page is declared.
        </li>
        <li>
          <span className="text-ink">Reflow and zoom.</span> Pages reflow to a 390-pixel-wide screen without sideways scrolling.
        </li>
        <li>
          <span className="text-ink">Motion.</span> The animated globe on the Pulse page respects the "reduce motion" setting of your device, and every fact
          it shows is also available in the lists and tables on the page.
        </li>
        <li>
          <span className="text-ink">Themes.</span> A light and a dark theme are available from the toggle in the header and your choice is remembered in your browser. Light is the
          default.
        </li>
      </ul>

      <H>Known limits</H>
      <p className="mt-3">
        This is a small, independently built site without a dedicated accessibility audit. Some charts convey information visually (trends, comparative
        bars) that is not fully restated in text everywhere, and the interactive globe is not fully operable by keyboard (its data is repeated in tables).
        Linked third-party pages, such as official sources and news articles, are outside our control. If any of this -- or anything else -- blocks you,
        please report it.
      </p>

      <H>Report a barrier</H>
      <p className="mt-3">
        {SITE.contactEmail ? (
          <>
            Email{' '}
            <a href={`mailto:${SITE.contactEmail}`} className="text-accent">
              {SITE.contactEmail}
            </a>{' '}
            describing the page, what you were trying to do and the assistive technology (if any) you were using. We aim to reply within five business days and to
            tell you what we will do and when; if you cannot use the site at all, we will help you get the information by another route, such as sending the
            underlying source link or a plain-text copy.
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
