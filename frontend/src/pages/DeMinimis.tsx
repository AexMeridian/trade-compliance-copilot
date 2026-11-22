import { Link } from 'react-router-dom';
import { Breadcrumb } from '../components/Breadcrumb';
import { PulsePanel } from '../components/PulsePanel';

// Plain-English explainer for people who buy or sell small packages across borders, the question the Etsy seller and the nurse sending
// packages home brought to user testing. Dates are the ones this site already states elsewhere, each with its official source.

const TIMELINE: { date: string; text: string; href: string; source: string }[] = [
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
];

export function DeMinimis() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Breadcrumb trail={[{ label: 'Basics', to: '/basics' }, { label: 'Small packages' }]} />
      <h1 className="display mt-3 text-4xl text-ink sm:text-5xl">Small packages from abroad now pay duty</h1>
      <p className="mt-4 text-lg leading-relaxed text-ink-muted">
        If you buy from sites that ship from other countries, or order supplies for a small business, you may have seen new charges on packages that used
        to arrive free. Here is what changed and what it means for you.
      </p>

      <PulsePanel title="In short" className="mt-6">
        <ul className="list-disc space-y-2 pl-5 text-base text-ink">
          <li>The old rule let packages worth $800 or less into the U.S. without duty. That rule is suspended for every country.</li>
          <li>Now a $30 order of beads or clothes can owe the same tariffs as a container of the same goods, plus a processing fee.</li>
          <li>Who collects it depends on how it ships: the carrier (UPS, FedEx, DHL) or the seller usually pays U.S. Customs and adds it to your bill, sometimes with a handling fee.</li>
          <li>How much depends on the product and where it was made. Goods from China face the highest extra duties.</li>
        </ul>
      </PulsePanel>

      <PulsePanel title="What changed, and when" className="mt-6">
        <ol className="flex flex-col gap-3">
          {TIMELINE.map((t) => (
            <li key={t.date} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 text-base">
              <span className="font-semibold text-ink">{t.date}</span>
              <span className="text-ink-muted">
                {t.text}{' '}
                <a href={t.href} target="_blank" rel="noreferrer" className="text-sm text-accent hover:underline">
                  Source: {t.source}
                </a>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-ink-muted">
          New Customs rules on postal shipments and how duty is collected keep coming out.{' '}
          <Link to="/?tab=policy&q=de%20minimis" className="text-accent hover:underline">
            See every official notice about de minimis on this site
          </Link>
          .
        </p>
      </PulsePanel>

      <PulsePanel title="Find what your product owes" className="mt-6">
        <p className="text-base text-ink-muted">
          Every product has a code in the U.S. tariff schedule. Use the{' '}
          <Link to="/lookup" className="font-semibold text-accent hover:underline">
            free tariff lookup
          </Link>{' '}
          to search by words (for example "glass beads") and the country it is made in. The result is an estimate of the duty rate; carriers may add their
          own brokerage or handling fee on top.
        </p>
      </PulsePanel>

      <PulsePanel title="Selling to buyers abroad?" className="mt-6">
        <p className="text-base text-ink-muted">
          Other countries set their own rules for packages coming in, and your buyer usually pays them. Two common destinations:
        </p>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-base text-ink-muted">
          <li>
            <span className="font-semibold text-ink">Canada:</span> low-value courier and postal shipments have their own duty and sales-tax thresholds.{' '}
            <a href="https://www.cbsa-asfc.gc.ca/import/courier/menu-eng.html" target="_blank" rel="noreferrer" className="text-accent hover:underline">
              Canada Border Services Agency
            </a>
          </li>
          <li>
            <span className="font-semibold text-ink">United Kingdom:</span> VAT on parcels worth £135 or less is charged at the time of sale (marketplaces
            such as Etsy usually collect it).{' '}
            <a href="https://www.gov.uk/goods-sent-from-abroad" target="_blank" rel="noreferrer" className="text-accent hover:underline">
              GOV.UK
            </a>
          </li>
        </ul>
        <p className="mt-3 text-sm text-ink-muted">
          Sending from the U.S. you usually need a customs form describing the item and its value; for items over $2,500 per product code, an export filing
          (EEI) is also required.{' '}
          <a href="https://www.census.gov/foreign-trade/schedules/b/" target="_blank" rel="noreferrer" className="text-accent hover:underline">
            Census: export codes (Schedule B)
          </a>
        </p>
      </PulsePanel>

      <p className="mt-6 text-sm text-ink-faint">General information, not legal or tax advice. Rules change: check the linked official pages before you ship.</p>
    </div>
  );
}
