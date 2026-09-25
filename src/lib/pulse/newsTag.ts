// Deterministic relevance filter + categoriser for world news -- no LLM,
// same house rule as tag.ts. Commercial general-news feeds are NOT
// trade-specific (verified: BBC Business carries consumer stories such as
// "Would you chase a friend for £5?"), so an item is dropped unless it
// matches at least one rule below. Official trade/central-bank feeds are
// on-topic by nature and pass through. The refresh reports kept/dropped
// counts instead of loosening these rules to pad the feed.
import { extractCountries } from './country.js';

export type NewsCategory = 'Trade & Supply Chain' | 'Markets & Currency' | 'Elections & Politics' | 'Official';

export interface NewsFeed {
  key: string;
  source: string;
  url: string;
  // 'official' feeds are on-topic by nature (ECB) and skip the relevance
  // filter; 'filtered' feeds must match a rule.
  kind: 'official' | 'filtered';
}

// Checked and rejected: USTR's RSS (verified to mix items from 2009 through
// 2026 unsorted) and the WTO's (works from a laptop but returns HTTP 403 to
// Cloudflare Workers' egress IPs -- an IP-level block, not worth evading).
export const NEWS_FEEDS: NewsFeed[] = [
  { key: 'ecb', source: 'European Central Bank', url: 'https://www.ecb.europa.eu/rss/press.html', kind: 'official' },
  { key: 'fed', source: 'Federal Reserve', url: 'https://www.federalreserve.gov/feeds/press_all.xml', kind: 'filtered' },
  { key: 'bbc-business', source: 'BBC News', url: 'https://feeds.bbci.co.uk/news/business/rss.xml', kind: 'filtered' },
  { key: 'bbc-world', source: 'BBC News', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', kind: 'filtered' },
  { key: 'bbc-politics', source: 'BBC News', url: 'https://feeds.bbci.co.uk/news/politics/rss.xml', kind: 'filtered' },
  { key: 'guardian-business', source: 'The Guardian', url: 'https://www.theguardian.com/business/rss', kind: 'filtered' },
  { key: 'guardian-world', source: 'The Guardian', url: 'https://www.theguardian.com/world/rss', kind: 'filtered' },
  { key: 'npr-economy', source: 'NPR', url: 'https://feeds.npr.org/1017/rss.xml', kind: 'filtered' },
];

const TRADE_RE =
  /\b(trade|tariffs?|exports?|imports?|exporters?|importers?|shipping|shipments?|freight|cargo|container ships?|supply chains?|ports?|customs|sanctions?|sanctioned|embargo(?:es)?|WTO|World Trade Organi[sz]ation|semiconductors?|chips? makers?|rare earths?|critical minerals?|foreign investment|trade deficit|trade surplus|blockade|strait of)\b/i;

const MARKETS_RE =
  /\b(stock markets?|share prices?|wall street|S&P 500|Nasdaq|Dow Jones|FTSE|Nikkei|Hang Seng|currency|currencies|exchange rates?|the dollar|US dollar|the euro|yuan|renminbi|the yen|the pound|sterling|peso|rupee|central banks?|interest rates?|rate cuts?|rate hikes?|bond yields?|treasury yields?|inflation|oil prices?|crude|OPEC|FOMC|Federal Open Market Committee|monetary policy|economic projections|Bank of (?:England|Japan|Canada)|IMF|International Monetary Fund|recession)\b/i;
const NOT_MARKETS_RE = /\b(mortgages?|housing|rents?)\b/i;

// Tested against the headline only: election words in a summary were verified to miscategorise unrelated stories (Houthi missiles, an EU diesel row).
const ELECTION_RE = /\b(elections?|snap election|voters|referendum|ballots?|polls open|general election|presidential race)\b/i;
// extractCountries covers formal/short names; UK/US shorthand common in
// headlines isn't in that list (case-sensitive so "us" the pronoun can't match).
const HEADLINE_COUNTRY_RE = /\b(U\.S\.|US|United States|UK|Britain|British|EU)\b/;

export interface TaggedNews {
  category: NewsCategory;
  countries: string[];
}

export function tagNews(feed: NewsFeed, title: string, summary: string | null): TaggedNews | null {
  const text = `${title} ${summary ?? ''}`;
  const countries = extractCountries(text);

  // An election only matters here when a country is actually named -- an
  // election headline about a place we can't identify is just general news.
  if (ELECTION_RE.test(title) && (countries.length > 0 || HEADLINE_COUNTRY_RE.test(title))) {
    return { category: 'Elections & Politics', countries };
  }
  if (feed.kind === 'official') return { category: 'Official', countries };
  if (MARKETS_RE.test(text) && !NOT_MARKETS_RE.test(title)) return { category: 'Markets & Currency', countries };
  if (TRADE_RE.test(text)) return { category: 'Trade & Supply Chain', countries };
  return null;
}
