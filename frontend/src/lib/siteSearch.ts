import { TARIFF_COUNTRY_LABELS } from './pulseTariffCountries';
import { BLOC_FULL_NAMES, type Bloc } from './pulseBlocs';
import { SITE } from './site';

// A site-wide "jump to" search (SiteSearch.tsx) that needs no network
// request: everything it searches is already bundled with the app --
// page/tab destinations written by hand below, plus every country this app
// has a /country/:code page for (TARIFF_COUNTRY_LABELS, generated, not
// retyped). This is deliberately not the same thing as Pulse's in-feed
// headline search (which searches live article text and has to call the
// API) -- this is a static index of the site's own structure, for someone
// who knows roughly what they want and would rather type than click through
// tabs to find it.
export type SearchEntryType = 'Page' | 'Country' | 'Alliance' | 'Topic' | 'Search';

export interface SearchEntry {
  id: string;
  title: string;
  description: string;
  type: SearchEntryType;
  url: string;
  // Extra words that should match even though they're not in the title or
  // description shown to the reader (abbreviations, alternate names).
  keywords?: string[];
}

const PAGES: SearchEntry[] = [
  {
    id: 'pulse',
    title: 'Wire',
    description: 'The live feed: new U.S. trade notices, mapped, with markets and news. Every country named in recent U.S. government notices on tariffs, sanctions or export limits.',
    keywords: ['pulse', 'feed', 'home'],
    type: 'Page',
    url: '/',
  },
  {
    id: 'calculator',
    title: 'Compliance calculator',
    description: 'Run a shipment through classification, origin, party screening and duty determination.',
    type: 'Page',
    url: '/calculator',
    keywords: ['hts', 'classify', 'duty', 'tariff calculator', 'screening'],
  },
  {
    id: 'hard-power',
    title: 'Hard Power',
    description: 'Sanctioned parties, tariffs and export controls, the dollar and Treasury holders, NATO and defense spending, by country.',
    type: 'Page',
    url: '/hard-power',
    keywords: ['u.s. abroad', 'dollar & allies', 'sanctions', 'tariffs'],
  },
  {
    id: 'soft-power',
    title: 'Soft Power',
    description: 'What draws people to a country: views of the U.S. and China, students, tourism, science, governance, aid and UN voting. No score.',
    type: 'Page',
    url: '/soft-power',
    keywords: ['soft power', 'nye', 'attraction', 'influence', 'favorability'],
  },
  {
    id: 'soft-attitudes',
    title: 'Attitudes: views of the U.S. and China',
    description: 'Pew Research Center polls and Afrobarometer on how people in other countries rate the U.S. and China.',
    type: 'Page',
    url: '/soft-power?tab=attitudes',
    keywords: ['pew', 'afrobarometer', 'favorability', 'opinion', 'poll'],
  },
  {
    id: 'soft-culture',
    title: 'Culture and exchange',
    description: 'International students, tourism, migrants, remittances, research output and Nobel laureates by country.',
    type: 'Page',
    url: '/soft-power?tab=culture',
    keywords: ['students', 'tourism', 'science', 'nobel'],
  },
  {
    id: 'soft-values',
    title: 'Political values: governance indicators',
    description: 'World Bank Worldwide Governance Indicators by country: voice, rule of law, corruption control.',
    type: 'Page',
    url: '/soft-power?tab=values',
    keywords: ['governance', 'wgi', 'corruption', 'rule of law'],
  },
  {
    id: 'soft-foreign',
    title: 'Foreign policy and aid',
    description: 'Official aid, humanitarian funding, refugees sheltered and how each country votes at the UN.',
    type: 'Page',
    url: '/soft-power?tab=foreign',
    keywords: ['aid', 'oda', 'humanitarian', 'refugees', 'un voting'],
  },
  {
    id: 'compare',
    title: 'Compare countries: trade policy',
    description: 'Put countries side by side on tariffs, sanctions exposure and export controls.',
    type: 'Page',
    url: '/hard-power?tab=compare',
  },
  {
    id: 'power-profile',
    title: 'Compare countries: soft power',
    description: 'Governance, aid, tourism, migration, research and opinion for up to four countries, each ranked with its source. No score.',
    type: 'Page',
    url: '/soft-power?tab=compare',
    keywords: ['power profile', 'soft power', 'hard power', 'aid', 'governance', 'oda', 'wgi', 'influence', 'nye'],
  },
  {
    id: 'about',
    title: `About ${SITE.name}`,
    description: 'What this app is, its data sources, and how it works.',
    type: 'Page',
    url: '/about',
    keywords: ['sources', 'methodology'],
  },
  { id: 'privacy', title: 'Privacy', description: 'What data this app collects, and what it deliberately does not.', type: 'Page', url: '/privacy' },
  {
    id: 'accessibility',
    title: 'Accessibility',
    description: "This app's accessibility conformance target and how to report a barrier.",
    type: 'Page',
    url: '/accessibility',
  },
  { id: 'cookies', title: 'Cookies and local storage', description: 'No cookies are set; the few items kept in your browser and why.', type: 'Page', url: '/cookies' },
  { id: 'disclaimer', title: 'Disclaimer', description: 'The limits of the information: not advice, not for trading, not a sanctions clearance.', type: 'Page', url: '/disclaimer' },
  { id: 'copyright', title: 'Copyright and takedown requests', description: 'Who owns what, and how to ask us to remove something.', type: 'Page', url: '/copyright', keywords: ['dmca'] },
  { id: 'security', title: 'Security and responsible disclosure', description: 'How to report a vulnerability and how we protect the site.', type: 'Page', url: '/security', keywords: ['vulnerability', 'bug'] },
  {
    id: 'pulse-guide',
    title: 'Guide: how to read the Wire',
    description: 'New here? What each number, chart and tab on the Wire page means.',
    type: 'Page',
    url: '/?tab=guide',
  },
  {
    id: 'pulse-policy',
    title: 'U.S. policy feed',
    description: 'Every tariff, sanctions and export-control action, newest first -- filter by topic or country.',
    type: 'Page',
    url: '/?tab=policy',
    keywords: ['federal register', 'feed'],
  },
  {
    id: 'pulse-markets',
    title: 'Markets',
    description: 'Currency rates and key U.S. economic indicators.',
    type: 'Page',
    url: '/?tab=markets',
    keywords: ['stocks', 'currencies', 'fx', 'commodities'],
  },
  {
    id: 'pulse-news',
    title: 'News',
    description: 'Trade, markets and politics headlines from real outlets, each tagged with its real category.',
    type: 'Page',
    url: '/?tab=news',
  },
  {
    id: 'pulse-data',
    title: 'Raw data tables',
    description: 'Browse the underlying tariff and export-control reference tables directly.',
    type: 'Page',
    url: '/hard-power?tab=trade',
  },
  {
    id: 'power-alliances',
    title: 'Military and alliances',
    description: "Formal membership in NATO, G7, G20, BRICS and USMCA, cross-referenced with this month's U.S. actions, and NATO defense spending.",
    type: 'Page',
    url: '/hard-power?tab=military',
  },
  { id: 'rss', title: 'RSS feed', description: 'Follow new U.S. trade actions in any feed reader -- no account needed.', type: 'Page', url: '/rss.xml' },
];

