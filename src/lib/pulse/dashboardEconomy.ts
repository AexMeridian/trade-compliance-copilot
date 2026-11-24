// The Dashboard's "Markets and economy" section: borrowing rates, prices, jobs, commodities, currencies and the dollar's role,
// built from what the other endpoints already return. Pure functions (no database, network or model); a missing source drops its panel.
import { yearChange } from './briefing.js';

type Pt = [string, number];

export interface EconomyInputs {
  now: Date;
  markets: {
    tiles: { id: string; label: string; group?: string; unit: string; value: number; asOf: string; change?: number | null; changePct: number | null; points?: Pt[] }[];
    currencies: { quote: string; label: string; rate: number; change30dPct: number | null; asOf: string; spark?: number[] }[];
  } | null;
  everyday: {
    prices: { id: string; label: string; latest: [string, number] | null; points: Pt[] }[];
    jobs?: { id: string; label: string; latest: [string, number] | null; points: Pt[] }[];
  } | null;
  tic: { total?: { billions: number; yearAgoBillions: number | null; asOf: string }; countries?: { label: string; billions: number; yearAgoBillions: number | null }[] } | null;
}

export interface SeriesRow {
  id: string;
  label: string;
  latest: string; // month or date of the newest reading
  changePct: number | null;
  since: string | null;
  points: Pt[];
}
export interface EconomyPayload {
  asOf: string;
  summary: string[];
  keyNumbers: KeyNumber[];
  rates: { curve: { label: string; pct: number }[]; asOf: string; inverted: boolean } | null;
  inflation: { cpi: SeriesRow | null; prices: SeriesRow[] } | null;
  jobs: {
    unemployment: { pct: number; changePts: number | null; asOf: string; points: Pt[] } | null;
    payrolls: { thousands: number; monthlyChangeThousands: number | null; asOf: string; points: Pt[] } | null;
    industries: SeriesRow[];
  } | null;
  commodities: { id: string; label: string; unit: string; value: number; changePct: number | null; asOf: string; points: Pt[] }[];
  currencies: { quote: string; name: string; rate: number; change30dPct: number | null; spark: number[] }[];
  dollarRole: { reservesPct: number | null; reservesAsOf: string | null; holdersTotalBillions: number | null; holdersYearAgoBillions: number | null; holdersAsOf: string | null; topHolders: { label: string; billions: number; yearAgoBillions: number | null }[] } | null;
  tradePrices: { id: string; label: string; value: number; changePct: number | null; asOf: string; points: Pt[] }[];
}

/** One number for the top strip. */
export interface KeyNumber {
  id: string;
  label: string;
  value: string;
  change: string | null; // already worded, e.g. "up 0.4% in 30 days"
  direction: 'up' | 'down' | 'flat' | null;
  asOf: string | null;
  points: Pt[];
  href: string;
  section: string;
}

const CURRENCY_NAME: Record<string, string> = {
  EUR: 'Euro', CNY: 'Chinese yuan', JPY: 'Japanese yen', MXN: 'Mexican peso', CAD: 'Canadian dollar', GBP: 'British pound', INR: 'Indian rupee', KRW: 'South Korean won',
  CHF: 'Swiss franc', AUD: 'Australian dollar', BRL: 'Brazilian real', SGD: 'Singapore dollar', HKD: 'Hong Kong dollar', SEK: 'Swedish krona', NOK: 'Norwegian krone',
  DKK: 'Danish krone', PLN: 'Polish zloty', CZK: 'Czech koruna', HUF: 'Hungarian forint', RON: 'Romanian leu', BGN: 'Bulgarian lev', TRY: 'Turkish lira', ZAR: 'South African rand',
  ILS: 'Israeli shekel', IDR: 'Indonesian rupiah', MYR: 'Malaysian ringgit', PHP: 'Philippine peso', THB: 'Thai baht', NZD: 'New Zealand dollar', ISK: 'Icelandic krona',
};
const PRICE_SKIP = new Set(['BLS:IMPORT_PX']);
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthName = (iso: string) => `${MONTH[Number(iso.slice(5, 7)) - 1] ?? iso.slice(5, 7)} ${iso.slice(0, 4)}`;
const r1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);
const dir = (n: number | null): 'up' | 'down' | 'flat' | null => (n == null ? null : Math.abs(n) < 0.05 ? 'flat' : n > 0 ? 'up' : 'down');
const worded = (n: number | null, span: string) => (n == null ? null : Math.abs(n) < 0.05 ? `unchanged ${span}` : `${n > 0 ? 'up' : 'down'} ${r1(Math.abs(n))}% ${span}`);

