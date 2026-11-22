import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Breadcrumb } from '../components/Breadcrumb';

// One plain-language glossary for the whole site (user testing: /glossary was a 404, and terms like HTS, de minimis and "who pays a
// tariff" were defined nowhere a newcomer would look). Short, neutral definitions; each links to where the site uses the term.

const TERMS: { term: string; def: string; link?: { to: string; label: string } }[] = [
  { term: 'Tariff (duty)', def: 'A tax on goods brought into a country. In the U.S. the importing company pays it to U.S. Customs when the goods arrive; it may pass some or all of the cost on to buyers in its prices.', link: { to: '/prices', label: 'Tariffs and your wallet' } },
  { term: 'Who pays a tariff?', def: 'Legally, the importer of record (usually a U.S. business, or the carrier on your behalf for a package). Economically, the cost can be shared by the foreign seller (lower prices), the importer (lower profit) and the shopper (higher prices). Studies of the 2018-2019 tariffs found most of the cost was paid in the U.S.' },
  { term: 'HTS (Harmonized Tariff Schedule)', def: 'The official U.S. list of about 31,000 product codes and their tariff rates. The first six digits are shared worldwide; the rest are U.S.-specific.', link: { to: '/lookup', label: 'Tariff lookup' } },
  { term: 'De minimis', def: 'The rule that let packages worth $800 or less into the U.S. without duty. Suspended for every country since 29 August 2025; the law ends it on 1 July 2027.', link: { to: '/de-minimis', label: 'Small packages' } },
  { term: 'Section 232', def: 'A law that lets the President put tariffs on imports found to threaten national security. Used for steel, aluminum, copper, cars and car parts.' },
  { term: 'Section 301', def: 'A law that lets the U.S. Trade Representative respond to another country\'s unfair trade practices, often with tariffs. Used against China since 2018.' },
  { term: 'Section 338', def: 'A 1930 law allowing extra duties on a country that discriminates against U.S. commerce; this site shows its use on some goods from Canada.' },
  { term: 'Antidumping and countervailing duties (AD/CVD)', def: 'Extra duties on a specific product from a specific country, set after the government finds it was sold below fair value (dumping) or subsidized. They can exceed 100%.', link: { to: '/?tab=policy&q=antidumping', label: 'AD/CVD notices' } },
  { term: 'Merchandise processing fee (MPF)', def: 'A Customs fee charged on most imports to cover processing. Small "informal" entries pay a flat amount; larger ones pay a percentage within a minimum and maximum.' },
  { term: 'Informal entry', def: 'The simpler Customs process for low-value shipments (generally under $2,500), often handled by the carrier.' },
  { term: 'Landed cost', def: 'What an imported item really costs once it arrives: price, shipping, insurance, duties and fees.' },
  { term: 'USMCA', def: 'The United States-Mexico-Canada Agreement, the trade deal that replaced NAFTA in 2020. Goods that meet its rules of origin can enter duty-free.' },
  { term: 'Sanctions', def: 'Government restrictions that block dealings with named people, companies, ships or countries, usually to pressure a government or punish wrongdoing.' },
  { term: 'OFAC and the SDN list', def: 'The Treasury\'s Office of Foreign Assets Control keeps the Specially Designated Nationals (SDN) list. Americans generally may not deal with anyone on it.', link: { to: '/hard-power?tab=sanctions', label: 'Sanctions' } },
  { term: 'Entity List', def: 'A Commerce Department list of foreign companies and people that need a special license before they can receive U.S. goods or technology.' },
  { term: 'Export controls', def: 'Rules on what goods, software and technology may be sent abroad, to whom and for what use, mainly for military or security reasons.' },
  { term: 'ECCN', def: 'Export Control Classification Number: the code that says which export controls apply to an item. Most everyday goods are "EAR99", the catch-all with few restrictions.' },
  { term: 'Consumer Price Index (CPI)', def: 'The government\'s measure of how prices for everyday things change. "Month over month" compares with last month; "year over year" with the same month last year, the usual way to read inflation.' },
  { term: 'Import price index', def: 'What U.S. buyers pay foreign sellers for imported goods, before tariffs. A useful check on whether foreign sellers cut prices to absorb a tariff.' },
  { term: 'Exchange rate', def: 'How much of one currency a unit of another buys. On this site rates are shown as units of the foreign currency per U.S. dollar: a higher number means the dollar buys more.' },
  { term: 'Federal Register', def: 'The U.S. government\'s daily official publication of rules, notices and presidential documents. Most items on the Wire come from it.', link: { to: '/', label: 'The Wire' } },
  { term: 'Soft power', def: 'The ability to get others to want what you want through attraction (culture, values, policies) rather than force or payment. The term was coined by Joseph Nye in 1990.', link: { to: '/soft-power', label: 'Soft Power' } },
  { term: 'Hard power', def: 'Influence through coercion or payment: military strength, sanctions, tariffs and economic weight.', link: { to: '/hard-power', label: 'Hard Power' } },
  { term: 'Gini index', def: 'A measure of income inequality from 0 (everyone has the same income) to 100 (one person has everything). Higher means more unequal.' },
  { term: 'BRICS', def: 'A group of large emerging economies: Brazil, Russia, India, China and South Africa, joined since 2024 by several more countries.' },
  { term: 'G7 and G20', def: 'Clubs of major economies whose leaders meet yearly. The G7 is seven large democracies; the G20 adds major emerging economies and the European Union.' },
];

export function Glossary() {
  const [q, setQ] = useState('');
  const shown = TERMS.filter((t) => !q || `${t.term} ${t.def}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Breadcrumb trail={[{ label: 'Basics', to: '/basics' }, { label: 'Glossary' }]} />
      <h1 className="display mt-3 text-4xl text-ink sm:text-5xl">Glossary</h1>
      <p className="mt-3 text-base text-ink-muted">The words used on this site, in plain English.</p>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter, for example: tariff"
        aria-label="Filter the glossary"
        className="mt-5 w-full border border-hairline-strong bg-paper-raised px-3 py-2 text-base text-ink outline-none focus:border-accent"
      />
      <dl className="mt-6 divide-y divide-hairline">
        {shown.map((t) => (
          <div key={t.term} id={t.term.toLowerCase().replace(/[^a-z0-9]+/g, '-')} className="py-4">
            <dt className="text-lg font-semibold text-ink">{t.term}</dt>
            <dd className="mt-1 text-base leading-relaxed text-ink-muted">
              {t.def}
              {t.link && (
                <>
                  {' '}
                  <Link to={t.link.to} className="text-accent hover:underline">
                    {t.link.label} &rarr;
                  </Link>
                </>
              )}
            </dd>
          </div>
        ))}
        {shown.length === 0 && <p className="py-4 text-ink-faint">No term matches "{q}".</p>}
      </dl>
    </div>
  );
}
