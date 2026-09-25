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
