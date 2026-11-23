// Freight and supply-chain indicators from two free, keyless public sources:
//   1. Federal Reserve Bank of New York, Global Supply Chain Pressure Index (GSCPI): monthly, standard deviations from the average (0 = normal).
//      The bank publishes it only as a spreadsheet (an old-format .xls, https://www.newyorkfed.org/medialibrary/research/interactives/gscpi/downloads/gscpi_data.xlsx),
//      so this file reads that one spreadsheet with a small built-in reader (no dependency): the compound-file container and its BIFF8 cells.
//   2. IMF PortWatch (https://portwatch.imf.org): daily vessel transits through 28 chokepoints, estimated from ship-tracking (AIS) signals, served
//      by the IMF's public ArcGIS feature service. Stored as WEEKLY averages of daily transits (a few hundred rows in all), only for the chokepoints
//      that matter for U.S. trade, and only complete Monday-to-Sunday weeks.
// Both go into market_series (like the BLS and Treasury series), and the shared writer rewrites only rows whose value changed.
import type { Env } from '../../types/env.js';
import type { RefreshResult } from '../refresh/types.js';
import { writeSeries, type SeriesMeta } from './markets.js';
import { USER_AGENT } from '../refresh/userAgent.js';

const TIMEOUT_MS = 20_000;
export const GSCPI_URL = 'https://www.newyorkfed.org/medialibrary/research/interactives/gscpi/downloads/gscpi_data.xlsx';
export const GSCPI_PAGE = 'https://www.newyorkfed.org/research/policy/gscpi';
export const PORTWATCH_PAGE = 'https://portwatch.imf.org/';
const PORTWATCH_BASE = 'https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Daily_Chokepoints_Data/FeatureServer/0/query';

export const GSCPI_ID = 'NYFED:GSCPI';
export const GSCPI_META: SeriesMeta = {
  id: GSCPI_ID,
  label: 'Global Supply Chain Pressure Index',
  unit: 'standard deviations from the 1997-onward average (0 = normal)',
  source: 'Federal Reserve Bank of New York, GSCPI',
  sourceUrl: GSCPI_PAGE,
};

// The chokepoints that carry U.S.-relevant trade: canals and straits on the main container, tanker and bulk routes.
export const CHOKEPOINTS: { portid: string; name: string }[] = [
  { portid: 'chokepoint1', name: 'Suez Canal' },
  { portid: 'chokepoint2', name: 'Panama Canal' },
  { portid: 'chokepoint4', name: 'Bab el-Mandeb Strait' },
  { portid: 'chokepoint5', name: 'Malacca Strait' },
  { portid: 'chokepoint6', name: 'Strait of Hormuz' },
  { portid: 'chokepoint7', name: 'Cape of Good Hope' },
  { portid: 'chokepoint11', name: 'Taiwan Strait' },
];
export const pwId = (portid: string) => `PW:${portid}`;
export const CHOKEPOINT_META: SeriesMeta[] = CHOKEPOINTS.map((c) => ({
  id: pwId(c.portid),
  label: c.name,
  unit: 'vessels per day, weekly average (all vessel types)',
  source: 'IMF PortWatch (ship-tracking estimates)',
  sourceUrl: PORTWATCH_PAGE,
}));

// ---------------------------------------------------------------------------------------------------------------------
// A minimal reader for the one spreadsheet shape needed: OLE2 compound file -> "Workbook" stream -> BIFF8 records.
// Handles shared strings (with CONTINUE records), NUMBER, RK and MULRK cells. Reads the first worksheet only.
// ---------------------------------------------------------------------------------------------------------------------
const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

