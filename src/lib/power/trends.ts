// Published trend readings that answer "is a country's soft power rising or falling". Each reading is ONE publisher's own measure, entered
// by hand from the page or report named in `url`, exactly as the publisher states it, and shown on its own: readings from different
// pollsters are never averaged or merged, because they ask different people different questions. A year a publisher did not state in
// text (only in a chart image) is left out, so some series have gaps; a gap is not a zero.
//
// Gallup, the Democracy Perception Index, ISEAS and Brand Finance retain their copyright. Only the headline figures they publish are
// held here, credited and linked, and each reading can be removed by deleting its entry (the page hides it). Brand Finance's terms say
// its data may not be used "in part or in full for any commercial or technical purpose without written permission", so its reading is
// switched off (`enabled: false`) until permission is received; see docs/OPERATIONS.md.

export type SubjectId = 'US' | 'CN' | 'RU' | 'DE' | 'CA' | 'GB';

export interface TrendLine {
  subject: SubjectId;
  label: string;
  /** [year, value]. A period such as 2007 to 2009 is placed at its middle year and said so in `periodNote`. */
  points: [number, number][];
}

export interface TrendReading {
  id: string;
  /** Whether the page shows it. Off until the publisher's permission is received. */
  enabled: boolean;
  title: string;
  /** The question or measure in plain words. */
  measure: string;
  unit: 'percent' | 'net' | 'score';
  /** Who was asked: the general public of each country, or an expert and elite sample. */
  population: 'public' | 'experts';
  publisher: string;
  /** The page or report the figures were read from. */
  url: string;
  release: string;
  coverage: string;
  caveat: string;
  periodNote?: string;
  periodLabels?: Record<string, string>;
  lines: TrendLine[];
  /** One sentence of what changed, written from the numbers above and nothing else. */
  headline: string;
}

