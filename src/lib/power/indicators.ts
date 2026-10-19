// The country indicators behind the Power profile. Every entry is a real World Bank series (CC BY 4.0), checked live against
// the Indicators API; nothing is combined into a score. `caveat` is shown beside the number, because practitioners will
// ask what a figure does not tell them.
export type Dimension = 'political_values' | 'foreign_policy' | 'culture' | 'knowledge' | 'ties' | 'alignment' | 'hard_power';
export type Unit = 'usd' | 'usd_per_person' | 'pct' | 'count' | 'index' | 'distance' | 'per_1000';
/** Where a series comes from. 'derived' series are computed from stored ones when requested and have no row of their own. */
export type Provider = 'worldbank' | 'voeten' | 'uis' | 'unhcr' | 'nobel' | 'fts' | 'derived';

export interface IndicatorDef {
  id: string;
  provider: Provider;
  /** Upstream series code (World Bank or UIS code, or a short name for the other providers). */
  code: string;
  /** World Bank source id, only where the series lives outside the default database (Worldwide Governance Indicators = 3). */
  wbSource?: number;
  label: string;
  unit: Unit;
  dimension: Dimension;
  definition: string;
  caveat: string;
  /** Which direction reads as "more". Used for wording only; it is never turned into a good/bad judgement. */
  higherIs: string;
  /** Fewer countries than this in the upstream response means the feed changed shape; the refresh aborts for that series. */
  minCountries: number;
  /** Stored for computing other series but not shown on its own. */
  hidden?: boolean;
  /** For derived distance series: the country whose position is the reference. */
  reference?: string;
}

/** How the page is organized: Nye's three sources of soft power (culture, political values, foreign policy), then the
 * ties that follow from them, and hard-power context for contrast. Opinion and UN-voting behaviour get their own sections. */
export interface DimensionInfo {
  id: Dimension;
  label: string;
  blurb: string;
}
export const DIMENSIONS: DimensionInfo[] = [
  { id: 'political_values', label: 'Political values', blurb: 'How a country’s governance is perceived. Attraction rests on values that are lived up to at home.' },
  { id: 'foreign_policy', label: 'Foreign policy', blurb: 'What a country gives abroad. Legitimacy comes from policies others see as generous and fair.' },
  { id: 'culture', label: 'Culture', blurb: 'What draws people in: heritage, learning and the arts.' },
  { id: 'knowledge', label: 'Knowledge and technology', blurb: 'Research and innovation that other countries want to be near.' },
  { id: 'ties', label: 'Ties and exchange', blurb: 'The people, money and visits that connect a country to others. These are the footprints of attraction, not proof of it.' },
  { id: 'alignment', label: 'Voting at the United Nations', blurb: 'How closely a country’s votes in the General Assembly track the United States, China and Russia. A behavior, not an opinion.' },
  { id: 'hard_power', label: 'Hard-power context', blurb: 'Economic and military weight, shown for contrast with the rest.' },
];
export const DIMENSION_LABELS = Object.fromEntries(DIMENSIONS.map((d) => [d.id, d.label])) as Record<Dimension, string>;

const wgi = (id: string, code: string, label: string, definition: string): IndicatorDef => ({
  id,
  provider: 'worldbank',
  code,
  wbSource: 3,
  label,
  unit: 'index',
  dimension: 'political_values',
  definition,
  caveat: 'A perception-based estimate from surveys and expert assessments (about -2.5 to +2.5), with a margin of error. It measures how a country is seen, not how it behaves.',
  higherIs: 'a more favorable perception',
  minCountries: 150,
});

