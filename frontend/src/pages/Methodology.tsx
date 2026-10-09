import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SITE } from '../lib/site';
import { getDataStats, getDataStatus, type DataStats, type DataStatus } from '../lib/api';

function H({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="display mt-10 scroll-mt-20 border-t-2 border-ink pt-4 text-2xl text-ink">
      {children}
    </h2>
  );
}

interface SourceRow {
  name: string;
  publisher: string;
  url: string;
  terms: string;
  cadence: string;
  keys: string[]; // data_refresh_log source names
  note?: string;
}

// Every external source the site reads, in one place. `keys` ties each row to the refresh log so the
// "last refreshed" column is live, not typed in.
const SOURCES: SourceRow[] = [
  {
    name: 'Federal Register notices',
    publisher: 'Office of the Federal Register (U.S. government)',
    url: 'https://www.federalregister.gov/developers/documentation/api/v1',
    terms: 'U.S. government work; not subject to copyright in the United States.',
    cadence: 'Daily, and when a page asks for updates',
    keys: ['pulse'],
  },
  {
    name: 'Harmonized Tariff Schedule of the United States',
    publisher: 'U.S. International Trade Commission',
    url: 'https://hts.usitc.gov/',
    terms: 'U.S. government work; not subject to copyright in the United States.',
    cadence: 'Checked weekly, reloaded only when the published file changed',
    keys: ['hts'],
  },
  {
    name: 'Schedule B export codes',
    publisher: 'U.S. Census Bureau',
    url: 'https://www.census.gov/foreign-trade/schedules/b/',
    terms: 'U.S. government work; not subject to copyright in the United States.',
    cadence: 'Checked weekly, reloaded only when the published file changed',
    keys: ['schedule_b'],
  },
  {
    name: 'Specially Designated Nationals (SDN) list',
    publisher: 'Office of Foreign Assets Control, U.S. Treasury',
    url: 'https://ofac.treasury.gov/sanctions-list-service',
    terms: 'U.S. government work; not subject to copyright in the United States.',
    cadence: 'Checked weekly (the official list can change more often)',
    keys: ['sdn'],
    note: 'For any real screening use the official OFAC Sanctions List Search.',
  },
  {
    name: 'Consolidated Screening List',
    publisher: 'U.S. Department of Commerce, International Trade Administration',
    url: 'https://www.trade.gov/consolidated-screening-list',
    terms: 'U.S. government work; not subject to copyright in the United States.',
    cadence: 'Checked weekly',
    keys: ['csl'],
  },
  {
    name: 'UN Security Council Consolidated List',
    publisher: 'United Nations Security Council',
    url: 'https://main.un.org/securitycouncil/en/content/un-sc-consolidated-list',
    terms: 'Published by the United Nations; see the UN website terms of use. Used here for information and screening.',
    cadence: 'Checked weekly',
    keys: ['un_sanctions'],
  },
  {
    name: 'UK Sanctions List',
    publisher: 'UK Foreign, Commonwealth and Development Office, with the Office of Financial Sanctions Implementation',
    url: 'https://www.gov.uk/government/publications/the-uk-sanctions-list',
    terms: 'Contains public sector information licensed under the Open Government Licence v3.0.',
    cadence: 'Checked weekly',
    keys: ['uk_sanctions'],
  },
  {
    name: 'Withhold Release Orders and Findings (forced labor)',
    publisher: 'U.S. Customs and Border Protection',
    url: 'https://www.cbp.gov/trade/forced-labor/withhold-release-orders-and-findings',
    terms: 'U.S. government work; not subject to copyright in the United States.',
    cadence: 'Checked weekly',
    keys: ['wro_findings'],
  },
  {
    name: 'Global Trade Alert interventions',
    publisher: 'Global Trade Alert (University of St. Gallen)',
    url: 'https://www.globaltradealert.org/',
    terms: 'See the Global Trade Alert terms of use; attribution required.',
    cadence: 'Checked weekly; the free API key is rate limited',
    keys: ['gta'],
    note: 'When this source is unavailable the page says so and shows nothing in its place.',
  },
  {
    name: "U.S. dollar's share of global reserves (COFER)",
    publisher: 'International Monetary Fund',
    url: 'https://data.imf.org/',
    terms: 'IMF data, used with attribution under the IMF terms of use.',
    cadence: 'Quarterly series, checked daily',
    keys: ['pulse_cofer'],
  },
  {
    name: 'NATO defence expenditure',
    publisher: 'North Atlantic Treaty Organization',
    url: 'https://www.nato.int/cps/en/natohq/topics_49198.htm',
    terms: 'NATO publication, attributed. Entered by hand once a year; shown with its publication date.',
    cadence: 'Annual, manual',
    keys: [],
  },
  {
    name: 'U.S. macroeconomic series (prices, jobs)',
    publisher: 'U.S. Bureau of Labor Statistics',
    url: 'https://www.bls.gov/developers/',
    terms: 'U.S. government work; not subject to copyright in the United States.',
    cadence: 'Daily check; monthly data',
    keys: ['pulse_macro'],
  },
  {
    name: 'Exchange rates (ECB euro foreign exchange reference rates)',
    publisher: 'European Central Bank, served by Frankfurter',
    url: 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html',
    terms: 'ECB reference rates, reused with attribution under the ECB reuse policy.',
    cadence: 'Once per ECB business day',
    keys: ['pulse_fx'],
  },
  {
    name: 'News headlines (headline, link and a short summary only)',
    publisher: 'BBC News, The Guardian, NPR, Al Jazeera, Deutsche Welle, CNBC, the European Central Bank and the U.S. Federal Reserve',
    url: 'https://www.bbc.co.uk/news/10628494',
    terms: 'Each headline links to its publisher. No article text or photographs are stored or shown. Publishers keep all rights.',
    cadence: 'About every 30 minutes while the site is in use',
    keys: ['pulse_news'],
  },
];

