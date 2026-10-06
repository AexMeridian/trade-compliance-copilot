// One cross-domain topic vocabulary, so a Federal Register action, a news
// headline and a Global Trade Alert measure can be recognised as being about
// the same thing. Deterministic keyword rules -- no LLM, same house rule as
// tag.ts / newsTag.ts. Multi-label: a story about sanctions on Russian oil
// legitimately belongs to both Sanctions and Energy.
//
// Computed at read time from the item's own text (never stored), so editing a
// rule here immediately re-classifies history without a migration or backfill.
export const TOPICS = [
  'Tariffs',
  'Sanctions',
  'Export controls',
  'Energy',
  'Metals & minerals',
  'Technology',
  'Agriculture',
  'Currency & finance',
  'Security & defense',
  'Elections & politics',
  'Diplomacy & alliances',
  'Supply chain & shipping',
] as const;

export type Topic = (typeof TOPICS)[number];

const RULES: Record<Topic, RegExp> = {
  Tariffs: /\b(tariffs?|trade (?:wars?|disputes?|barriers?|measures|rows?|retaliation|remedies)|unfair trade|dumping|duty|duties|antidumping|anti-dumping|countervailing|safeguard|section 301|section 232|section 338|IEEPA|reciprocal|import (?:tax|levy|surcharge)|quota)\b/i,
  Sanctions: /\b(sanctions?|sanctioned|embargo(?:es)?|blacklist(?:ed)?|designat(?:ed|ion)s?|specially designated|SDN|asset freeze|frozen assets|OFAC)\b/i,
  'Export controls': /\b(export controls?|entity list|export restrictions?|commerce control list|\bEAR\b|ITAR|license requirements?|chip (?:curbs|restrictions|ban)|denied persons?)\b/i,
  Energy: /\b(oil|crude|OPEC|petroleum|natural gas|LNG|pipelines?|refiner(?:y|ies)|gasoline|diesel|energy|electricity|power grid|coal|nuclear)\b/i,
  'Metals & minerals': /\b(steel|aluminum|aluminium|copper|nickel|lithium|cobalt|rare earths?|critical minerals?|mining|iron ore|zinc|metals?|graphite|gallium|germanium)\b/i,
  Technology: /\b(semiconductors?|chips?|microchips?|AI|artificial intelligence|software|telecom|5G|electronics|batteries|EV|electric vehicles?|data centers?|cyber|TikTok|Huawei|drones?)\b/i,
  Agriculture: /\b(agricultur(?:e|al)|farm(?:ers|s)?|crops?|soybeans?|wheat|corn|grain|beef|pork|poultry|dairy|fertili[sz]er|seafood|shrimp|coffee|cocoa|sugar|rice|food prices?)\b/i,
  'Currency & finance': /\b(currency|currencies|exchange rates?|the dollar|US dollar|the euro|yuan|renminbi|yen|sterling|peso|rupee|central banks?|interest rates?|rate (?:cuts?|hikes?)|bond yields?|treasury yields?|inflation|monetary policy|IMF|World Bank|debt|default|capital controls?|reserve currency|de-?dollari[sz]ation|stock markets?|recession)\b/i,
  'Security & defense': /\b(military|defen[sc]e|NATO|war|invasion|troops?|missiles?|navy|naval|strait of|blockade|ceasefire|cease-fire|conflict|attack|nuclear weapons?|arms|weapons?|Houthis?|geopolitic\w*)\b/i,
  // Deliberately narrow: "president" / "minister" appear in nearly every political
  // story and would link unrelated ones.
  'Elections & politics': /\b(elections?|snap election|voters?|voting|ballots?|referendum|parliament(?:ary)?|coalition government|midterms?|presidential (?:race|election|campaign)|separatis\w+|independence (?:push|vote|referendum))\b/i,
  'Diplomacy & alliances': /\b(diplomat\w*|ambassadors?|summit|treat(?:y|ies)|peace (?:deal|talks?|plan)|negotiat\w+|bilateral|alliances?|NATO|G7|G20|BRICS|trade (?:deal|agreement|pact)|free trade agreement|state visit|foreign ministers?|envoys?|USMCA|WTO)\b/i,
  'Supply chain & shipping': /\b(supply chains?|shipping|shipments?|freight|cargo|container(?:s| ships?)?|ports?|logistics|rail|trucking|customs|Panama Canal|Suez|Red Sea|shortages?|reshoring|nearshoring)\b/i,
};

/**
 * Topics for a piece of text. `hints` lets a caller add topics it already knows
 * for certain (e.g. a Federal Register document whose own tag is "Sanctions").
 */
export function topicsFor(text: string, hints: Topic[] = []): Topic[] {
  const found = new Set<Topic>(hints);
  for (const topic of TOPICS) if (RULES[topic].test(text)) found.add(topic);
  return TOPICS.filter((t) => found.has(t));
}

/** The topic a Pulse action tag already establishes with certainty. */
export function topicHintForActionTag(tag: string): Topic[] {
  if (tag === 'Tariff') return ['Tariffs'];
  if (tag === 'Sanctions') return ['Sanctions'];
  if (tag === 'Export Control') return ['Export controls'];
  return [];
}