function readCompoundStream(file: Uint8Array, wanted: string[]): Uint8Array {
  const sig = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  if (file.length < 512 || sig.some((v, i) => file[i] !== v)) throw new Error('not a spreadsheet (compound file signature missing)');
  const ss = 1 << u16(file, 0x1e);
  const sector = (n: number) => file.subarray(512 + n * ss, 512 + (n + 1) * ss);
  const nFat = u32(file, 0x2c);
  const difat: number[] = [];
  for (let i = 0; i < 109; i++) difat.push(u32(file, 0x4c + i * 4));
  let nextDifat = u32(file, 0x44);
  for (let guard = 0; nextDifat < 0xfffffffa && guard < 64; guard++) {
    const s = sector(nextDifat);
    for (let i = 0; i < ss / 4 - 1; i++) difat.push(u32(s, i * 4));
    nextDifat = u32(s, ss - 4);
  }
  const fat: number[] = [];
  for (const sid of difat.slice(0, nFat)) {
    const s = sector(sid);
    for (let i = 0; i < ss / 4; i++) fat.push(u32(s, i * 4));
  }
  const chain = (start: number, size?: number): Uint8Array => {
    const parts: Uint8Array[] = [];
    let n = start;
    for (let guard = 0; n < 0xfffffffa && guard < 1_000_000; guard++) {
      parts.push(sector(n));
      n = fat[n] ?? 0xfffffffe;
    }
    const out = new Uint8Array(parts.length * ss);
    parts.forEach((p, i) => out.set(p, i * ss));
    return size === undefined ? out : out.subarray(0, size);
  };
  const dir = chain(u32(file, 0x30));
  for (let o = 0; o + 128 <= dir.length; o += 128) {
    const nameLen = u16(dir, o + 0x40);
    if (nameLen < 2) continue;
    let name = '';
    for (let i = 0; i < nameLen / 2 - 1; i++) name += String.fromCharCode(u16(dir, o + i * 2));
    if (!wanted.includes(name) || dir[o + 0x42] !== 2) continue;
    const size = u32(dir, o + 0x78);
    if (size < u32(file, 0x38)) throw new Error('workbook stream is in the mini stream; unsupported');
    return chain(u32(dir, o + 0x74), size);
  }
  throw new Error('no Workbook stream in the spreadsheet');
}

function rkValue(rk: number): number {
  let v: number;
  if (rk & 2) v = rk >> 2; // 30-bit signed integer
  else {
    const buf = new DataView(new ArrayBuffer(8));
    buf.setUint32(4, (rk & 0xfffffffc) >>> 0, true);
    v = buf.getFloat64(0, true);
  }
  return rk & 1 ? v / 100 : v;
}

interface Chunk {
  data: Uint8Array;
}

/** Shared-string table: strings may continue into CONTINUE records, where the continuation starts with a fresh "high byte" flag. */
function parseSst(chunks: Chunk[]): string[] {
  const out: string[] = [];
  let ci = 0;
  let pos = 8; // skip total and unique counts
  const unique = u32(chunks[0].data, 4);
  const cur = () => chunks[ci].data;
  const need = (n: number) => {
    while (pos + n > cur().length && ci < chunks.length - 1) {
      ci++;
      pos = 0;
    }
  };
  for (let s = 0; s < unique && ci < chunks.length; s++) {
    if (pos >= cur().length) {
      if (ci >= chunks.length - 1) break;
      ci++;
      pos = 0;
    }
    need(3);
    const cch = u16(cur(), pos);
    const flags = cur()[pos + 2];
    pos += 3;
    let runs = 0;
    let ext = 0;
    if (flags & 8) {
      runs = u16(cur(), pos);
      pos += 2;
    }
    if (flags & 4) {
      ext = u32(cur(), pos);
      pos += 4;
    }
    let wide = (flags & 1) === 1;
    let text = '';
    let left = cch;
    while (left > 0) {
      if (pos >= cur().length) {
        ci++;
        if (ci >= chunks.length) break;
        pos = 0;
        wide = (cur()[pos] & 1) === 1; // continuation re-states the width flag
        pos += 1;
      }
      const room = cur().length - pos;
      const take = Math.min(left, wide ? Math.floor(room / 2) : room);
      if (take <= 0) {
        pos = cur().length;
        continue;
      }
      for (let i = 0; i < take; i++) text += String.fromCharCode(wide ? u16(cur(), pos + i * 2) : cur()[pos + i]);
      pos += take * (wide ? 2 : 1);
      left -= take;
    }
    pos += runs * 4 + ext;
    out.push(text);
  }
  return out;
}

