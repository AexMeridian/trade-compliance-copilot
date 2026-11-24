// The Dashboard's "People, politics and the world" section: dates coming up, headlines by topic, travel warnings by level, and where
// refugees and humanitarian money are. Pure functions (no database, network or model); a missing source drops its panel.
import { parseCountries } from './briefing.js';

export interface WorldInputs {
  now: Date;
  feed: { actions: { title: string; html_url: string; publication_date: string; effective_on?: string | null; comments_close_on?: string | null }[] } | null;
  news: { items: { title: string; url: string; source: string; category: string; published_at: string; countries?: string | string[] | null }[] } | null;
  advisories: { asOf: string; items: { country: string; level: number; title: string; url: string; updated: string }[] } | null;
  power: { indicators: { id: string; latestYear: number | null; distribution: [string, number][] }[] } | null;
}

export interface WorldPayload {
  asOf: string;
  upcoming: { date: string; kind: 'Comments close' | 'Takes effect'; title: string; url: string }[];
  headlines: { topic: string; items: { title: string; url: string; source: string; date: string; countries: string[] }[] }[];
  travel: { counts: { level: number; countries: number }[]; level4: { country: string; url: string; updated: string }[]; asOf: string } | null;
  displacement: { year: number; total: number; top: { cc: string; count: number }[] } | null;
  humanitarian: { year: number; total: number; top: { cc: string; usd: number }[] } | null;
}

const TOPICS: [string, string][] = [
  ['Elections & Politics', 'Elections and politics'],
  ['Official', 'Governments and official announcements'],
  ['Diplomacy & alliances', 'Diplomacy and alliances'],
  ['Trade & Supply Chain', 'Trade and shipping'],
  ['Markets & Currency', 'Money and markets'],
];
const clip = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const day = (d: Date) => d.toISOString().slice(0, 10);

export function buildWorld(i: WorldInputs): WorldPayload {
  const today = day(i.now);
  const horizon = day(new Date(i.now.getTime() + 60 * 86_400_000));

  const upcoming: WorldPayload['upcoming'] = [];
  for (const a of i.feed?.actions ?? []) {
    if (a.comments_close_on && a.comments_close_on >= today && a.comments_close_on <= horizon) upcoming.push({ date: a.comments_close_on, kind: 'Comments close', title: clip(a.title), url: a.html_url });
    if (a.effective_on && a.effective_on >= today && a.effective_on <= horizon) upcoming.push({ date: a.effective_on, kind: 'Takes effect', title: clip(a.title), url: a.html_url });
  }
  upcoming.sort((a, b) => a.date.localeCompare(b.date));

  const headlines: WorldPayload['headlines'] = [];
  for (const [category, topic] of TOPICS) {
    const items = (i.news?.items ?? [])
      .filter((n) => n.category === category)
      .sort((a, b) => b.published_at.localeCompare(a.published_at))
      .slice(0, 4)
      .map((n) => ({ title: clip(n.title), url: n.url, source: n.source, date: n.published_at.slice(0, 10), countries: parseCountries(n.countries) }));
    if (items.length) headlines.push({ topic, items });
  }

  let travel: WorldPayload['travel'] = null;
  if (i.advisories?.items.length) {
    const items = i.advisories.items;
    travel = {
      counts: [1, 2, 3, 4].map((level) => ({ level, countries: items.filter((a) => a.level === level).length })),
      level4: items.filter((a) => a.level === 4).sort((a, b) => b.updated.localeCompare(a.updated)).map(({ country, url, updated }) => ({ country, url, updated })),
      asOf: i.advisories.asOf.slice(0, 10),
    };
  }

  const dist = (id: string) => i.power?.indicators.find((x) => x.id === id && x.distribution.length > 0) ?? null;
  const ref = dist('refugees_hosted');
  const displacement = ref ? { year: ref.latestYear ?? 0, total: ref.distribution.reduce((s, [, v]) => s + v, 0), top: [...ref.distribution].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([cc, count]) => ({ cc, count })) } : null;
  const hum = dist('humanitarian_given');
  const humanitarian = hum ? { year: hum.latestYear ?? 0, total: hum.distribution.reduce((s, [, v]) => s + v, 0), top: [...hum.distribution].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([cc, usd]) => ({ cc, usd })) } : null;

  return { asOf: i.now.toISOString(), upcoming: upcoming.slice(0, 10), headlines, travel, displacement, humanitarian };
}