// Real, public alliance facts (lib/pulseBlocs.ts) -- one search entry per
// bloc, routed to the Alliances tab where its full membership list lives.
const ALLIANCES: SearchEntry[] = (Object.keys(BLOC_FULL_NAMES) as Bloc[]).map((bloc) => ({
  id: `bloc-${bloc}`,
  title: bloc,
  description: BLOC_FULL_NAMES[bloc],
  type: 'Alliance',
  url: '/hard-power?tab=military',
}));

// Real programs and lists this app actually screens or rates against, each
// described the way it's described where it actually appears in the app --
// not a separate, invented catalog. Linked to the page the fact is surfaced
// on, since none of these has its own standalone page.
const TOPICS: SearchEntry[] = [
  {
    id: 'topic-301',
    title: 'Section 301 forced-labor rate',
    description:
      "A tariff rate applied across nearly a country's whole tariff schedule, not one product category. Shown in the calculator and on each country's page.",
    type: 'Topic',
    url: '/calculator',
    keywords: ['forced labor', 'tariff'],
  },
  {
    id: 'topic-232',
    title: 'Section 232 metals cap',
    description: 'A country-specific cap on steel/aluminum tariffs, below the standard baseline rate for some countries.',
    type: 'Topic',
    url: '/calculator',
    keywords: ['steel', 'aluminum', 'metals', 'tariff'],
  },
  {
    id: 'topic-338',
    title: 'Section 338 extra duty (Canada)',
    description: 'An additional country-specific duty layer, shown alongside the other tariff programs in the duty stack.',
    type: 'Topic',
    url: '/calculator',
    keywords: ['canada', 'tariff'],
  },
  {
    id: 'topic-de-minimis',
    title: 'De minimis (Section 321)',
    description: 'A shipment valued under $800 is often, but not always, exempt from duty -- the calculator discloses the real caveats for your case.',
    type: 'Topic',
    url: '/calculator',
    keywords: ['section 321', '$800', 'duty-free'],
  },
  {
    id: 'topic-sdn',
    title: 'OFAC Specially Designated Nationals (SDN) list',
    description: "Treasury's sanctioned-party list. Screened automatically in the calculator and counted on each country's Sanctions tab.",
    type: 'Topic',
    url: '/calculator',
    keywords: ['ofac', 'sdn', 'treasury', 'sanctions'],
  },
  {
    id: 'topic-csl',
    title: 'Commerce/State Consolidated Screening List',
    description: 'A combined export-related screening list (Entity List, Denied Persons List and more), screened in the calculator.',
    type: 'Topic',
    url: '/calculator',
    keywords: ['csl', 'entity list', 'denied persons list', 'export control'],
  },
  {
    id: 'topic-un-sanctions',
    title: 'UN Security Council sanctions list',
    description: 'A true match is treated as a hard stop on an export, the same severity as a BIS Entity List/Denied Persons List hit.',
    type: 'Topic',
    url: '/calculator',
    keywords: ['united nations', 'sanctions'],
  },
  {
    id: 'topic-uk-sanctions',
    title: 'UK sanctions list',
    description: "The UK's own financial sanctions list, screened alongside the U.S. lists in the calculator.",
    type: 'Topic',
    url: '/calculator',
    keywords: ['united kingdom', 'sanctions'],
  },
  {
    id: 'topic-meu',
    title: 'Military End User (MEU) List',
    description: 'An end-use/end-user export control, distinct from a denied-party hard stop -- it can mean extra license requirements apply.',
    type: 'Topic',
    url: '/calculator',
    keywords: ['bis', 'export control'],
  },
  {
    id: 'topic-export-control',
    title: 'Export-control status (Commerce Country Chart)',
    description: "A destination country's license-requirement status -- hand-verified for a limited set of destinations so far.",
    type: 'Topic',
    url: '/compare',
    keywords: ['bis', 'commerce country chart', 'license'],
  },
  {
    id: 'topic-uflpa',
    title: 'Forced-labor enforcement (CBP Withhold Release Orders)',
    description: "CBP's Section 307 forced-labor enforcement actions by country -- distinct from DHS's own, separately-published UFLPA Entity List.",
    type: 'Topic',
    url: '/compare',
    keywords: ['uflpa', 'wro', 'cbp', 'forced labor'],
  },
  {
    id: 'topic-gta',
    title: "A country's own measures against the U.S.",
    description: "Independent research data (Global Trade Alert), not a U.S. government source -- a foreign government's own retaliatory trade measures.",
    type: 'Topic',
    url: '/compare',
    keywords: ['global trade alert', 'retaliation', 'retaliatory'],
  },
  {
    id: 'topic-cross',
    title: 'CBP binding rulings (CROSS)',
    description: "For a binding answer instead of an estimate: CBP's own ruling database, linked from the calculator's duty-stack result.",
    type: 'Topic',
    url: '/calculator',
    keywords: ['cross', 'rulings.cbp.gov', 'binding ruling'],
  },
];

