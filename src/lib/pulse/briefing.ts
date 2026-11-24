// The "Today" dashboard: turns what the other endpoints already return into one small, plain-English payload.
// Pure functions only (no database, no network, no model): every sentence comes from a fixed template filled with a real number,
// and a source that is missing simply drops its card and its sentence.

import type { WorldEvent } from './worldEvents.js';

type Pt = [string, number];

export interface TodayInputs {
  now: Date;
  feed: { actions: { title: string; html_url: string; publication_date: string; tag: string; countries?: string | string[] | null }[] } | null;
  news: { items: { title: string; url: string; source: string; category: string; countries?: string | string[] | null; published_at: string }[] } | null;
  summary: { last30: number; prior30: number; trendPct: number | null; leadingTag?: string; leadingTagShare?: number; openForComment?: number } | null;
  markets: {
    tiles: { id: string; label: string; value: number; asOf: string; change?: number | null; changePct: number | null; sourceUrl?: string }[];
    currencies: { quote: string; label: string; rate: number; change30dPct: number | null; asOf: string }[];
  } | null;
  everyday: { prices: { id: string; label: string; source?: string; sourceUrl?: string; latest: [string, number] | null; points: Pt[] }[] } | null;
  advisories: { asOf: string; source: string; items: { country: string; level: number; title: string; url: string; updated: string }[] } | null;
  listChanges: { generatedAt: string; days: { date: string; addedTotal: number; removedTotal: number; lists: unknown }[] } | null;
  events?: WorldEvent[] | null;
}

export interface TodayCard<T> {
  data: T;
  asOf: string | null;
  source: string;
  sourceUrl: string;
}

export interface TodayPayload {
  asOf: string;
  sentences: { id: string; text: string; card: string }[];
  trade: TodayCard<{ last7: number; last30: number; trendPct: number | null; openForComment: number | null; leadingTag: string | null; recent: { title: string; url: string; date: string; tag: string; countries: string[] }[] }> | null;
  prices: TodayCard<{ id: string; label: string; latest: string; changePct: number | null; since: string | null; points: Pt[] }[]> | null;
  money: TodayCard<{
    currencies: { quote: string; name: string; rate: number; change30dPct: number | null }[];
    tenYearPct: number | null;
    oil: { value: number; changePct: number | null; asOf: string } | null;
    dollarReservesPct: number | null;
  }> | null;
  sanctions: TodayCard<{ date: string; added: number; removed: number } | null> | null;
  politics: TodayCard<{ title: string; url: string; source: string; date: string; category: string; countries: string[] }[]> | null;
  travel: TodayCard<{ level4: { country: string; title: string; url: string; updated: string }[]; level4Count: number; level3Count: number }> | null;
  events: TodayCard<WorldEvent[]> | null;
  /** Compact lists the page filters locally for "my countries". */
  forCountries: {
    notices: { title: string; url: string; date: string; countries: string[] }[];
    news: { title: string; url: string; source: string; date: string; countries: string[] }[];
    advisories: { country: string; level: number; url: string; updated: string }[];
  };
}

const CURRENCY_WORD: Record<string, string> = { EUR: 'euro', CNY: 'yuan', JPY: 'yen', MXN: 'peso', CAD: 'Canadian dollar', GBP: 'pound' };
const CURRENCY_NAME: Record<string, string> = { EUR: 'Euro', CNY: 'Chinese yuan', JPY: 'Japanese yen', MXN: 'Mexican peso', CAD: 'Canadian dollar', GBP: 'British pound' };
const CURRENCIES = ['EUR', 'CNY', 'JPY', 'MXN', 'CAD', 'GBP'];
const PRICE_IDS = ['BLS:CPI_FOOD_HOME', 'BLS:CPI_GASOLINE', 'BLS:CPI_NEW_CARS', 'BLS:CPI_APPAREL', 'BLS:CPI_COFFEE'];
const POLITICS = new Set(['Elections & Politics', 'Official', 'Diplomacy & alliances']);

