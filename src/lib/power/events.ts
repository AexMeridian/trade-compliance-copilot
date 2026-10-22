// Dated events shown beside the trend charts. Each is a plain fact with an official source; the page presents them "alongside", never as the
// cause of a change in opinion. Only events whose date and wording were confirmed on the page named in `url` are listed.
export interface PowerEvent {
  date: string;
  label: string;
  sourceName: string;
  url: string;
}

export const POWER_EVENTS: PowerEvent[] = [
  {
    date: '2020-03-11',
    label: 'The World Health Organization characterizes COVID-19 as a pandemic.',
    sourceName: 'World Health Organization',
    url: 'https://www.who.int/news-room/speeches/item/who-director-general-s-opening-remarks-at-the-media-briefing-on-covid-19---11-march-2020',
  },
  {
    date: '2022-02-24',
    label: 'Russian military operations begin inside Ukraine; the UN Secretary-General issues a statement.',
    sourceName: 'United Nations, Secretary-General noon briefing',
    url: 'https://www.un.org/sg/en/node/262061',
  },
  {
    date: '2025-01-20',
    label: 'Executive Order 14169, "Reevaluating and Realigning United States Foreign Aid," is signed; it calls for a 90-day pause in new obligations pending review.',
    sourceName: 'Federal Register',
    url: 'https://www.federalregister.gov/documents/2025/01/30/2025-02091/reevaluating-and-realigning-united-states-foreign-aid',
  },
  {
    date: '2025-04-02',
    label: 'Executive Order 14257, "Regulating Imports With a Reciprocal Tariff," is signed.',
    sourceName: 'Federal Register',
    url: 'https://www.federalregister.gov/documents/2025/04/07/2025-06063/regulating-imports-with-a-reciprocal-tariff-to-rectify-trade-practices-that-contribute-to-large-and',
  },
];