export const SEARCH_INDEX: SearchEntry[] = [
  ...PAGES,
  ...ALLIANCES,
  ...TOPICS,
  ...Object.entries(TARIFF_COUNTRY_LABELS).map(([code, name]): SearchEntry => ({
    id: `country-${code}`,
    title: name,
    description: `${name}'s U.S. trade actions, tariff rates, export-control status and sanctioned-entity count.`,
    type: 'Country',
    url: `/country/${code}`,
    keywords: [code],
  })),
];

function score(entry: SearchEntry, q: string): number {
  const title = entry.title.toLowerCase();
  if (title === q) return 100;
  if (title.startsWith(q)) return 80;
  if (title.includes(q)) return 60;
  if (entry.keywords?.some((k) => k.toLowerCase().startsWith(q))) return 50;
  if (entry.keywords?.some((k) => k.toLowerCase().includes(q))) return 35;
  if (entry.description.toLowerCase().includes(q)) return 20;
  return 0;
}

// Pure, synchronous, client-side -- no fetch, no debounce needed. Ranked by
// how well a result matches (title match beats a keyword or description
// match), then alphabetically within the same rank.
/** The last row of every query: hand the words to the live U.S. policy search, which reads real notice titles and abstracts. */
export function policySearchEntry(query: string): SearchEntry | null {
  const q = query.trim();
  if (q.length < 2) return null;
  return {
    id: 'policy-search',
    title: `Search U.S. policy notices for "${q}"`,
    description: 'Looks through the titles and summaries of every collected notice, not just the pages listed here.',
    type: 'Search',
    url: `/?tab=policy&q=${encodeURIComponent(q)}`,
  };
}

export function searchSite(query: string, limit = 8): SearchEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return SEARCH_INDEX.map((entry) => ({ entry, s: score(entry, q) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || a.entry.title.localeCompare(b.entry.title))
    .slice(0, limit)
    .map((r) => r.entry);
}
