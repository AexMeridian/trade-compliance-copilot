// What each address says about itself in the page head: title, description, canonical address and whether it should be indexed.
// One plain function with no dependencies, used by the app (to keep the tab title and tags right as the reader moves around)
// and by the Worker (to put the same tags in the HTML it serves, so link previews and crawlers that do not run scripts see
// them). The app is a single-page app, so without the Worker every address would ship the home page's tags.

export const SITE_NAME = 'Aex Terminal';
export const SITE_ORIGIN = 'https://aexterminal.com';

export interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  /** False for private or unknown addresses: they get `noindex`. */
  indexable: boolean;
  /** False when the address is not a page of this site (the Worker answers 404). */
  known: boolean;
  /** Share-preview image for pages that have their own; the others use the home page's. */
  image?: string;
  /** Page language when it is not English (the Worker and the app set <html lang>). */
  lang?: string;
  /** hreflang alternates for a page that exists in more than one language (each lists itself and x-default). */
  alternates?: { hreflang: string; href: string }[];
}

const HOME_DESCRIPTION =
  "What's changing in world trade, in plain English. New U.S. tariff, sanctions and export-control actions from the Federal Register, with currencies, economic data and trade news, and a sourced Beta compliance calculator. Free, no sign-up.";

// Pages with their own share-preview image (frontend/public/og/<slug>.png, 1200 x 630).
const OG_IMAGE: Record<string, string> = {
  '/calculator': `${SITE_ORIGIN}/og/calculator.png`,
  '/hard-power': `${SITE_ORIGIN}/og/hard-power.png`,
  '/soft-power': `${SITE_ORIGIN}/og/soft-power.png`,
};

const PAGES: Record<string, { title: string; description: string }> = {
  '/calculator': {
    title: 'Compliance calculator',
    description: 'A Beta calculator that classifies a product, checks origin and USMCA eligibility, screens parties against sanctions lists and builds a sourced duty stack. Not legal or customs advice.',
  },
  '/hard-power': {
    title: 'Hard Power: sanctions, tariffs, the dollar and defense',
    description: 'What the U.S. can compel or withhold: sanctioned parties, tariffs and export controls, the dollar and Treasury holders, NATO and defense spending, and a country comparison, each with its source.',
  },
  '/soft-power': {
    title: 'Soft Power: attitudes, culture, values and aid',
    description: 'What draws people to a country: published polls on views of the U.S. and China, students, tourism, science, governance, aid and UN voting, by country and year, with no combined score.',
  },
  '/basics': { title: 'Trade in plain English', description: 'Start here if you are not a trade professional: prices and tariffs, small packages from abroad, a free tariff lookup, the U.S. and China side by side, and a glossary.' },
  '/dashboard': { title: 'Dashboard', description: 'What is going on in the economy, trade, politics and the world right now, in plain words, with the source and date for every number.' },
  '/today': { title: 'Dashboard', description: 'What is going on in the economy, trade, politics and the world right now, in plain words, with the source and date for every number.' },
  '/prices': { title: 'Tariffs and your wallet', description: 'Official price changes for groceries, medicine, appliances, cars, clothes and toys, jobs in steel and cars with tariff dates marked, and the customs duties collected each month.' },
  '/lookup': { title: 'Tariff lookup', description: 'Free tariff lookup: search a product by words or HTS code, pick the country it is made in, and see every modeled U.S. tariff layer added up. No account, no AI.' },
  '/de-minimis': { title: 'Small packages from abroad now pay duty', description: 'What happened to the $800 de minimis exemption, when it changed, who collects the duty on packages, and what buyers abroad pay.' },
  '/glossary': { title: 'Glossary', description: 'Tariff, HTS, de minimis, sanctions, export controls, CPI and every other term on Aex Terminal, in plain English.' },
  '/us-china': { title: 'The United States and China, side by side', description: 'Every measure Aex Terminal holds for both countries, economy, military, trade, knowledge and global opinion, with year, rank and source.' },
  '/changes': { title: 'What changed on the sanctions lists', description: 'Parties added to and removed from the OFAC SDN list, the Entity List and other screening lists, the UN list and the UK list, day by day, with a permalink per day and an RSS feed.' },
  '/about': { title: 'About', description: 'Who runs Aex Terminal, what it covers, where its data comes from and how it is kept accurate.' },
  '/methodology': { title: 'Methodology and sources', description: 'How every figure on Aex Terminal is calculated, each source and its licence, what is not measured, and how corrections are made.' },
  '/terms': { title: 'Terms of use', description: 'The terms for using Aex Terminal.' },
  '/privacy': { title: 'Privacy', description: 'What Aex Terminal collects, what it does not, and how long calculator cases are kept.' },
  '/accessibility': { title: 'Accessibility', description: 'How Aex Terminal supports keyboard, screen-reader and low-vision use, and how to report a barrier.' },
  '/cookies': { title: 'Cookies and local storage', description: 'What Aex Terminal stores in your browser and why.' },
  '/disclaimer': { title: 'Disclaimer', description: 'What Aex Terminal is and is not: information, not legal, customs, sanctions or investment advice.' },
  '/copyright': { title: 'Copyright and takedown requests', description: 'Copyright notices and how to send a takedown request to Aex Terminal.' },
  '/security': { title: 'Security and responsible disclosure', description: 'How to report a security issue to Aex Terminal, and how the site is protected.' },
};

