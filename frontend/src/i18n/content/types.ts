// Shapes of the translated page text. Numbers, legal terms (Section 232, HTS, USMCA...), dates and every link stay identical across
// languages: tests/i18n.test.ts compares them. A new language must satisfy these types.
export interface LinkRef {
  href: string;
  source: string;
}

export interface BasicsContent {
  breadcrumbWire: string;
  breadcrumbBasics: string;
  h1: string;
  intro: string;
  cards: { to: string; title: string; text: string }[];
}

export interface DeMinimisContent {
  breadcrumbBasics: string;
  breadcrumbPage: string;
  h1: string;
  intro: string;
  inShortTitle: string;
  inShort: string[];
  timelineTitle: string;
  timeline: { date: string; text: string; href: string; source: string }[];
  sourcePrefix: string;
  noticesBefore: string;
  noticesLink: string;
  lookupTitle: string;
  lookupBefore: string;
  lookupLink: string;
  lookupAfter: string;
  abroadTitle: string;
  abroadIntro: string;
  canada: { label: string; text: string; linkText: string; href: string };
  uk: { label: string; text: string; linkText: string; href: string };
  exportNote: string;
  exportLinkText: string;
  exportHref: string;
  travelersTitle: string;
  travelersIntro: string;
  travelersChecked: string;
  travelersCheckedOn: string;
  travelers: { text: string; href: string; source: string }[];
  travelersMore: string;
  disclaimer: string;
}

export interface GlossaryContent {
  breadcrumbBasics: string;
  breadcrumbPage: string;
  h1: string;
  intro: string;
  filterPlaceholder: string;
  filterLabel: string;
  noMatch: string;
  terms: { id: string; term: string; def: string; link?: { to: string; label: string } }[];
}
