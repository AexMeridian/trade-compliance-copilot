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
  legalName: '', // e.g. the registered company name
  location: '', // e.g. 'City, Country'
  governingLaw: '', // wording for the Terms' governing-law clause, supplied by counsel
  team: [] as { name: string; role: string; bio: string }[], // real people and credentials only
  // "Last updated" dates on the About, Privacy and Accessibility pages.
  // Change them whenever those pages change.
  aboutUpdated: '2026-10-07',
  privacyUpdated: '2026-10-07',
  termsUpdated: '2026-10-09',
  accessibilityUpdated: '2026-09-30',
} as const;
