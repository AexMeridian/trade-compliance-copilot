// Facts about the site itself, in one place, so launch-time details are set
// once. Anything left empty is simply not shown -- nothing is invented.

export const SITE = {
  name: 'Trade Policy Pulse',
  operator: 'Aex Meridian',
  // Where readers can send corrections and privacy questions. Set this to a
  // monitored address before launch; while empty, no contact line is shown.
  contactEmail: '',
  // "Last updated" dates on the About and Privacy pages. Change them whenever
  // those pages change.
  aboutUpdated: '2026-09-25',
  privacyUpdated: '2026-09-25',
} as const;