const when = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : 'not yet');

export function Methodology() {
  const [status, setStatus] = useState<DataStatus | null>(null);
  const [stats, setStats] = useState<DataStats | null>(null);

  useEffect(() => {
    let live = true;
    getDataStatus().then((s) => live && setStatus(s)).catch(() => undefined);
    getDataStats().then((s) => live && setStats(s)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const byKey = new Map((status?.sources ?? []).map((s) => [s.source, s]));
  const n = (key: string) => (stats?.counts[key] != null ? stats.counts[key]!.toLocaleString('en-US') : '…');
  const rowStatus = (keys: string[]) => {
    if (keys.length === 0) return { text: 'Entered by hand', warn: false };
    const rows = keys.map((k) => byKey.get(k)).filter(Boolean);
    if (!status) return { text: 'Loading…', warn: false };
    if (rows.length === 0) return { text: 'No successful refresh on record', warn: true };
    const last = rows.map((r) => r!.lastSuccess).filter(Boolean).sort().pop() ?? null;
    const failing = rows.find((r) => r!.lastError);
    if (failing) return { text: `${last ? `Last refreshed ${when(last)}. ` : ''}Latest attempt failed`, warn: true };
    return { text: `Last refreshed ${when(last)}`, warn: false };
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 text-sm leading-relaxed text-ink-muted">
      <h1 className="display text-4xl text-ink sm:text-5xl">Methodology and sources</h1>
      <p className="mt-3 text-base text-ink">
        What {SITE.name} shows, where every figure comes from, how it is calculated, and what it does not cover. Last updated {SITE.aboutUpdated}.
      </p>

      <nav aria-label="On this page" className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
        {[
          ['#scope', 'Scope and neutrality'],
          ['#measures', 'How the measures are calculated'],
          ['#sources', 'Sources and licences'],
          ['#coverage', 'Coverage and limits'],
          ['#automation', 'Automation and AI'],
          ['#testing', 'Testing'],
          ['#names', 'Names and boundaries'],
          ['#corrections', 'Corrections'],
        ].map(([href, label]) => (
          <a key={href} href={href} className="text-accent hover:underline">
            {label}
          </a>
        ))}
      </nav>

      <H id="scope">Scope and neutrality</H>
      <p className="mt-3">
        {SITE.name} reports what governments and international bodies have published about trade measures: tariffs, sanctions, export controls, trade
        agreements and related market data. It is informational and non-partisan. It does not recommend, rank or judge any policy or country, and a larger
        count never means that a country is an adversary or that a measure is justified. It is not legal, customs, tax, financial or investment advice, and
        it is not affiliated with, endorsed by or operated on behalf of any government or international organization. See the{' '}
        <Link to="/terms" className="text-accent">
          Terms of use
        </Link>
        .
      </p>

      <H id="measures">How the measures are calculated</H>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>
          <span className="text-ink">Notices.</span> An official U.S. government publication in the Federal Register about tariffs, sanctions, export
          controls or trade agreements. Counts cover the last 30 days by publication date. A notice can name several countries and then counts once for each.
          A count measures how much was published, not how significant it was.
        </li>
        <li>
          <span className="text-ink">Sanctioned parties.</span> People, companies and vessels on the OFAC SDN list, the Commerce/State Consolidated
          Screening List, the UN Security Council list and the UK Sanctions List, counted by the country named in each party's listed address (UN entries
          also use nationality). The sources carry no country codes, so this is a text match on country names; entries that name more than three countries are
          skipped as roundups, and the United States is excluded. One party can appear on several lists and is then counted once per list. It describes
          where listed parties are said to be located, not which country a measure is aimed at.
        </li>
        <li>
          <span className="text-ink">Extra tariffs.</span> The country-specific additional duty currently in force under the Section 301 forced-labor
          determination, plus separately noted Section 338 and Section 232 country rules, from hand-verified rows in our tariff table, each with its Federal
          Register citation and a data-as-of date. Antidumping and countervailing duties are not included.
        </li>
        <li>
          <span className="text-ink">Dollar's reserve share.</span> The IMF COFER series: the share of allocated foreign-exchange reserves held in U.S.
          dollars, quarterly, shown as published.
        </li>
        <li>
          <span className="text-ink">Defense spending.</span> NATO's published estimate of defence expenditure as a share of GDP for the countries it lists,
          for the latest year it covers.
        </li>
        <li>
          <span className="text-ink">Currencies.</span> Percentage change over 30 days in ECB reference exchange rates against the U.S. dollar.
        </li>
        <li>
          <span className="text-ink">Alliance membership.</span> Formal membership of NATO, G7, G20, BRICS and USMCA, each checked against the
          organization's own published list and dated on the page. Partner countries are shown separately and are not members.
        </li>
      </ul>

      <H id="sources">Sources and licences</H>
      <p className="mt-3">
        Every external source, with its publisher, terms and when we last refreshed it. A refresh that fails or finds nothing new never overwrites existing
        data with a partial result.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b-2 border-ink text-ink">
              <th className="py-2 pr-3 font-semibold">Source</th>
              <th className="py-2 pr-3 font-semibold">Terms</th>
              <th className="py-2 pr-3 font-semibold">How often</th>
              <th className="py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {SOURCES.map((s) => {
              const st = rowStatus(s.keys);
              return (
                <tr key={s.name} className="border-b border-hairline align-top">
                  <td className="py-2.5 pr-3">
                    <a href={s.url} target="_blank" rel="noreferrer" className="font-semibold text-ink hover:text-accent">
                      {s.name}
                    </a>
                    <span className="block text-ink-faint">{s.publisher}</span>
                    {s.note && <span className="block text-ink-faint">{s.note}</span>}
                  </td>
                  <td className="py-2.5 pr-3">{s.terms}</td>
                  <td className="py-2.5 pr-3">{s.cadence}</td>
                  <td className={`py-2.5 ${st.warn ? 'text-review' : ''}`}>{st.text}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3">
        Also hand-curated from primary sources and cited on the pages that use them: the USMCA rules of origin (General Note 11 of the HTSUS), the Commerce
        Control List classifications and the Commerce Country Chart (15 CFR Part 738 and Part 774), and the tariff overlay table (Federal Register notices).
      </p>

      <H id="coverage">Coverage and known limits</H>
      <p className="mt-3">What is actually loaded, counted live from the database:</p>
      <ul className="mt-3 grid list-none gap-x-8 gap-y-1 pl-0 sm:grid-cols-2">
        {[
          ['Tariff lines (HTS)', 'htsLines'],
          ['Schedule B export codes', 'scheduleBLines'],
          ['OFAC SDN entries', 'sdnEntries'],
          ['Consolidated Screening List entries', 'cslEntries'],
          ['UN sanctions entries', 'unEntries'],
          ['UK sanctions entries', 'ukEntries'],
          ['Forced-labor orders and findings', 'wroFindings'],
          ['Federal Register notices stored', 'policyNotices'],
          ['Tariff overlay rows (hand-verified)', 'tariffOverlays'],
          ['Export control classifications (ECCN) curated', 'eccnEntries'],
          ['USMCA origin rules curated', 'usmcaRules'],
          ['Commerce Country Chart rows curated', 'countryChartRows'],
        ].map(([label, key]) => (
          <li key={key} className="flex justify-between gap-3 border-b border-hairline py-1">
            <span>{label}</span>
            <span className="tabular-nums text-ink">{n(key)}</span>
          </li>
        ))}
      </ul>
      <ul className="mt-4 list-disc space-y-2 pl-5">
        <li>
          <span className="text-ink">The export-control and origin checks in the Compliance calculator cover only the curated rows above.</span> They are a
          small subset of the Commerce Control List, the Country Chart and the HTSUS chapters. For anything else the tool says it is not covered; it never
          guesses.
        </li>
        <li>
          <span className="text-ink">Sanctions lists are refreshed weekly,</span> and the official lists can change daily. Do not rely on this site for a
          screening decision; use the official OFAC Sanctions List Search and your own counsel. Matching is by name only, uses no dates of birth or other
          identifiers, and does not apply ownership rules such as OFAC's 50 percent rule.
        </li>
        <li>
          <span className="text-ink">Country attribution is by text.</span> Notices, headlines and sanctions entries are tied to countries by matching names
          in their text. It misses countries named only indirectly and can attach a country that is merely mentioned. Roundups naming many countries are
          excluded from cross-topic links.
        </li>
        <li>
          <span className="text-ink">News is a filtered, automated selection,</span> mostly English-language and drawn from eight outlets, so it reflects
          those outlets' choices. Topic labels are keyword rules and can be wrong.
        </li>
        <li>
          <span className="text-ink">Market data is delayed or daily.</span> Stock and commodity quotes are switched off while their source terms are
          reviewed. Nothing here is for trading.
        </li>
        <li>
          <span className="text-ink">Tariff rates beyond ad valorem rates</span> (specific or compound duties) and antidumping or countervailing duties are not
          calculated.
        </li>
        <li>
          <span className="text-ink">Global Trade Alert data</span> is limited by its free API tier and may be absent; the page says so when it is.
        </li>
      </ul>

      <H id="automation">Automation and AI</H>
      <p className="mt-3">
        The Pulse, U.S. abroad and Dollar & allies pages use no AI model. Labels, counts, rankings and links come from fixed, published rules applied to
        source data. The Compliance calculator (Beta) is different: an AI model (Anthropic's Claude) reads the product description, suggests a tariff
        classification and writes explanations, and every suggestion is grounded in rows of the official tariff schedule that the system supplies. All
        arithmetic (duty stacks, percentages) is computed by deterministic code, never by the model, and party-name screening uses a fixed two-stage
        algorithm (a word-order-independent pre-filter, then Jaro-Winkler similarity) whose scores are shown. AI output can be wrong and must be reviewed by
        a qualified person.
      </p>

      <H id="testing">Testing</H>
      <p className="mt-3">
        The deterministic code is covered by automated tests that run on every change: duty arithmetic, country and name matching, alliance data,
        cross-topic link rules, feeds and refresh scheduling. The calculator's classification step is checked against a small set of eleven reference
        products, which it passed on its most recent run; eleven cases show the tool works on those examples and do not establish a general accuracy rate. We do not claim
        one.
      </p>

      <H id="names">Names and boundaries</H>
      <p className="mt-3">
        Place names follow the current English short names used by the United Nations and the ISO 3166 standard (for example Türkiye, Czechia, Eswatini, North
        Macedonia). Names, borders and territories are shown for reference and identification only; they do not imply recognition of any status or claim.
        Where sources disagree, we follow the source being cited.
      </p>

      <H id="corrections">Corrections</H>
      <p className="mt-3">
        Errors are corrected promptly and the date noted on the page. Every item links to its official source, which prevails over anything shown here.
        {SITE.contactEmail ? (
          <>
            {' '}
            Report an error to{' '}
            <a href={`mailto:${SITE.contactEmail}?subject=${encodeURIComponent('Correction: Methodology page')}`} className="text-accent">
              {SITE.contactEmail}
            </a>
            , naming the page and the item.
          </>
        ) : null}
      </p>

      <p className="mt-8">
        See also:{' '}
        <Link to="/about" className="text-accent">
          About
        </Link>
        ,{' '}
        <Link to="/terms" className="text-accent">
          Terms of use
        </Link>
        ,{' '}
        <Link to="/privacy" className="text-accent">
          Privacy
        </Link>{' '}
        and{' '}
        <Link to="/accessibility" className="text-accent">
          Accessibility
        </Link>
        .
      </p>
    </main>
  );
}

export default Methodology;
