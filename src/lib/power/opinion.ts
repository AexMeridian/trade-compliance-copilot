// Published public-opinion readings: the share of adults in each polled country with a favorable view of the United States
// or of China, from Pew Research Center's Global Attitudes Survey. These are NOT scraped or estimated: each figure was read
// from the chart in the report named on its entry (see `url`) and checked against the report's own published median
// (tests/opinion.test.ts recomputes every median). Only the favorable share is kept -- not the unfavorable or
// "don't know" shares -- and only for the countries Pew polled that year, so a country missing here was simply not asked.
//
// Pew's terms (pewresearch.org/about/terms-and-conditions) allow excerpts of survey data with attribution and the
// statement that Pew bears no responsibility for the analysis or interpretation. This file is the whole of what the site
// holds from Pew: it does not republish datasets. Before launch the operator should still ask Pew for written permission
// (see docs/OPERATIONS.md); removing a survey here removes it from the site everywhere.
export interface OpinionSurvey {
  id: string;
  pollster: 'Pew Research Center';
  /** Whose image was rated: the United States or China. */
  subject: 'US' | 'CN';
  year: number;
  /** Report title, exactly as Pew titles it. */
  title: string;
  release: string;
  fieldwork: string;
  /** Pew's own page for the report. */
  url: string;
  /** The median Pew published for the report, and how many countries it covers. */
  publishedMedian: number;
  countriesInMedian: number;
  /** Alpha-2 country code -> percent with a favorable view. */
  favorable: Record<string, number>;
}

export const QUESTION = 'Please tell me if you have a very favorable, somewhat favorable, somewhat unfavorable, or very unfavorable opinion of the United States / China. (Pew Q3; the share answering very or somewhat favorable.)';
export const PEW_DISCLAIMER = 'Pew Research Center bears no responsibility for the analyses or interpretations of the data presented here.';

export const OPINION_SURVEYS: OpinionSurvey[] = [
  {
    id: 'pew-2025-us',
    pollster: 'Pew Research Center',
    subject: 'US',
    year: 2025,
    title: "U.S. Image Declines in Many Nations Amid Low Confidence in Trump",
    release: '2025-06-11',
    fieldwork: 'Jan. 8 to Apr. 26, 2025',
    url: 'https://www.pewresearch.org/global/2025/06/11/us-image-declines-in-many-nations-amid-low-confidence-in-trump/',
    publishedMedian: 49,
    countriesInMedian: 24,
    favorable: { AR: 52, AU: 29, BR: 56, CA: 34, DE: 33, ES: 31, FR: 36, GB: 50, GR: 45, HU: 60, ID: 48, IL: 83, IN: 54, IT: 47, JP: 55, KE: 62, KR: 61, MX: 29, NG: 78, NL: 29, PL: 55, SE: 19, TR: 25, ZA: 50 },
  },
  {
    id: 'pew-2025-cn',
    pollster: 'Pew Research Center',
    subject: 'CN',
    year: 2025,
    title: "International Views of China Turn Slightly More Positive",
    release: '2025-07-15',
    fieldwork: 'Jan. 8 to Apr. 26, 2025',
    url: 'https://www.pewresearch.org/global/2025/07/15/views-of-china-and-xi-jinping-2025/',
    publishedMedian: 36,
    countriesInMedian: 25,
    favorable: { AR: 47, AU: 23, BR: 51, CA: 34, DE: 29, ES: 37, FR: 36, GB: 39, GR: 56, HU: 51, ID: 65, IL: 33, IN: 21, IT: 45, JP: 13, KE: 74, KR: 19, MX: 56, NG: 81, NL: 30, PL: 35, SE: 18, TR: 35, US: 21, ZA: 57 },
  },
  {
    id: 'pew-2026-us',
    pollster: 'Pew Research Center',
    subject: 'US',
    year: 2026,
    title: "Trump Gets Negative Reviews Internationally as Fewer Say U.S. Is a Reliable Partner",
    release: '2026-06-23',
    fieldwork: 'Feb. 8 to May 13, 2026',
    url: 'https://www.pewresearch.org/global/2026/06/23/trump-gets-negative-reviews-internationally-as-fewer-say-u-s-is-a-reliable-partner/',
    publishedMedian: 37,
    countriesInMedian: 36,
    favorable: { AR: 44, AU: 24, BD: 26, BR: 47, CA: 33, CL: 37, CO: 60, DE: 27, ES: 30, FR: 27, GB: 41, GH: 68, GR: 37, HU: 58, ID: 29, IL: 81, IN: 45, IT: 31, JP: 50, KE: 63, KR: 45, LK: 42, MX: 40, MY: 19, NG: 63, NL: 25, PE: 51, PH: 56, PK: 15, PL: 49, PS: 9, SE: 19, SG: 34, TH: 36, TR: 13, ZA: 35 },
  },
  {
    id: 'pew-2026-cn',
    pollster: 'Pew Research Center',
    subject: 'CN',
    year: 2026,
    title: "Views of China and Xi Are Improving Globally",
    release: '2026-07-15',
    fieldwork: 'Feb. 8 to May 13, 2026',
    url: 'https://www.pewresearch.org/global/2026/07/15/views-of-china-and-xi-are-improving-globally/',
    publishedMedian: 51,
    countriesInMedian: 37,
    favorable: { AR: 50, AU: 31, BD: 56, BR: 46, CA: 44, CL: 49, CO: 63, DE: 33, ES: 54, FR: 36, GB: 46, GH: 64, GR: 55, HU: 53, ID: 72, IL: 19, IN: 23, IT: 51, JP: 11, KE: 76, KR: 28, LK: 72, MX: 59, MY: 75, NG: 78, NL: 34, PE: 61, PH: 40, PK: 90, PL: 39, PS: 57, SE: 27, SG: 73, TH: 69, TR: 43, US: 27, ZA: 52 },
  },
];

export function citationFor(s: OpinionSurvey): string {
  return `“${s.title}.” Pew Research Center, Washington, D.C. (${s.release}) ${s.url}`;
}

// Afrobarometer Round 10 (see afrobarometer.generated.ts, built offline by scripts/opinion/afrobarometer.py). Afrobarometer
// makes its survey data free to use with attribution; the site keeps only the country shares and fieldwork dates.
export const AFRO_SOURCE = {
  name: 'Afrobarometer, Round 10 (2024-2025)',
  url: 'https://www.afrobarometer.org/data/merged-data/',
  question:
    "Overall, does the influence of China / the United States on [our country] have a positive or a negative effect, or no effect? (Q67b, Q67c; the share answering somewhat or very positive, or somewhat or very negative, among everyone who gave an answer, don't know included.)",
  citation: 'Afrobarometer. Round 10 merged data set, 38 countries, 2024-2025. Accra: Afrobarometer. https://www.afrobarometer.org/data/merged-data/',
};
