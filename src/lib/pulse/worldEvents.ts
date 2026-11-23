// Major world events for the "Today" page, from two free public feeds that allow automated reads: the U.S. Geological Survey (earthquakes)
// and NASA's EONET (storms, volcanoes, wildfires, floods). Fetched inside the cached /today build, so nothing is stored and nothing writes.

export interface WorldEvent {
  kind: 'earthquake' | 'storm' | 'volcano' | 'wildfire' | 'flood';
  title: string;
  date: string; // YYYY-MM-DD
  url: string;
  magnitude?: number;
}

const UA = 'AexTerminal/1.0 (+https://aexterminal.com)';
const USGS = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson';
const EONET = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=60&days=14';
const KIND: Record<string, WorldEvent['kind']> = { severeStorms: 'storm', volcanoes: 'volcano', wildfires: 'wildfire', floods: 'flood' };
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Earthquakes of magnitude 5.5 and up, strongest first. */
export function parseUsgs(json: unknown, minMag = 5.5, limit = 5): WorldEvent[] {
  const features = (json as { features?: { properties?: { mag?: number; place?: string; time?: number; url?: string } }[] } | null)?.features;
  if (!Array.isArray(features)) return [];
  const out: WorldEvent[] = [];
  for (const f of features) {
    const p = f.properties;
    if (!p || typeof p.mag !== 'number' || p.mag < minMag || typeof p.time !== 'number' || !p.url) continue;
    out.push({ kind: 'earthquake', title: `Magnitude ${p.mag.toFixed(1)} earthquake, ${p.place ?? 'location not stated'}`, date: day(p.time), url: p.url, magnitude: p.mag });
  }
  return out.sort((a, b) => (b.magnitude ?? 0) - (a.magnitude ?? 0)).slice(0, limit);
}

/** Open storms, volcanoes, wildfires and floods, most recently active first. */
export function parseEonet(json: unknown, limit = 6): WorldEvent[] {
  const events = (json as { events?: { title?: string; link?: string; categories?: { id?: string }[]; geometry?: { date?: string }[] }[] } | null)?.events;
  if (!Array.isArray(events)) return [];
  const out: WorldEvent[] = [];
  for (const e of events) {
    const kind = (e.categories ?? []).map((c) => (c.id ? KIND[c.id] : undefined)).find(Boolean);
    const last = e.geometry?.[e.geometry.length - 1]?.date;
    if (!kind || !e.title || !e.link || !last) continue;
    out.push({ kind, title: e.title, date: last.slice(0, 10), url: e.link });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Either source may fail on its own; null means neither answered. */
export async function fetchWorldEvents(): Promise<WorldEvent[] | null> {
  const [quakes, natural] = await Promise.all([getJson(USGS).then((j) => parseUsgs(j)).catch(() => null), getJson(EONET).then((j) => parseEonet(j)).catch(() => null)]);
  if (quakes === null && natural === null) return null;
  return [...(quakes ?? []), ...(natural ?? [])];
}