export const INDICATORS: IndicatorDef[] = [
  {
    id: 'oda_given_usd', provider: 'worldbank', code: 'DC.ODA.TOTL.CD', label: 'Aid given (net ODA)', unit: 'usd', dimension: 'foreign_policy',
    definition: 'Net official development assistance provided by members of the OECD Development Assistance Committee, current US dollars.',
    caveat: 'Counts only the 32 DAC donors. China, the Gulf states and other non-DAC providers are not in this series, so a missing value is not zero aid.',
    higherIs: 'more aid provided', minCountries: 25,
  },
  {
    id: 'oda_given_gni', provider: 'worldbank', code: 'DC.ODA.TOTL.GN.ZS', label: 'Aid given, share of income', unit: 'pct', dimension: 'foreign_policy',
    definition: 'Net official development assistance provided, as a percentage of the donor’s gross national income. The UN target is 0.7%.',
    caveat: 'Counts only the 32 DAC donors. Aid that is spent on in-donor refugee costs is included under DAC rules.',
    higherIs: 'a larger share of income given', minCountries: 25,
  },
  {
    id: 'oda_received_usd', provider: 'worldbank', code: 'DT.ODA.ODAT.CD', label: 'Aid received (net ODA)', unit: 'usd', dimension: 'ties',
    definition: 'Net official development assistance and official aid received, current US dollars.',
    caveat: 'Only countries that are aid recipients appear. A high-income country with no value is not a recipient, not a country with zero ties. A negative value means repayments of past aid exceeded new aid.',
    higherIs: 'more aid received', minCountries: 100,
  },
  {
    id: 'oda_received_pc', provider: 'worldbank', code: 'DT.ODA.ODAT.PC.ZS', label: 'Aid received per person', unit: 'usd_per_person', dimension: 'ties',
    definition: 'Net official development assistance received divided by population, current US dollars per person.',
    caveat: 'Small states receive large amounts per person for structural reasons. Compare with the total, not instead of it.',
    higherIs: 'more aid per resident', minCountries: 100,
  },
  {
    id: 'tourist_arrivals', provider: 'worldbank', code: 'ST.INT.ARVL', label: 'International tourist arrivals', unit: 'count', dimension: 'ties',
    definition: 'Overnight visitors arriving from abroad in a year.',
    caveat: 'Counts trips, not residents’ opinions of the country. Border-crossing rules differ, and some countries report with long delays.',
    higherIs: 'more arrivals', minCountries: 150,
  },
  {
    id: 'migrant_share', provider: 'worldbank', code: 'SM.POP.TOTL.ZS', label: 'Foreign-born residents', unit: 'pct', dimension: 'ties',
    definition: 'International migrant stock as a percentage of the population (UN DESA estimates, every five years).',
    caveat: 'Shows who has settled, not why. Refugee-hosting and labour-migration countries both score high.',
    higherIs: 'a larger foreign-born share', minCountries: 150,
  },
  {
    id: 'remittances_usd', provider: 'worldbank', code: 'BX.TRF.PWKR.CD.DT', label: 'Remittances received', unit: 'usd', dimension: 'ties',
    definition: 'Personal remittances received from abroad, current US dollars.',
    caveat: 'A tie to diaspora communities. It is money sent home, so it says little about attitudes to the countries they work in.',
    higherIs: 'more money received', minCountries: 120,
  },
  {
    id: 'science_articles', provider: 'worldbank', code: 'IP.JRN.ARTC.SC', label: 'Scientific articles', unit: 'count', dimension: 'knowledge',
    definition: 'Scientific and technical journal articles published, in the fields covered by the Web of Science.',
    caveat: 'Counts output, not quality or citations. Fractional counting of co-authored work is the source’s choice, not ours.',
    higherIs: 'more articles', minCountries: 150,
  },
  {
    id: 'rd_gdp', provider: 'worldbank', code: 'GB.XPD.RSDV.GD.ZS', label: 'Research spending', unit: 'pct', dimension: 'knowledge',
    definition: 'Research and development expenditure as a percentage of GDP.',
    caveat: 'Many countries report it only every few years, so the year shown differs from country to country.',
    higherIs: 'a larger share of GDP spent on research', minCountries: 80,
  },
  {
    id: 'hightech_exports', provider: 'worldbank', code: 'TX.VAL.TECH.MF.ZS', label: 'High-technology exports', unit: 'pct', dimension: 'knowledge',
    definition: 'High-technology exports as a percentage of manufactured exports.',
    caveat: 'Re-exports and assembly can raise it without domestic invention.',
    higherIs: 'a larger high-tech share of manufactured exports', minCountries: 100,
  },
  wgi('wgi_voice', 'GOV_WGI_VA.EST', 'Voice and accountability', 'How far citizens can take part in choosing their government, and the freedom of expression, association and media.'),
  wgi('wgi_effectiveness', 'GOV_WGI_GE.EST', 'Government effectiveness', 'The quality of public services, the civil service and policy delivery.'),
  wgi('wgi_rule_of_law', 'GOV_WGI_RL.EST', 'Rule of law', 'Confidence in contract enforcement, property rights, the police and the courts.'),
  wgi('wgi_corruption', 'GOV_WGI_CC.EST', 'Control of corruption', 'How far public power is used for private gain.'),
  wgi('wgi_stability', 'GOV_WGI_PV.EST', 'Political stability', 'The likelihood of political instability or politically motivated violence.'),
  wgi('wgi_regulation', 'GOV_WGI_RQ.EST', 'Regulatory quality', 'The ability of government to set and apply policies that support private-sector development.'),
  {
    id: 'military_usd', provider: 'worldbank', code: 'MS.MIL.XPND.CD', label: 'Military spending', unit: 'usd', dimension: 'hard_power',
    definition: 'Military expenditure in current US dollars (SIPRI definition, which includes personnel, operations and procurement).',
    caveat: 'Spending is not capability. Prices, exchange rates and what each state reports as military all differ.',
    higherIs: 'more spending', minCountries: 120,
  },
  {
    id: 'military_gdp', provider: 'worldbank', code: 'MS.MIL.XPND.GD.ZS', label: 'Military spending, share of GDP', unit: 'pct', dimension: 'hard_power',
    definition: 'Military expenditure as a percentage of GDP.',
    caveat: 'Shows the burden on the economy rather than the size of the force.',
    higherIs: 'a larger share of the economy', minCountries: 120,
  },
  {
    id: 'gdp_usd', provider: 'worldbank', code: 'NY.GDP.MKTP.CD', label: 'Economy size (GDP)', unit: 'usd', dimension: 'hard_power',
    definition: 'Gross domestic product at market exchange rates, current US dollars.',
    caveat: 'Market exchange rates move the ranking when currencies move. It is output, not wealth per person.',
    higherIs: 'a larger economy', minCountries: 180,
  },
  {
    id: 'population', provider: 'worldbank', code: 'SP.POP.TOTL', label: 'Population', unit: 'count', dimension: 'hard_power',
    definition: 'Total residents, mid-year estimate.',
    caveat: 'Size of a country, not its reach.',
    higherIs: 'more residents', minCountries: 180,
  },
  {
    id: 'trade_gdp', provider: 'worldbank', code: 'NE.TRD.GNFS.ZS', label: 'Trade openness', unit: 'pct', dimension: 'hard_power',
    definition: 'Exports plus imports of goods and services as a percentage of GDP.',
    caveat: 'Small economies score high for structural reasons, and re-exports inflate hubs.',
    higherIs: 'trade is larger relative to the economy', minCountries: 130,
  },
  {
    id: 'un_ideal_point', provider: 'voeten', code: 'IdealPointFP', label: 'Position in UN General Assembly votes', unit: 'index', dimension: 'alignment',
    definition: 'A country’s estimated position on the main dividing line in General Assembly roll-call votes. Higher values sit closer to the United States and other Western democracies, lower values closer to the developing-world majority.',
    caveat: 'Estimated from how a country votes on resolutions that reach a recorded vote, not from what its leaders say or do elsewhere. It is one dimension, so it cannot show how a country votes on any single issue.',
    higherIs: 'a voting record closer to the Western position', minCountries: 150, hidden: true,
  },
  { id: 'un_dist_us', provider: 'derived', code: 'un_ideal_point', label: 'Distance from the United States at the UN', unit: 'distance', dimension: 'alignment',
    definition: 'The gap between a country’s General Assembly position and the United States’ position in the same year. Smaller means votes more like the United States.',
    caveat: 'Voting alike is not the same as being influenced. Countries can vote alike for shared interests, and the gap says nothing about aid, pressure or trade.',
    higherIs: 'a voting record further from the United States', minCountries: 100, reference: 'US' },
  { id: 'un_dist_cn', provider: 'derived', code: 'un_ideal_point', label: 'Distance from China at the UN', unit: 'distance', dimension: 'alignment',
    definition: 'The gap between a country’s General Assembly position and China’s position in the same year. Smaller means votes more like China.',
    caveat: 'Voting alike is not the same as being influenced. China and many developing countries sit on the same side of the main dividing line for different reasons.',
    higherIs: 'a voting record further from China', minCountries: 100, reference: 'CN' },
  { id: 'un_dist_ru', provider: 'derived', code: 'un_ideal_point', label: 'Distance from Russia at the UN', unit: 'distance', dimension: 'alignment',
    definition: 'The gap between a country’s General Assembly position and Russia’s position in the same year. Smaller means votes more like Russia.',
    caveat: 'Voting alike is not the same as being influenced. A single dimension cannot separate agreement with Russia from agreement with other large non-Western states.',
    higherIs: 'a voting record further from Russia', minCountries: 100, reference: 'RU' },
  {
    id: 'students_inbound', provider: 'uis', code: '26637', label: 'International students hosted', unit: 'count', dimension: 'culture',
    definition: 'Students from abroad enrolled in tertiary education in the country, UNESCO Institute for Statistics.',
    caveat: 'Countries define a mobile student differently, and some report with a delay or not at all. It counts who studies there, not what they think of it.',
    higherIs: 'more foreign students', minCountries: 80,
  },
  {
    id: 'students_net_ratio', provider: 'uis', code: 'MENFR.5T8', label: 'Net flow of students', unit: 'pct', dimension: 'culture',
    definition: 'Students arriving minus students leaving to study abroad, as a percentage of the country’s own tertiary enrollment (UNESCO Institute for Statistics net flow ratio).',
    caveat: 'A positive value means the country draws in more students than it sends out. It does not show which countries the students come from.',
    higherIs: 'more students arriving than leaving', minCountries: 80,
  },
  {
    id: 'refugees_hosted', provider: 'unhcr', code: 'refugees', label: 'Refugees hosted', unit: 'count', dimension: 'foreign_policy',
    definition: 'Refugees living in the country at the end of the year, as counted by UNHCR and national authorities.',
    caveat: 'Mostly a function of geography: countries next to conflicts host the most. It reflects burden as much as policy, and some countries count people differently.',
    higherIs: 'more refugees hosted', minCountries: 100,
  },
  {
    id: 'refugees_per_1000', provider: 'derived', code: 'refugees_hosted', label: 'Refugees hosted, per 1,000 residents', unit: 'per_1000', dimension: 'foreign_policy',
    definition: 'Refugees hosted divided by the country’s population, per 1,000 residents.',
    caveat: 'Small countries next to a crisis score highest. Population is the World Bank’s figure for the same year.',
    higherIs: 'more refugees relative to the population', minCountries: 100,
  },
  {
    id: 'humanitarian_given', provider: 'fts', code: 'fts_donors', label: 'Humanitarian funding given', unit: 'usd', dimension: 'foreign_policy',
    definition: 'Funding that a government reported to the UN’s Financial Tracking Service for humanitarian response in a calendar year, current US dollars.',
    caveat: 'Counts only what is reported to this one service, so a donor that gives through other channels, or reports late, looks smaller. Contributions to UN agencies are included when reported; the year is complete only once reporting closes.',
    higherIs: 'more reported humanitarian funding', minCountries: 15,
  },
  {
    id: 'humanitarian_per_person', provider: 'derived', code: 'humanitarian_given', label: 'Humanitarian funding given, per resident', unit: 'usd_per_person', dimension: 'foreign_policy',
    definition: 'Reported humanitarian funding divided by the donor’s own population, current US dollars per resident.',
    caveat: 'Shows generosity relative to size, not to income. Small, wealthy donors rank high. Population is the World Bank’s figure for the same year.',
    higherIs: 'more funding per resident', minCountries: 15,
  },
  {
    id: 'nobel_born', provider: 'nobel', code: 'born', label: 'Nobel laureates born in the country', unit: 'count', dimension: 'knowledge',
    definition: 'Nobel Prize laureates (all categories, 1901 to the latest award) by the present-day country of their birthplace.',
    caveat: 'A long-run count of past achievement, not a measure of today. Birthplace is not where the work was done, and organizations that won are not included.',
    higherIs: 'more laureates born there', minCountries: 30,
  },
  {
    id: 'nobel_affiliated', provider: 'nobel', code: 'affiliated', label: 'Nobel prizes won at institutions in the country', unit: 'count', dimension: 'knowledge',
    definition: 'Nobel prizes by the present-day country of the institution a laureate was affiliated with at the time of the award.',
    caveat: 'Only prizes with a listed institution are counted, which leaves out most Peace and Literature prizes. A prize shared by people at different institutions counts for each.',
    higherIs: 'more prizes won at its institutions', minCountries: 15,
  },
];

