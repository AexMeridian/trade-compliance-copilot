import type { DeMinimisContent } from './types';

// Plain-English explainer for people who buy or sell small packages across borders, and for travelers bringing things home. Dates are the
// ones this site already states elsewhere, each with its official source. The traveler allowances come ONLY from CBP pages fetched on
// 22 November 2026; anything those pages did not state (which countries get which exemption amount, exact alcohol and tobacco
// quantities) is left out on purpose and the reader is sent to CBP.
const CBP = 'https://www.cbp.gov/travel/us-citizens/know-before-you-go';

export const DEMINIMIS_EN: DeMinimisContent = {
  breadcrumbBasics: 'Basics',
  breadcrumbPage: 'Small packages',
  h1: 'Small packages from abroad now pay duty',
  intro:
    'If you buy from sites that ship from other countries, or order supplies for a small business, you may have seen new charges on packages that used to arrive free. Here is what changed and what it means for you.',
  inShortTitle: 'In short',
  inShort: [
    'The old rule let packages worth $800 or less into the U.S. without duty. That rule is suspended for every country.',
    'Now a $30 order of beads or clothes can owe the same tariffs as a container of the same goods, plus a processing fee.',
    'Who collects it depends on how it ships: the carrier (UPS, FedEx, DHL) or the seller usually pays U.S. Customs and adds it to your bill, sometimes with a handling fee.',
    'How much depends on the product and where it was made. Goods from China face the highest extra duties.',
  ],
  timelineTitle: 'What changed, and when',
  timeline: [
    {
      date: 'Until 2025',
      text: 'A shipment worth $800 or less could enter the U.S. without duty or the formal entry paperwork ("de minimis", Section 321 of the Tariff Act).',
      href: 'https://www.cbp.gov/trade/trade-enforcement/tftea/section-321-programs',
      source: 'CBP',
    },
    {
      date: '2 May 2025',
      text: 'The exemption ended for goods from China and Hong Kong.',
      href: 'https://www.federalregister.gov/documents/search?conditions%5Bterm%5D=de+minimis+China+Hong+Kong',
      source: 'Federal Register',
    },
    {
      date: '29 August 2025',
      text: 'Executive Order 14324 suspended the exemption for low-value shipments from every country. Since then every package pays any duty owed, by mail or by courier.',
      href: 'https://www.federalregister.gov/documents/search?conditions%5Bterm%5D=14324',
      source: 'Federal Register',
    },
    {
      date: '1 July 2027',
      text: 'The law itself ends the exemption, so it will not come back when the suspension ends.',
      href: 'https://www.cbp.gov/trade/trade-enforcement/tftea/de-minimis',
      source: 'CBP',
    },
  ],
  sourcePrefix: 'Source:',
  noticesBefore: 'New Customs rules on postal shipments and how duty is collected keep coming out.',
  noticesLink: 'See every official notice about de minimis on this site',
  lookupTitle: 'Find what your product owes',
  lookupBefore: 'Every product has a code in the U.S. tariff schedule. Use the',
  lookupLink: 'free tariff lookup',
  lookupAfter:
    'to search by words (for example "glass beads") and the country it is made in. The result is an estimate of the duty rate; carriers may add their own brokerage or handling fee on top.',
  abroadTitle: 'Selling to buyers abroad?',
  abroadIntro: 'Other countries set their own rules for packages coming in, and your buyer usually pays them. Two common destinations:',
  canada: {
    label: 'Canada:',
    text: 'low-value courier and postal shipments have their own duty and sales-tax thresholds.',
    linkText: 'Canada Border Services Agency',
    href: 'https://www.cbsa-asfc.gc.ca/import/courier/menu-eng.html',
  },
  uk: {
    label: 'United Kingdom:',
    text: 'VAT on parcels worth £135 or less is charged at the time of sale (marketplaces such as Etsy usually collect it).',
    linkText: 'GOV.UK',
    href: 'https://www.gov.uk/goods-sent-from-abroad',
  },
  exportNote:
    'Sending from the U.S. you usually need a customs form describing the item and its value; for items over $2,500 per product code, an export filing (EEI) is also required.',
  exportLinkText: 'Census: export codes (Schedule B)',
  exportHref: 'https://www.census.gov/foreign-trade/schedules/b/',
  travelersTitle: 'Bringing things home from a trip',
  travelersIntro:
    'A different rule applies to what you carry in your luggage when you return to the U.S. These points come only from pages CBP publishes, and each shows its page. Anything those pages do not state is left out here: for the exact quantities, ask CBP.',
  travelersChecked: 'Checked on',
  travelersCheckedOn: '22 November 2026',
  travelers: [
    {
      text: "Your duty-free personal exemption is $200, $800 or $1,600, depending on the countries you visited and the length of stay. CBP's page does not say which countries get which amount.",
      href: `${CBP}/what-expect-when-you-return`,
      source: 'CBP: What to expect when you return',
    },
    {
      text: 'The exemption applies only if you return from a stay abroad of at least 48 hours (that limit does not apply to Mexico or the U.S. Virgin Islands) and have not used any part of it in the past 30 days.',
      href: `${CBP}/what-expect-when-you-return`,
      source: 'CBP: What to expect when you return',
    },
    {
      text: 'Declare everything you bring in from abroad, even if you bought it in a duty-free shop. If you do not declare something that should have been declared, you risk forfeiting it. If in doubt, declare it. Travelers complete CBP Declaration Form 6059B.',
      href: `${CBP}/us-travelers-top-ten-travel-tips`,
      source: 'CBP: Top ten travel tips',
    },
    {
      text: 'Only very limited amounts of alcoholic beverages and tobacco products may be included in your duty-free personal exemption. Gifts worth more than $5 that contain alcohol, tobacco products, or perfume containing alcohol may not be included at all.',
      href: `${CBP}/shopping-abroad-duty-free-gifts-household-items`,
      source: 'CBP: Shopping abroad, duty-free, gifts',
    },
    {
      text: 'Gifts you receive abroad, and items you buy to give as gifts, must be declared. Gifts you send home from abroad can be duty-free up to $100 per recipient per day ($200 when sent from Guam, American Samoa or the U.S. Virgin Islands); alcohol and tobacco may not be sent duty-free as gifts.',
      href: `${CBP}/shopping-abroad-duty-free-gifts-household-items`,
      source: 'CBP: Shopping abroad, duty-free, gifts',
    },
    {
      text: 'All agricultural items must be declared and are subject to inspection. Meats, fresh fruits and vegetables, plants, seeds and soil may be prohibited or restricted. Prohibited items you did not declare are confiscated, and you may face a civil penalty.',
      href: 'https://www.cbp.gov/travel/international-visitors/agricultural-items',
      source: 'CBP: Bringing food into the U.S.',
    },
  ],
  travelersMore: 'More from CBP: Know Before You Go',
  disclaimer: 'General information, not legal or tax advice. Rules change: check the linked official pages before you ship or travel.',
};