export function parseCountries(v: string | string[] | null | undefined): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string' && /^[A-Z]{2}$/.test(x));
  if (!v) return [];
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string' && /^[A-Z]{2}$/.test(x)) : [];
  } catch {
    return v.split(',').map((s) => s.trim()).filter((x) => /^[A-Z]{2}$/.test(x));
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function monthYear(date: string): string {
  const m = Number(date.slice(5, 7));
  return m >= 1 && m <= 12 ? `${MONTHS[m - 1]} ${date.slice(0, 4)}` : date;
}

/**
 * Change over about a year, from the monthly points. The reading exactly 12 months earlier may be missing (the federal government did not collect
 * October 2025 prices), so the nearest reading within 45 days of that date is used and its month is reported, never a guess.
 */
export function yearChange(points: Pt[]): { changePct: number; since: string } | null {
  if (points.length < 2) return null;
  const [lastDate, last] = points[points.length - 1];
  const target = Date.parse(`${Number(lastDate.slice(0, 4)) - 1}${lastDate.slice(4)}T00:00:00Z`);
  if (Number.isNaN(target)) return null;
  let best: Pt | null = null;
  let bestGap = Infinity;
  for (const p of points.slice(0, -1)) {
    const gap = Math.abs(Date.parse(`${p[0]}T00:00:00Z`) - target);
    if (gap < bestGap) {
      best = p;
      bestGap = gap;
    }
  }
  if (!best || bestGap > 45 * 86_400_000 || !best[1]) return null;
  return { changePct: ((last - best[1]) / best[1]) * 100, since: best[0] };
}

const r1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);
const clip = (s: string, n = 150) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const dayStr = (d: Date) => d.toISOString().slice(0, 10);