export type Cell = string | number;

/** Cells of the first worksheet as `rows[row][col]`. */
export function readFirstSheet(file: Uint8Array): Map<number, Map<number, Cell>> {
  const wb = readCompoundStream(file, ['Workbook', 'Book']);
  const sstChunks: Chunk[] = [];
  const pending: { r: number; c: number; sst: number }[] = [];
  const rows = new Map<number, Map<number, Cell>>();
  const put = (r: number, c: number, v: Cell) => {
    const row = rows.get(r) ?? new Map<number, Cell>();
    row.set(c, v);
    rows.set(r, row);
  };
  let bof = 0;
  let inSst = false;
  for (let o = 0; o + 4 <= wb.length; ) {
    const id = u16(wb, o);
    const len = u16(wb, o + 2);
    const body = wb.subarray(o + 4, o + 4 + len);
    o += 4 + len;
    if (id === 0x0809) {
      bof++;
      inSst = false;
      if (bof > 2) break; // first worksheet ends where the next one starts
    } else if (id === 0x00fc) {
      sstChunks.push({ data: body });
      inSst = true;
    } else if (id === 0x003c && inSst) {
      sstChunks.push({ data: body });
    } else {
      inSst = false;
      if (bof !== 2) continue;
      if (id === 0x00fd) pending.push({ r: u16(body, 0), c: u16(body, 2), sst: u32(body, 6) });
      else if (id === 0x0203) put(u16(body, 0), u16(body, 2), new DataView(body.buffer, body.byteOffset + 6, 8).getFloat64(0, true));
      else if (id === 0x027e) put(u16(body, 0), u16(body, 2), rkValue(u32(body, 6)));
      else if (id === 0x00bd) {
        const r = u16(body, 0);
        const c0 = u16(body, 2);
        const n = (len - 6) / 6;
        for (let i = 0; i < n; i++) put(r, c0 + i, rkValue(u32(body, 4 + i * 6 + 2)));
      }
    }
  }
  const strings = sstChunks.length ? parseSst(sstChunks) : [];
  for (const p of pending) if (strings[p.sst] !== undefined) put(p.r, p.c, strings[p.sst]);
  return rows;
}

const MONTHS: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };

/** "31-Oct-2026" (text) or an Excel serial date (number) to "2026-10-01" (the month). */
function monthOf(cell: Cell | undefined): string | null {
  if (typeof cell === 'string') {
    const m = /^\s*(\d{1,2})[-\s]([A-Za-z]{3})[a-z]*[-\s](\d{4})\s*$/.exec(cell);
    return m && MONTHS[m[2].toLowerCase()] ? `${m[3]}-${MONTHS[m[2].toLowerCase()]}-01` : null;
  }
  if (typeof cell === 'number' && cell > 30000 && cell < 80000) return new Date(Math.round((cell - 25569) * 86_400_000)).toISOString().slice(0, 7) + '-01';
  return null;
}