function seriesRow(p: { id: string; label: string; latest: [string, number] | null; points: Pt[] }): SeriesRow | null {
  if (!p.latest) return null;
  const yc = yearChange(p.points);
  return { id: p.id, label: p.label, latest: p.latest[0], changePct: yc ? yc.changePct : null, since: yc ? yc.since : null, points: p.points.slice(-36) };
}

export function buildEconomy(i: EconomyInputs): EconomyPayload {
  const tile = (id: string) => i.markets?.tiles.find((t) => t.id === id) ?? null;
  const summary: string[] = [];
  const keyNumbers: KeyNumber[] = [];

  // Borrowing rates
  let rates: EconomyPayload['rates'] = null;
  const curve = [['3 months', 'UST:3M'], ['2 years', 'UST:2Y'], ['10 years', 'UST:10Y'], ['30 years', 'UST:30Y']]
    .map(([label, id]) => ({ label, t: tile(id) }))
    .filter((c): c is { label: string; t: NonNullable<ReturnType<typeof tile>> } => !!c.t)
    .map((c) => ({ label: c.label, pct: c.t.value, asOf: c.t.asOf }));
  if (curve.length >= 2) {
    const short = curve[0].pct > curve[curve.length - 2].pct;
    rates = { curve: curve.map(({ label, pct }) => ({ label, pct })), asOf: curve[0].asOf, inverted: short };
    const ten = tile('UST:10Y');
    if (ten) {
      summary.push(`The U.S. government pays about ${r1(ten.value)}% to borrow for 10 years.`);
      keyNumbers.push({ id: 'ten-year', label: 'Borrowing rate (10 years)', value: `${ten.value.toFixed(2)}%`, change: null, direction: null, asOf: ten.asOf, points: (ten.points ?? []).slice(-60), href: '#rates', section: 'economy' });
    }
    if (short) summary.push('Short-term borrowing currently costs more than long-term borrowing, which is unusual.');
  }

  // Prices
  let inflation: EconomyPayload['inflation'] = null;
  if (i.everyday) {
    const cpiSrc = i.everyday.prices.find((p) => p.id === 'BLS:CPI');
    const cpi = cpiSrc ? seriesRow(cpiSrc) : null;
    const prices = i.everyday.prices.filter((p) => p.id !== 'BLS:CPI' && !PRICE_SKIP.has(p.id)).map(seriesRow).filter((r): r is SeriesRow => !!r);
    inflation = { cpi, prices };
    if (cpi?.changePct != null) {
      summary.push(`Prices overall are ${r1(Math.abs(cpi.changePct))}% ${cpi.changePct >= 0 ? 'higher' : 'lower'} than a year ago.`);
      keyNumbers.unshift({ id: 'inflation', label: 'Prices vs a year ago', value: `${cpi.changePct >= 0 ? '+' : '−'}${r1(Math.abs(cpi.changePct))}%`, change: cpi.since ? `compared with ${monthName(cpi.since)}` : null, direction: dir(cpi.changePct), asOf: cpi.latest, points: cpi.points, href: '#inflation', section: 'economy' });
    }
  }

  // Jobs
  let jobs: EconomyPayload['jobs'] = null;
  const un = tile('BLS:UNRATE');
  const pay = tile('BLS:PAYROLLS');
  const industries = (i.everyday?.jobs ?? []).map(seriesRow).filter((r): r is SeriesRow => !!r);
  if (un || pay || industries.length) {
    jobs = {
      unemployment: un ? { pct: un.value, changePts: un.change ?? null, asOf: un.asOf, points: (un.points ?? []).slice(-36) } : null,
      payrolls: pay ? { thousands: pay.value, monthlyChangeThousands: pay.points && pay.points.length > 1 ? pay.value - pay.points[pay.points.length - 2][1] : null, asOf: pay.asOf, points: (pay.points ?? []).slice(-36) } : null,
      industries,
    };
    if (un) {
      summary.push(`The unemployment rate is ${r1(un.value)}%.`);
      keyNumbers.push({ id: 'unemployment', label: 'Unemployment rate', value: `${r1(un.value)}%`, change: un.change == null ? null : un.change === 0 ? 'unchanged from last month' : `${un.change > 0 ? 'up' : 'down'} ${r1(Math.abs(un.change))} points from last month`, direction: dir(un.change ?? null), asOf: un.asOf, points: (un.points ?? []).slice(-36), href: '#jobs', section: 'economy' });
    }
  }

  // Commodities
  const commodities = (i.markets?.tiles ?? [])
    .filter((t) => t.group === 'Commodities')
    .map((t) => ({ id: t.id, label: t.label, unit: t.unit, value: t.value, changePct: t.changePct, asOf: t.asOf, points: (t.points ?? []).slice(-36) }));
  const brent = commodities.find((c) => c.id === 'IMF:POILBRE');
  if (brent) keyNumbers.push({ id: 'oil', label: 'Oil, per barrel (Brent)', value: `$${Math.round(brent.value)}`, change: worded(brent.changePct, 'from last month'), direction: dir(brent.changePct), asOf: brent.asOf, points: brent.points, href: '#commodities', section: 'economy' });
  const gold = commodities.find((c) => c.id === 'IMF:PGOLD');
  if (gold) keyNumbers.push({ id: 'gold', label: 'Gold, per ounce', value: `$${Math.round(gold.value).toLocaleString('en-US')}`, change: worded(gold.changePct, 'from last month'), direction: dir(gold.changePct), asOf: gold.asOf, points: gold.points, href: '#commodities', section: 'economy' });

  // Currencies (the rate is units of the other currency per dollar, so a rise means the dollar buys more)
  const currencies = (i.markets?.currencies ?? [])
    .map((c) => ({ quote: c.quote, name: CURRENCY_NAME[c.quote] ?? c.quote, rate: c.rate, change30dPct: c.change30dPct, spark: (c.spark ?? []).slice(-45) }))
    .sort((a, b) => Math.abs(b.change30dPct ?? 0) - Math.abs(a.change30dPct ?? 0));
  const eur = currencies.find((c) => c.quote === 'EUR');
  if (eur) keyNumbers.push({ id: 'dollar', label: 'Dollar vs the euro', value: `${eur.rate.toFixed(3)} €`, change: worded(eur.change30dPct, 'in 30 days'), direction: dir(eur.change30dPct), asOf: i.markets?.currencies.find((c) => c.quote === 'EUR')?.asOf ?? null, points: eur.spark.map((v, k) => [String(k), v] as Pt), href: '#currencies', section: 'economy' });

  // The dollar's role
  let dollarRole: EconomyPayload['dollarRole'] = null;
  const reserves = tile('COFER:USD_SHARE');
  if (reserves || i.tic) {
    dollarRole = {
      reservesPct: reserves?.value ?? null,
      reservesAsOf: reserves?.asOf ?? null,
      holdersTotalBillions: i.tic?.total?.billions ?? null,
      holdersYearAgoBillions: i.tic?.total?.yearAgoBillions ?? null,
      holdersAsOf: i.tic?.total?.asOf ?? null,
      topHolders: (i.tic?.countries ?? []).slice(0, 8).map((c) => ({ label: c.label, billions: c.billions, yearAgoBillions: c.yearAgoBillions })),
    };
    if (reserves) keyNumbers.push({ id: 'reserves', label: 'Dollar share of world reserves', value: `${r1(reserves.value)}%`, change: null, direction: null, asOf: reserves.asOf, points: [], href: '#dollar', section: 'economy' });
  }

  // Import, export and producer prices
  const tradePrices = ['BLS:IMPORT_PX', 'BLS:EXPORT_PX', 'BLS:PPI']
    .map((id) => tile(id))
    .filter((t): t is NonNullable<ReturnType<typeof tile>> => !!t)
    .map((t) => ({ id: t.id, label: t.label, value: t.value, changePct: t.changePct, asOf: t.asOf, points: (t.points ?? []).slice(-36) }));

  // Put the key numbers in a stable, sensible order.
  const order = ['inflation', 'unemployment', 'ten-year', 'dollar', 'oil', 'gold', 'reserves'];
  keyNumbers.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

  return { asOf: i.now.toISOString(), summary, keyNumbers, rates, inflation, jobs, commodities, currencies, dollarRole, tradePrices };
}