export const TREND_READINGS: TrendReading[] = [
  {
    id: 'gallup-leadership',
    enabled: true,
    title: 'Approval of the leadership of the U.S., China, Germany and Russia',
    measure: 'Median share of adults who approve of the job performance of each country’s leadership.',
    unit: 'percent',
    population: 'public',
    publisher: 'Gallup, World Poll (Rating World Leaders)',
    url: 'https://news.gallup.com/poll/707945/china-edges-past-global-approval-ratings.aspx',
    release: 'China Edges Past U.S. in Global Approval Ratings, April 3, 2026',
    coverage: 'Median across 130 or more countries and areas a year (the earlier articles give 134 or 135). Years Gallup did not state in text are left out.',
    caveat: 'Approval of "leadership" is a judgment about a country’s government, not about its people or culture. Gallup’s 2025 U.S. disapproval (48%) is the highest it has recorded.',
    lines: [
      { subject: 'US', label: 'United States', points: [[2009, 49], [2016, 48], [2017, 30], [2020, 30], [2022, 41], [2023, 41], [2024, 39], [2025, 31]] },
      { subject: 'CN', label: 'China', points: [[2017, 31], [2024, 32], [2025, 36]] },
      { subject: 'DE', label: 'Germany', points: [[2017, 41], [2022, 46], [2023, 46], [2025, 48]] },
      { subject: 'RU', label: 'Russia', points: [[2014, 22], [2017, 27], [2025, 26]] },
    ],
    headline: 'In 2025 the median approval of U.S. leadership was 31%, down from 39% in 2024, and China’s was 36%, so China edged ahead. Germany’s was the highest of the four at 48%.',
  },
  {
    id: 'gallup-migration',
    enabled: true,
    title: 'Where people who want to emigrate would go',
    measure: 'Share of adults who would like to move permanently to another country who name each country as their desired destination.',
    unit: 'percent',
    population: 'public',
    publisher: 'Gallup, World Poll',
    url: 'https://news.gallup.com/poll/708614/desire-migrate-drops-new-low.aspx',
    release: 'Desire to Move Permanently to U.S. at New Low, April 23, 2026',
    coverage: 'About 144,000 adults in 139 or 140 countries and areas in 2025; 2007 to 2009 results pooled.',
    caveat: 'Wanting to move is not moving. The article states only these two periods in text; the years between are in charts Gallup does not publish as numbers. The U.S. is still the most-named destination.',
    periodNote: '2007 to 2009 is plotted at 2008.',
    periodLabels: { '2008': '2007 to 2009' },
    lines: [
      { subject: 'US', label: 'United States', points: [[2008, 24], [2025, 15]] },
      { subject: 'CA', label: 'Canada', points: [[2008, 7], [2025, 9]] },
      { subject: 'GB', label: 'United Kingdom', points: [[2008, 7], [2025, 4]] },
    ],
    headline: 'The share of would-be migrants naming the U.S. fell from 24% (2007 to 2009) to 15% in 2025, the lowest Gallup has recorded. Canada rose from 7% to 9%.',
  },
  {
    id: 'dpi',
    enabled: true,
    title: 'Net perception of the U.S., China and Russia',
    measure: 'Positive minus negative views of each country, in points, across about 100 countries.',
    unit: 'net',
    population: 'public',
    publisher: 'Democracy Perception Index (Nira Data and the Alliance of Democracies)',
    url: 'https://allianceofdemocracies.org/global-democracy-poll-shows-us-perception-plummets-around-the-world',
    release: 'Global democracy poll shows US perception plummets around the world, May 12, 2025',
    coverage: '111,273 online respondents in 100 countries, April 2025; average margin of error 4.6 points per country.',
    caveat: 'Online panels reach people with internet access, so results lean toward the connected. Only the figures the release states for each country are shown; the 2026 edition was announced but its figures were not available to read.',
    lines: [
      { subject: 'US', label: 'United States', points: [[2024, 22], [2025, -5]] },
      { subject: 'CN', label: 'China', points: [[2025, 14]] },
      { subject: 'RU', label: 'Russia', points: [[2025, -9]] },
    ],
    headline: 'The U.S. net perception fell from +22 in 2024 to -5 in 2025, below China (+14) and close to Russia (-9). The share of countries with a positive view of the U.S. fell from 76% to 45%.',
  },
  {
    id: 'iseas-align',
    enabled: true,
    title: 'If Southeast Asia had to choose: the U.S. or China',
    measure: 'Share of respondents who say ASEAN should align with each power if forced to choose one.',
    unit: 'percent',
    population: 'experts',
    publisher: 'ISEAS–Yusof Ishak Institute, The State of Southeast Asia survey',
    url: 'https://www.iseas.edu.sg/frontpage-featured/the-state-of-southeast-asia-2026-survey-report/',
    release: 'The State of Southeast Asia: 2026 Survey Report, published April 7, 2026 (2025 report, April 3, 2025)',
    coverage: '2,008 respondents in 2026 (fieldwork January 5 to February 20, 2026) from the ten ASEAN states and Timor-Leste: academics, officials, business, civil society and media.',
    caveat: 'An elite sample, not the general public, and a forced choice that hides the many who want neither. It flipped from China (2024) to the U.S. (2025) and back (2026), so a one-point move is not a trend.',
    lines: [
      { subject: 'US', label: 'United States', points: [[2024, 49.5], [2025, 52.3], [2026, 48.0]] },
      { subject: 'CN', label: 'China', points: [[2024, 50.5], [2025, 47.7], [2026, 52.0]] },
    ],
    headline: 'Southeast Asia’s opinion leaders chose China over the U.S. 52.0% to 48.0% in 2026, reversing 2025 (U.S. 52.3%) and matching 2024 (China 50.5%).',
  },
  {
    id: 'iseas-trust',
    enabled: true,
    title: 'Confidence that the U.S. and China will "do the right thing"',
    measure: 'Share of respondents confident or very confident that each power will do the right thing for global peace, security, prosperity and governance.',
    unit: 'percent',
    population: 'experts',
    publisher: 'ISEAS–Yusof Ishak Institute, The State of Southeast Asia survey',
    url: 'https://www.iseas.edu.sg/frontpage-featured/the-state-of-southeast-asia-2026-survey-report/',
    release: 'The State of Southeast Asia: 2026 Survey Report (Q37 and Q41), published April 7, 2026',
    coverage: 'ASEAN-wide, "confident" plus "very confident"; the sum of two published shares for each year.',
    caveat: 'Same elite sample as above. The report states that for the first time since 2019 trust in China narrowly exceeds distrust, and that 51.9% name U.S. leadership under President Trump as their top geopolitical concern.',
    lines: [
      { subject: 'US', label: 'United States', points: [[2025, 47.2], [2026, 44.0]] },
      { subject: 'CN', label: 'China', points: [[2025, 36.6], [2026, 39.8]] },
    ],
    headline: 'Confidence in the U.S. fell from 47.2% to 44.0% between 2025 and 2026 while confidence in China rose from 36.6% to 39.8%; the U.S. still leads by four points.',
  },
  {
    id: 'brand-finance',
    // Off until Brand Finance gives written permission (its terms bar use of the data without it). See docs/OPERATIONS.md.
    enabled: false,
    title: 'Global Soft Power Index score',
    measure: 'Brand Finance’s own composite score out of 100 for each nation brand, from a survey of 150,000 to 170,000 people in 100 or more countries.',
    unit: 'score',
    population: 'public',
    publisher: 'Brand Finance, Global Soft Power Index',
    url: 'https://brandfinance.com/press-releases/us-sees-steepest-decline-out-of-all-193-nation-brands-in-global-soft-power-index-2026',
    release: 'Global Soft Power Index 2026, January 20, 2026 (2025 edition, February 20, 2025)',
    coverage: 'All 193 UN member states ranked on 55 metrics.',
    caveat: 'A composite built from Brand Finance’s own weights, which this site does not control. Shown only as Brand Finance’s reading.',
    lines: [
      { subject: 'US', label: 'United States', points: [[2025, 79.5], [2026, 74.9]] },
      { subject: 'CN', label: 'China', points: [[2025, 72.8], [2026, 73.5]] },
    ],
    headline: 'Brand Finance scores the U.S. at 74.9 in 2026, down 4.6 points and the steepest fall of any country, and China at 73.5, less than 1.5 points behind.',
  },
];
