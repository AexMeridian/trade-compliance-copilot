import { Link } from 'react-router-dom';
import { Breadcrumb } from '../components/Breadcrumb';

// The front door for people who are not trade professionals: the questions ordinary visitors brought to user testing, each answered on
// its own page with official data and plain words.
const CARDS: { to: string; title: string; text: string }[] = [
  { to: '/prices', title: 'Tariffs and your wallet', text: 'What groceries, medicine, appliances and cars cost compared with a year ago, jobs in steel and cars, and how much tariffs collect.' },
  { to: '/lookup', title: 'Look up a tariff', text: 'Search any product by words or code and see the tariff on it from the country where it is made. Free, no account.' },
  { to: '/de-minimis', title: 'Small packages from abroad', text: 'Why online orders from other countries now owe duty, what changed and when, and what your buyers abroad pay.' },
  { to: '/us-china', title: 'The U.S. and China, side by side', text: 'Economy, military, trade, research and how the world sees each, every figure with its year and source.' },
  { to: '/country/mx', title: 'Traveling or sending money home?', text: 'Each country page has a box for travelers and families: the exchange rate in plain words, its trend, a converter and the State Department advisory.' },
  { to: '/glossary', title: 'Glossary', text: 'Tariff, HTS, de minimis, sanctions, CPI and every other term on this site, in plain English.' },
];

export function Basics() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Breadcrumb trail={[{ label: 'Wire', to: '/' }, { label: 'Basics' }]} />
      <h1 className="display mt-3 text-4xl text-ink sm:text-5xl">Trade, in plain English</h1>
      <p className="mt-3 max-w-2xl text-lg leading-relaxed text-ink-muted">
        Start here if you are not a trade professional. Each page answers one everyday question with official government data, in plain words.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => (
          <Link key={c.to} to={c.to} className="group block border border-hairline bg-paper-raised px-5 py-4 no-underline hover:border-accent">
            <p className="text-lg font-semibold text-ink group-hover:text-accent">{c.title} &rarr;</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-ink-muted">{c.text}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
