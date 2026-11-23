// Cost of sending money to a country: the World Bank's Remittance Prices Worldwide (RPW) database, read through the World Bank's open
// Indicators API (indicator SI.RMT.COST.IB.ZS, licence CC BY 4.0 per the World Bank Data Catalog). The RPW site itself sits behind a
// bot challenge and is not fetched. This indicator is the average, over every provider and every sending country in RPW, of the total
// cost of sending USD 200 TO a country, as a percentage of the amount sent. It is NOT a U.S.-only corridor figure; the U.S. outbound
// average (SI.RMT.COST.OB.ZS) is shown beside it for context.

export const REMITTANCE_INBOUND_URL = 'https://api.worldbank.org/v2/country/all/indicator/SI.RMT.COST.IB.ZS?format=json&mrv=1&per_page=400';
export const REMITTANCE_US_OUTBOUND_URL = 'https://api.worldbank.org/v2/country/US/indicator/SI.RMT.COST.OB.ZS?format=json&mrv=1';
export const REMITTANCE_SOURCE = 'World Bank, Remittance Prices Worldwide (via the World Development Indicators API), CC BY 4.0';
export const REMITTANCE_SOURCE_URL = 'https://remittanceprices.worldbank.org';

export interface RemittanceCost {
  /** Average total cost of sending USD 200, percent of the amount sent. */
  pct: number;
  /** Data year (annual average of the quarterly RPW rounds). */
  year: number;
}

/** Parse a World Bank Indicators API response into { ISO2 -> latest cost }. Rows without a value, or that are not countries, are skipped. */
export function parseWbIndicator(json: unknown): Map<string, RemittanceCost> {
  const out = new Map<string, RemittanceCost>();
  const rows = Array.isArray(json) && Array.isArray(json[1]) ? (json[1] as unknown[]) : [];
  for (const r of rows) {
    const row = r as { country?: { id?: string }; countryiso3code?: string; date?: string; value?: number | null };
    const iso = row.country?.id;
    const year = Number(row.date);
    // Aggregates (World, regions, income groups) have no ISO3 code or a non-country id.
    if (!iso || !/^[A-Z]{2}$/.test(iso) || !row.countryiso3code || !Number.isInteger(year)) continue;
    if (typeof row.value !== 'number' || !Number.isFinite(row.value) || row.value < 0 || row.value > 100) continue;
    const prev = out.get(iso);
    if (!prev || year > prev.year) out.set(iso, { pct: Math.round(row.value * 100) / 100, year });
  }
  return out;
}

/** The sentence the travelers box shows. */
export function remittanceSentence(name: string, c: RemittanceCost): string {
  return `Sending $200 to ${name} costs about ${c.pct.toFixed(1)}% on average (${c.year}), roughly $${((c.pct / 100) * 200).toFixed(2)}.`;
}
