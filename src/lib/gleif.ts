// Ownership hints for screening, from GLEIF (the Global Legal Entity Identifier Foundation): keyless, CC0 open data.
// A listed company's subsidiary is not on any list by itself, and the 50-percent rule can make dealing with it
// restricted anyway, so screening only the typed name misses it. This looks the party up by its exact registered name,
// reads its self-reported direct and ultimate parents, and lets the caller screen those names too.
//
// Deliberately conservative: only an exact (normalized) legal-name match is used -- a near match could point at an
// unrelated company -- and any failure or timeout returns null so screening itself is never blocked or changed.
import { normalizeNameString } from './normalize.js';
import { USER_AGENT } from './refresh/userAgent.js';

const BASE = 'https://api.gleif.org/api/v1/lei-records';
const TIMEOUT_MS = 4_000;

export interface GleifParty {
  lei: string;
  name: string;
  country: string | null;
}
export interface PartyOwnership {
  entity: GleifParty;
  direct_parent: GleifParty | null;
  ultimate_parent: GleifParty | null;
  source_url: string;
}

interface GleifRecord {
  id: string;
  attributes?: { entity?: { legalName?: { name?: string }; legalAddress?: { country?: string }; status?: string } };
}

const headers = { Accept: 'application/vnd.api+json', 'User-Agent': USER_AGENT };

export function toParty(r: GleifRecord | undefined | null): GleifParty | null {
  const name = r?.attributes?.entity?.legalName?.name;
  if (!r || !name) return null;
  return { lei: r.id, name, country: r.attributes?.entity?.legalAddress?.country ?? null };
}

/** Picks the one record whose registered name equals the typed name once both are normalized; otherwise nothing. */
export function pickExact(typed: string, records: GleifRecord[]): GleifRecord | null {
  const want = normalizeNameString(typed);
  if (!want) return null;
  const hits = records.filter((r) => r.attributes?.entity?.legalName?.name && normalizeNameString(r.attributes.entity.legalName.name) === want);
  const active = hits.filter((r) => r.attributes?.entity?.status === 'ACTIVE');
  return (active[0] ?? hits[0]) ?? null;
}

async function getJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (res.status === 404) return null; // a record with no reported parent answers 404
  if (!res.ok) throw new Error(`GLEIF HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function lookupOwnership(typedName: string): Promise<PartyOwnership | null> {
  try {
    const found = await getJson<{ data?: GleifRecord[] }>(`${BASE}?filter%5Bentity.legalName%5D=${encodeURIComponent(typedName.trim())}&page%5Bsize%5D=10`);
    const record = pickExact(typedName, found?.data ?? []);
    const entity = toParty(record);
    if (!record || !entity) return null;
    const [direct, ultimate] = await Promise.all([
      getJson<{ data?: GleifRecord }>(`${BASE}/${record.id}/direct-parent`).catch(() => null),
      getJson<{ data?: GleifRecord }>(`${BASE}/${record.id}/ultimate-parent`).catch(() => null),
    ]);
    const direct_parent = toParty(direct?.data);
    const ultimate_parent = toParty(ultimate?.data);
    if (!direct_parent && !ultimate_parent) return { entity, direct_parent: null, ultimate_parent: null, source_url: `https://search.gleif.org/#/record/${record.id}` };
    return { entity, direct_parent, ultimate_parent, source_url: `https://search.gleif.org/#/record/${record.id}` };
  } catch {
    return null;
  }
}