/** Who to credit for a series, shown beside every figure and in the section footers. Derived series credit their inputs. */
export function sourceFor(def: IndicatorDef): { name: string; url: string } {
  switch (def.provider) {
    case 'worldbank':
      return def.wbSource === 3
        ? { name: 'World Bank, Worldwide Governance Indicators', url: 'https://www.worldbank.org/en/publication/worldwide-governance-indicators' }
        : { name: 'World Bank, World Development Indicators', url: 'https://data.worldbank.org/' };
    case 'voeten':
      return { name: 'Bailey, Strezhnev and Voeten, UN General Assembly ideal points', url: 'https://doi.org/10.7910/DVN/LEJUQZ' };
    case 'uis':
      return { name: 'UNESCO Institute for Statistics', url: 'https://databrowser.uis.unesco.org/' };
    case 'unhcr':
      return { name: 'UNHCR Refugee Population Statistics Database', url: 'https://www.unhcr.org/refugee-statistics' };
    case 'nobel':
      return { name: 'The Nobel Prize', url: 'https://www.nobelprize.org/' };
    case 'fts':
      return { name: 'OCHA Financial Tracking Service', url: 'https://fts.unocha.org/' };
    case 'derived':
      if (def.id === 'humanitarian_per_person') return { name: 'OCHA Financial Tracking Service and World Bank population', url: 'https://fts.unocha.org/' };
      if (def.id === 'refugees_per_1000') return { name: 'UNHCR Refugee Population Statistics Database and World Bank population', url: 'https://www.unhcr.org/refugee-statistics' };
      return { name: 'Bailey, Strezhnev and Voeten, UN General Assembly ideal points (gaps calculated by Aex Terminal)', url: 'https://doi.org/10.7910/DVN/LEJUQZ' };
  }
}

export const INDICATOR_IDS = INDICATORS.map((i) => i.id);
export const INDICATOR_BY_ID = new Map(INDICATORS.map((i) => [i.id, i]));