export function buildToday(i: TodayInputs): TodayPayload {
  const sentences: TodayPayload['sentences'] = [];
  const sevenAgo = dayStr(new Date(i.now.getTime() - 7 * 86_400_000));

  // Trade notices
  let trade: TodayPayload['trade'] = null;
  if (i.feed) {
    const recent = i.feed.actions.slice(0, 5).map((a) => ({ title: clip(a.title), url: a.html_url, date: a.publication_date, tag: a.tag, countries: parseCountries(a.countries) }));
    const last7 = i.feed.actions.filter((a) => a.publication_date >= sevenAgo).length;
    trade = {
      data: {
        last7,
        last30: i.summary?.last30 ?? 0,
        trendPct: i.summary?.trendPct ?? null,
        openForComment: i.summary?.openForComment ?? null,
        leadingTag: i.summary?.leadingTag ?? null,
        recent,
      },
      asOf: i.feed.actions[0]?.publication_date ?? null,
      source: 'Federal Register',
      sourceUrl: 'https://www.federalregister.gov/',
    };
    if (i.feed.actions.length) {
      const t = i.summary && i.summary.last30 ? ` (${i.summary.last30} in the last 30 days)` : '';
      sentences.push({ id: 'trade', card: 'trade', text: `The U.S. government published ${last7} new trade ${last7 === 1 ? 'notice' : 'notices'} in the last 7 days${t}.` });
    }
  }

  // Everyday prices
  let prices: TodayPayload['prices'] = null;
  if (i.everyday) {
    const rows = PRICE_IDS.map((id) => i.everyday!.prices.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => !!p && !!p.latest)
      .map((p) => {
        const yc = yearChange(p.points);
        return { id: p.id, label: p.label, latest: p.latest![0], changePct: yc ? yc.changePct : null, since: yc ? yc.since : null, points: p.points.slice(-24) };
      });
    if (rows.length) {
      prices = { data: rows, asOf: rows[0].latest, source: 'U.S. Bureau of Labor Statistics', sourceUrl: 'https://www.bls.gov/cpi/' };
      const gas = rows.find((r) => r.id === 'BLS:CPI_GASOLINE');
      if (gas?.changePct != null && gas.since) {
        const up = gas.changePct >= 0;
        sentences.push({ id: 'gas', card: 'prices', text: `Gasoline prices are ${r1(Math.abs(gas.changePct))}% ${up ? 'higher' : 'lower'} than in ${monthYear(gas.since)}.` });
      }
      const food = rows.find((r) => r.id === 'BLS:CPI_FOOD_HOME');
      if (food?.changePct != null && food.since) {
        const up = food.changePct >= 0;
        sentences.push({ id: 'food', card: 'prices', text: `Groceries cost ${r1(Math.abs(food.changePct))}% ${up ? 'more' : 'less'} than in ${monthYear(food.since)}.` });
      }
    }
  }

  // Money
  let money: TodayPayload['money'] = null;
  if (i.markets) {
    const currencies = CURRENCIES.map((q) => i.markets!.currencies.find((c) => c.quote === q))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .map((c) => ({ quote: c.quote, name: CURRENCY_NAME[c.quote] ?? c.label, rate: c.rate, change30dPct: c.change30dPct }));
    const tile = (id: string) => i.markets!.tiles.find((t) => t.id === id);
    const brent = tile('IMF:POILBRE');
    money = {
      data: {
        currencies,
        tenYearPct: tile('UST:10Y')?.value ?? null,
        oil: brent ? { value: brent.value, changePct: brent.changePct, asOf: brent.asOf } : null,
        dollarReservesPct: tile('COFER:USD_SHARE')?.value ?? null,
      },
      asOf: i.markets.currencies[0]?.asOf ?? null,
      source: 'European Central Bank, U.S. Treasury, IMF',
      sourceUrl: 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html',
    };
    const eur = currencies.find((c) => c.quote === 'EUR');
    if (eur?.change30dPct != null) {
      // The rate is euros per dollar, so a rising rate means the dollar buys more.
      const up = eur.change30dPct >= 0;
      sentences.push({ id: 'dollar', card: 'money', text: `The dollar is ${up ? 'up' : 'down'} ${r1(Math.abs(eur.change30dPct))}% against the ${CURRENCY_WORD.EUR} over the past 30 days.` });
    }
    if (brent && brent.changePct != null) {
      sentences.push({ id: 'oil', card: 'money', text: `Oil (Brent) is about $${Math.round(brent.value)} a barrel, ${brent.changePct >= 0 ? 'up' : 'down'} ${r1(Math.abs(brent.changePct))}% from the month before.` });
    }
  }

  // Sanctions
  let sanctions: TodayPayload['sanctions'] = null;
  if (i.listChanges) {
    // The newest day on which something was actually added or removed (a day that only changed an entry's details is not news).
    const day = i.listChanges.days.find((d) => d.addedTotal + d.removedTotal > 0) ?? null;
    sanctions = {
      data: day ? { date: day.date, added: day.addedTotal, removed: day.removedTotal } : null,
      asOf: i.listChanges.generatedAt.slice(0, 10),
      source: 'OFAC, Commerce, UN and UK sanctions lists, compared daily',
      sourceUrl: '/changes',
    };
    if (day) sentences.push({ id: 'sanctions', card: 'sanctions', text: `The latest change to the sanctions lists was on ${day.date}: ${day.addedTotal} added, ${day.removedTotal} removed.` });
  }

  // Politics and diplomacy
  let politics: TodayPayload['politics'] = null;
  if (i.news) {
    const sorted = [...i.news.items].sort((a, b) => b.published_at.localeCompare(a.published_at));
    const pick = sorted.filter((n) => POLITICS.has(n.category));
    const rest = sorted.filter((n) => !POLITICS.has(n.category) && n.category !== 'Markets & Currency');
    const items = [...pick, ...rest].slice(0, 6).map((n) => ({ title: clip(n.title), url: n.url, source: n.source, date: n.published_at.slice(0, 10), category: n.category, countries: parseCountries(n.countries) }));
    if (items.length) {
      politics = { data: items, asOf: items[0].date, source: 'News outlets and official feeds, listed on each item', sourceUrl: '/methodology' };
      sentences.unshift({ id: 'headline', card: 'politics', text: `Top headline: ${items[0].title} (${items[0].source}).` });
    }
  }

  // Travel
  let travel: TodayPayload['travel'] = null;
  if (i.advisories) {
    const l4 = i.advisories.items.filter((a) => a.level === 4).sort((a, b) => b.updated.localeCompare(a.updated));
    travel = {
      data: { level4: l4.slice(0, 8).map(({ country, title, url, updated }) => ({ country, title, url, updated })), level4Count: l4.length, level3Count: i.advisories.items.filter((a) => a.level === 3).length },
      asOf: i.advisories.asOf.slice(0, 10),
      source: 'U.S. Department of State',
      sourceUrl: 'https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html',
    };
    sentences.push({ id: 'travel', card: 'travel', text: l4.length === 1 ? `1 country currently carries the State Department's "Do not travel" warning (Level 4).` : `${l4.length} countries currently carry the State Department's "Do not travel" warning (Level 4).` });
  }

  // Major world events
  let events: TodayPayload['events'] = null;
  if (i.events && i.events.length) {
    events = { data: i.events, asOf: i.events.map((e) => e.date).sort().reverse()[0] ?? null, source: 'U.S. Geological Survey, NASA EONET', sourceUrl: 'https://earthquake.usgs.gov/earthquakes/map/' };
    const quake = i.events.filter((e) => e.kind === 'earthquake')[0];
    if (quake) sentences.push({ id: 'quake', card: 'events', text: `The strongest earthquake of the past week was ${quake.title.replace(' earthquake,', ' earthquake')}.` });
  }

  return {
    asOf: i.now.toISOString(),
    sentences: sentences.slice(0, 7),
    trade,
    prices,
    money,
    sanctions,
    politics,
    travel,
    events,
    forCountries: {
      notices: (i.feed?.actions ?? []).slice(0, 100).map((a) => ({ title: clip(a.title, 120), url: a.html_url, date: a.publication_date, countries: parseCountries(a.countries) })).filter((a) => a.countries.length),
      news: (i.news?.items ?? []).map((n) => ({ title: clip(n.title, 120), url: n.url, source: n.source, date: n.published_at.slice(0, 10), countries: parseCountries(n.countries) })).filter((n) => n.countries.length),
      advisories: (i.advisories?.items ?? []).map((a) => ({ country: a.country, level: a.level, url: a.url, updated: a.updated })),
    },
  };
}
