// Plain-language hints for the jargon this page can't avoid showing (legal
// doc types, agency acronyms, Federal Register citations). Used both as
// `title` tooltips right where the term appears, and as the content of the
// "What am I looking at?" panel (components/PulseGlossary.tsx) -- one set
// of copy, two places it surfaces, so they can't drift out of sync.

export const DOC_TYPE_HINTS: Record<string, string> = {
  Rule: 'A final rule -- a binding change that is already in effect or about to take effect.',
  'Proposed Rule': "Not final yet. The public can still submit comments before this becomes a rule.",
  Notice: 'An administrative announcement -- explains or updates something, not a new binding rule.',
  'Presidential Document': "An executive order or proclamation -- policy directed from the White House.",
};

export const AGENCY_HINTS: Record<string, string> = {
  'Trade Representative': 'Office of the U.S. Trade Representative -- negotiates trade deals and runs Section 301 tariff actions.',
  'Industry and Security Bureau': 'Bureau of Industry and Security, part of the Commerce Department -- controls exports of sensitive technology.',
  'Foreign Assets Control Office': 'Office of Foreign Assets Control, part of the Treasury Department -- runs U.S. sanctions programs.',
  'Customs and Border Protection': 'Part of Homeland Security -- collects tariffs and enforces import rules at the border.',
  'International Trade Administration': 'Part of the Commerce Department -- decides antidumping and countervailing-duty cases (penalties on unfairly priced imports).',
  'International Trade Commission': 'An independent agency that rules on trade injury cases and import bans based on patent infringement.',
  'State Department': 'Handles arms-export controls (ITAR) alongside diplomacy.',
};

export const TAG_HINTS: Record<string, string> = {
  Tariff: 'An extra tax the U.S. charges on a specific imported good.',
  Sanctions: 'Restrictions on doing business with a specific person, company, or country.',
  'Export Control': 'Rules limiting what technology or goods can be shipped out of the U.S.',
  'Trade Agreement': 'A formal deal between countries governing trade, like USMCA.',
  Other: "Doesn't fit neatly into the categories above.",
};

export const CITATION_HINT = 'Federal Register citation -- volume and page number, the official way to cite this document.';

// Plain-language gloss for the market/news panels (tooltips on hover).
export const MARKET_HINTS: Record<string, string> = {
  '^GSPC': 'The S&P 500: a benchmark of 500 large U.S. companies. A rough read on how investors feel about the U.S. economy.',
  '^IXIC': 'The Nasdaq Composite: thousands of stocks, heavy on technology companies.',
  '^DJI': 'The Dow Jones Industrial Average: 30 large, established U.S. companies.',
  '^VIX': 'Often called the fear gauge. It rises when investors expect big swings in the U.S. stock market.',
  '^N225': "Japan's main stock index, the Nikkei 225. Japan is a major exporter, so it reacts to trade news.",
  '^GDAXI': "Germany's main stock index, the DAX. A read on Europe's biggest exporting economy.",
  '^FTSE': "The FTSE 100: the largest companies listed in London.",
  '^HSI': 'The Hang Seng: the main stock index in Hong Kong, a gateway for trade with China.',
  '000001.SS': "The Shanghai Composite: China's main stock index.",
  FDX: 'FedEx: a global shipping company. Its results often signal how much is moving around the world.',
  UPS: 'UPS: a global package and freight carrier, and another read on trade volumes.',
  ZIM: 'ZIM: a container shipping line. Ocean freight companies move with trade volumes and shipping rates.',
  CAT: 'Caterpillar: sells heavy equipment worldwide, so its stock tracks global construction and trade.',
  BA: 'Boeing: one of the largest U.S. exporters, so tariffs and trade disputes hit it directly.',
  AAPL: 'Apple: builds most of its products abroad, so it is sensitive to tariffs and supply-chain shifts.',
  WMT: 'Walmart: one of the largest U.S. importers, so import costs and tariffs matter to it.',
  TSM: "TSMC (Taiwan Semiconductor): makes a large share of the world's advanced chips.",
  'CL=F': 'The price of a barrel of West Texas Intermediate crude oil, the U.S. benchmark. Oil prices ripple through shipping costs and trade balances.',
  'BZ=F': 'Brent crude, the global oil benchmark. Prices here set fuel and freight costs worldwide.',
  'NG=F': 'U.S. natural gas futures, a key input for industry and a growing export.',
  'GC=F': 'Gold, a traditional safe haven that tends to rise when investors are nervous.',
  'HG=F': 'Copper, used in nearly everything from wiring to cars. Its price is a popular read on global manufacturing.',
  '^TNX': "What the U.S. government pays to borrow for 10 years. It sets the tone for borrowing costs worldwide and pulls currency values with it.",
  'DX-Y.NYB': "How strong the U.S. dollar is against a basket of major currencies. Higher means U.S. imports get cheaper and U.S. exports get pricier abroad.",
};

export const NEWS_CATEGORY_HINTS: Record<string, string> = {
  'Trade & Supply Chain': 'Shipping, ports, exports and imports, sanctions, critical materials, and trade deals in the news.',
  'Markets & Currency': 'Stock markets, currencies, central banks, interest rates, inflation, and oil prices.',
  'Elections & Politics': "Headlines about elections in countries we can identify. Pulled from news headlines, not an election calendar, so upcoming elections won't appear until they're reported.",
  Official: 'Direct releases from the European Central Bank.',
};
