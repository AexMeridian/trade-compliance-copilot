// Facts about the site itself, in one place, so launch-time details are set
// once. Anything left empty is simply not shown -- nothing is invented.

export const SITE = {
  name: 'Aex Terminal',
  operator: 'Aex Meridian',
  // Where readers can send corrections and privacy questions. Set this to a
  // monitored address before launch; while empty, no contact line is shown.
  contactEmail: 'CEO@AexMeridian.com',
  // Facts only the operator can supply. While empty, the pages that would show them simply omit
  // them -- nothing is invented. Set these before a public launch (see the Terms and About pages).
  legalName: 'Aex Meridian, LLC',
  location: 'Colorado, United States', // state of organization; add a mailing address once one is published
  governingLaw: 'These terms and any dispute arising from them are governed by the laws of the State of Colorado, United States, without regard to its conflict-of-laws rules. Subject to the paragraph below, the state and federal courts located in Colorado have exclusive jurisdiction, and you and we consent to their personal jurisdiction and venue. Consumers who live elsewhere keep any mandatory protections of the law of their home country or state, and any right they have to bring a claim in their local courts.',
  team: [] as { name: string; role: string; bio: string }[], // real people and credentials only
  // "Last updated" dates on the About, Privacy and Accessibility pages.
  // Change them whenever those pages change.
  aboutUpdated: '2026-10-09',
  privacyUpdated: '2026-10-09',
  termsUpdated: '2026-10-09',
  accessibilityUpdated: '2026-10-09',
} as const;