export function parseGscpi(file: Uint8Array): { id: string; date: string; value: number }[] {
  const rows = readFirstSheet(file);
  const out: { id: string; date: string; value: number }[] = [];
  for (const [, row] of [...rows.entries()].sort((a, b) => a[0] - b[0])) {
    const date = monthOf(row.get(0));
    const value = row.get(1);
    if (date && typeof value === 'number' && Number.isFinite(value)) out.push({ id: GSCPI_ID, date, value: Math.round(value * 1000) / 1000 });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// PortWatch
// ---------------------------------------------------------------------------------------------------------------------
interface PwFeature {
  attributes?: { date?: string; portid?: string; n_total?: number | null };
}

const mondayOf = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};

/** Daily transits to the mean daily transits of each complete Monday-to-Sunday week, per chokepoint. */
export function weeklyTransits(features: PwFeature[]): { id: string; date: string; value: number }[] {
  const known = new Set(CHOKEPOINTS.map((c) => c.portid));
  const weeks = new Map<string, { id: string; date: string; days: Set<string>; sum: number }>();
  for (const f of features) {
    const a = f.attributes;
    if (!a?.portid || !known.has(a.portid) || !a.date || !/^\d{4}-\d{2}-\d{2}$/.test(a.date) || typeof a.n_total !== 'number' || !Number.isFinite(a.n_total)) continue;
    const monday = mondayOf(a.date);
    const key = `${a.portid}|${monday}`;
    const w = weeks.get(key) ?? { id: pwId(a.portid), date: monday, days: new Set<string>(), sum: 0 };
    if (!w.days.has(a.date)) {
      w.days.add(a.date);
      w.sum += a.n_total;
    }
    weeks.set(key, w);
  }
  return [...weeks.values()]
    .filter((w) => w.days.size === 7)
    .map((w) => ({ id: w.id, date: w.date, value: Math.round((w.sum / 7) * 10) / 10 }))
    .sort((a, b) => a.id.localeCompare(b.id) || a.date.localeCompare(b.date));
}

async function fetchPortWatch(years: number): Promise<PwFeature[]> {
  const from = new Date(Date.now() - years * 365 * 86_400_000).toISOString().slice(0, 10);
  const where = `date >= DATE '${from}' AND portid IN (${CHOKEPOINTS.map((c) => `'${c.portid}'`).join(',')})`;
  const features: PwFeature[] = [];
  // The service returns up to 10,000 records a page; three years of seven chokepoints is about 7,700. At most two requests.
  for (let page = 0; page < 2; page++) {
    const qs = new URLSearchParams({ where, outFields: 'date,portid,n_total', orderByFields: 'portid,date', resultOffset: String(features.length), f: 'json' });
    const res = await fetch(`${PORTWATCH_BASE}?${qs}`, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`PortWatch fetch failed: HTTP ${res.status}`);
    const json = (await res.json()) as { features?: PwFeature[]; error?: { message?: string }; exceededTransferLimit?: boolean };
    if (json.error) throw new Error(`PortWatch rejected the query: ${json.error.message ?? 'unknown'}`);
    features.push(...(json.features ?? []));
    if (!json.exceededTransferLimit) break;
  }
  return features;
}

/** Two sources, three requests at most. Either may fail alone; the other still loads and the error is reported. */
export async function refreshFreight(env: Env): Promise<RefreshResult & { note?: string }> {
  const rows: { id: string; date: string; value: number }[] = [];
  const meta: SeriesMeta[] = [];
  const failures: string[] = [];
  const gs = fetch(GSCPI_URL, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) })
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = parseGscpi(new Uint8Array(await res.arrayBuffer()));
      if (parsed.length < 12) throw new Error('the spreadsheet had no usable monthly rows; its layout may have changed');
      rows.push(...parsed);
      meta.push(GSCPI_META);
    })
    .catch((e) => void failures.push(`GSCPI (${(e as Error).message})`));
  const pw = fetchPortWatch(3)
    .then((features) => {
      const weekly = weeklyTransits(features);
      if (weekly.length === 0) throw new Error('no complete weeks returned');
      rows.push(...weekly);
      meta.push(...CHOKEPOINT_META);
    })
    .catch((e) => void failures.push(`PortWatch (${(e as Error).message})`));
  await Promise.all([gs, pw]);
  if (rows.length === 0) throw new Error(`No freight data loaded: ${failures.join('; ')}`);
  await writeSeries(env, meta, rows);
  return { source: 'freight_indicators', rows: rows.length, note: failures.length ? `Unavailable this run: ${failures.join('; ')}` : undefined };
}