// Spanish translations of three plain-language pages (frontend/src/i18n). The English page is the page of record: every Spanish address
// lists both versions as hreflang alternates, and English is x-default. Tagalog would add another entry here and in i18n/lang.ts.
const ES_PAGES: Record<string, { title: string; description: string }> = {
  '/basics': { title: 'El comercio, en lenguaje sencillo', description: 'Empiece aquí si no es profesional del comercio: precios y aranceles, paquetes pequeños del extranjero, consulta gratuita de aranceles, Estados Unidos y China lado a lado, y un glosario. Traducción al español.' },
  '/de-minimis': { title: 'Los paquetes pequeños del extranjero ahora pagan aranceles', description: 'Qué pasó con la exención de minimis de $800, cuándo cambió, quién cobra el arancel, qué pagan los compradores en el extranjero y qué puede traer de un viaje. Traducción al español.' },
  '/glossary': { title: 'Glosario', description: 'Arancel, HTS, de minimis, sanciones, controles de exportación, IPC y los demás términos de Aex Terminal, en lenguaje sencillo. Traducción al español.' },
};
function alternatesFor(base: string): { hreflang: string; href: string }[] {
  return [
    { hreflang: 'en', href: `${SITE_ORIGIN}${base}` },
    { hreflang: 'es', href: `${SITE_ORIGIN}/es${base}` },
    { hreflang: 'x-default', href: `${SITE_ORIGIN}${base}` },
  ];
}

// Old addresses that still open a page (the app redirects them).
const LEGACY = ['/abroad', '/allies', '/compare', '/footprint', '/standing', '/vs-world', '/influence', '/power'];

/**
 * Head details for an address. `tabLabel` is the home page's current tab label (the app passes it; the Worker does not, so it
 * serves the home page's own tags for `/`). `countryName` is the display name for /country/:code, or null for an unknown code.
 */
export function pageMeta(pathname: string, tab: string | null, tabLabel: string | null, countryName: string | null): PageMeta {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const base = (title: string, description: string, canonical = clean): PageMeta => ({
    title: `${title} | ${SITE_NAME}`,
    description,
    canonical: `${SITE_ORIGIN}${canonical}`,
    indexable: true,
    known: true,
  });

  if (clean === '/') {
    const onTab = tab && tab !== 'overview' && tabLabel;
    return {
      title: onTab ? `${tabLabel} | ${SITE_NAME}` : `${SITE_NAME}: U.S. tariffs, sanctions, markets and trade news in plain English`,
      description: HOME_DESCRIPTION,
      canonical: `${SITE_ORIGIN}/${onTab ? `?tab=${encodeURIComponent(tab)}` : ''}`,
      indexable: true,
      known: true,
    };
  }
  const es = /^\/es(\/.*)$/.exec(clean)?.[1];
  if (es && ES_PAGES[es]) return { ...base(ES_PAGES[es].title, ES_PAGES[es].description), lang: 'es', alternates: alternatesFor(es) };
  const page = PAGES[clean];
  if (page) return { ...base(page.title, page.description), image: OG_IMAGE[clean], ...(ES_PAGES[clean] ? { alternates: alternatesFor(clean) } : {}) };
  if (LEGACY.includes(clean)) return base('Redirecting', HOME_DESCRIPTION, clean);

  if (/^\/case\/[^/]+(\/report)?$/.test(clean)) {
    return { title: `Compliance case | ${SITE_NAME}`, description: 'A private compliance calculator case.', canonical: `${SITE_ORIGIN}${clean}`, indexable: false, known: true };
  }
  if (/^\/snapshot\/[^/]+$/.test(clean)) {
    return { title: `Cited snapshot | ${SITE_NAME}`, description: 'A frozen, citable copy of a chart as it looked when it was saved.', canonical: `${SITE_ORIGIN}${clean}`, indexable: false, known: true };
  }
  const changeDay = /^\/changes\/(\d{4}-\d{2}-\d{2})$/.exec(clean);
  if (changeDay) return base(`List changes on ${changeDay[1]}`, `Parties added to and removed from the OFAC SDN, Consolidated Screening List (including the Entity List), UN and UK sanctions lists on ${changeDay[1]}.`);
  const country = /^\/country\/([A-Za-z]{2})$/.exec(clean);
  if (country) {
    const code = country[1].toUpperCase();
    if (countryName === null) return { title: `Page not found | ${SITE_NAME}`, description: 'This page does not exist.', canonical: `${SITE_ORIGIN}${clean}`, indexable: false, known: false };
    return {
      title: `${countryName} | ${SITE_NAME}`,
      description: `What U.S. trade policy means for ${countryName}: policy actions, tariff rates, export-control status, sanctions listings and how it compares, each with its source.`,
      canonical: `${SITE_ORIGIN}/country/${code.toLowerCase()}`,
      indexable: true,
      known: true,
    };
  }
  return { title: `Page not found | ${SITE_NAME}`, description: 'This page does not exist.', canonical: `${SITE_ORIGIN}${clean}`, indexable: false, known: false };
}
