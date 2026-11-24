// The Dashboard's "Trade and tariffs" and "Power and security" sections, built from what the other endpoints already return.
// Pure functions (no database, network or model); a missing source drops its panel. Country names are added by the page from codes.

type Pt = [string, number];

export interface PowerInputs {
  now: Date;
  summary: { last30: number; prior30: number; trendPct: number | null; leadingTag?: string; leadingTagShare?: number; countryTariffs?: { forcedLabor: { country: string; ratePct: number }[]; capped?: unknown[]; extra?: unknown[] } } | null;
  tempo: { months: { month: string; count: number }[] } | null;
  csms: { asOf?: string; items: { title: string; published: string; url: string; programs: string[] }[] } | null;
  measures: { overlays: { program: string; min_rate_pct: number; max_rate_pct: number; line_count: number; country_count: number; effective_date: string }[] } | null;
  nato: { countries: Record<string, { points: Pt[]; asOf: string }> } | null;
  sanctionCounts: { total: number; totals: { sdn: number; csl: number; un: number; uk: number }; countries: { country: string; count: number }[]; lists: { label: string; state: string; age_days: number | null; has_rows: boolean }[] } | null;
  wro: { total: number; rows: { effective_date: string; country_code: string; merchandise: string; entity: string }[] } | null;
  opinion: { surveys: { subject: string; year: number; publishedMedian: number; countriesInMedian: number; title?: string }[]; africa?: { medianPositive?: { us: number; cn: number } } } | null;
  power: { indicators: { id: string; label: string; unit: string; latestYear: number | null; standings: Record<string, { value: number; rank: number; of: number } | undefined>; distribution: [string, number][] }[] } | null;
}

export interface PowerPayload {
  asOf: string;
  notices: { months: { month: string; count: number }[]; last30: number; trendPct: number | null; leadingTag: string | null; leadingTagShare: number | null } | null;
  tariffs: { groups: { ratePct: number; countries: string[] }[]; total: number; cappedCount: number } | null;
  csms: { items: { title: string; published: string; url: string; programs: string[] }[]; asOf: string | null } | null;
  measures: { program: string; label: string; minPct: number; maxPct: number; lines: number; countries: number; since: string }[];
  military: { year: number; top: { cc: string; usd: number }[]; worldUsd: number; usPctGdp: number | null; cnPctGdp: number | null } | null;
  nato: { rows: { cc: string; pct: number; year: string }[]; metTarget: number; asOf: string | null } | null;
  sanctions: { total: number; totals: { sdn: number; csl: number; un: number; uk: number }; top: { cc: string; count: number }[]; lists: { label: string; stale: boolean; ageDays: number | null }[] } | null;
  forcedLabor: { total: number; recent: { date: string; country: string; merchandise: string; entity: string }[] } | null;
  opinion: { year: number; us: number; cn: number; countries: number; africa: { us: number; cn: number } | null } | null;
  usChina: { id: string; label: string; unit: string; year: number | null; us: number | null; cn: number | null; usRank: number | null; cnRank: number | null; of: number | null }[];
}

const PROGRAM_LABEL: Record<string, string> = {
  sec232_steel: 'Section 232: steel',
  sec232_aluminum: 'Section 232: aluminum',
  sec232_copper: 'Section 232: copper',
  sec232_autos: 'Section 232: cars and trucks',
  sec232_auto_parts: 'Section 232: car parts',
  sec232_metals_country_cap: 'Section 232: steel, aluminum and copper, country caps',
  sec301_forced_labor: 'Section 301: forced-labor action (60 economies)',
  sec301_china: 'Section 301: China (2018 onward)',
  sec338_canada: 'Section 338: Canada',
};
export function programLabel(p: string): string {
  if (PROGRAM_LABEL[p]) return PROGRAM_LABEL[p];
  const t = p.replace(/^sec(\d+)_?/, 'Section $1: ').replace(/_/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const US_CHINA_ROWS: [string, string][] = [
  ['gdp_usd', 'Size of the economy'],
  ['population', 'People'],
  ['military_usd', 'Military spending'],
  ['military_gdp', 'Military spending, share of the economy'],
  ['trade_gdp', 'Trade as a share of the economy'],
  ['hightech_exports_usd', 'High-technology exports'],
  ['fdi_inflows', 'Foreign investment received'],
];

export function buildPower(i: PowerInputs): PowerPayload {
  const ind = (id: string) => i.power?.indicators.find((x) => x.id === id) ?? null;

  const notices: PowerPayload['notices'] = i.tempo
    ? { months: i.tempo.months.slice(-12), last30: i.summary?.last30 ?? 0, trendPct: i.summary?.trendPct ?? null, leadingTag: i.summary?.leadingTag ?? null, leadingTagShare: i.summary?.leadingTagShare ?? null }
    : null;

  let tariffs: PowerPayload['tariffs'] = null;
  const forced = i.summary?.countryTariffs?.forcedLabor;
  if (forced?.length) {
    const byRate = new Map<number, string[]>();
    for (const f of forced) byRate.set(f.ratePct, [...(byRate.get(f.ratePct) ?? []), f.country]);
    tariffs = { groups: [...byRate].map(([ratePct, countries]) => ({ ratePct, countries: countries.sort() })).sort((a, b) => b.ratePct - a.ratePct), total: forced.length, cappedCount: i.summary?.countryTariffs?.capped?.length ?? 0 };
  }

  const csms = i.csms?.items?.length ? { items: i.csms.items.slice(0, 6), asOf: i.csms.asOf?.slice(0, 10) ?? null } : null;

  // The table holds many rows per program (for example one per product list); show one line per program.
  const byProgram = new Map<string, { minPct: number; maxPct: number; lines: number; countries: number; since: string }>();
  for (const o of i.measures?.overlays ?? []) {
    if (o.line_count <= 0 || o.program.endsWith('_coverage')) continue;
    const prev = byProgram.get(o.program);
    byProgram.set(o.program, {
      minPct: Math.min(prev?.minPct ?? Infinity, o.min_rate_pct),
      maxPct: Math.max(prev?.maxPct ?? 0, o.max_rate_pct),
      lines: (prev?.lines ?? 0) + o.line_count,
      countries: Math.max(prev?.countries ?? 0, o.country_count),
      since: prev && prev.since < o.effective_date ? prev.since : o.effective_date,
    });
  }
  const measures = [...byProgram]
    .map(([program, v]) => ({ program, label: programLabel(program), ...v }))
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 10);

  let military: PowerPayload['military'] = null;
  const mil = ind('military_usd');
  if (mil && mil.distribution.length) {
    const top = [...mil.distribution].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([cc, usd]) => ({ cc, usd }));
    const share = ind('military_gdp');
    military = { year: mil.latestYear ?? 0, top, worldUsd: mil.distribution.reduce((s, [, v]) => s + v, 0), usPctGdp: share?.standings.US?.value ?? null, cnPctGdp: share?.standings.CN?.value ?? null };
  }

  let nato: PowerPayload['nato'] = null;
  if (i.nato) {
    const rows = Object.entries(i.nato.countries)
      .map(([cc, v]) => {
        const last = v.points[v.points.length - 1];
        return last ? { cc, pct: last[1], year: last[0].slice(0, 4) } : null;
      })
      .filter((r): r is { cc: string; pct: number; year: string } => !!r)
      .sort((a, b) => b.pct - a.pct);
    if (rows.length) nato = { rows, metTarget: rows.filter((r) => r.pct >= 2).length, asOf: Object.values(i.nato.countries)[0]?.asOf ?? null };
  }

  let sanctions: PowerPayload['sanctions'] = null;
  if (i.sanctionCounts) {
    sanctions = {
      total: i.sanctionCounts.total,
      totals: i.sanctionCounts.totals,
      top: [...i.sanctionCounts.countries].sort((a, b) => b.count - a.count).slice(0, 10).map((c) => ({ cc: c.country, count: c.count })),
      lists: i.sanctionCounts.lists.map((l) => ({ label: l.label, stale: !l.has_rows || l.state !== 'ok', ageDays: l.age_days })),
    };
  }

  const forcedLabor = i.wro?.rows?.length
    ? { total: i.wro.total, recent: [...i.wro.rows].sort((a, b) => b.effective_date.localeCompare(a.effective_date)).slice(0, 5).map((r) => ({ date: r.effective_date, country: r.country_code, merchandise: r.merchandise, entity: r.entity })) }
    : null;

  let opinion: PowerPayload['opinion'] = null;
  if (i.opinion?.surveys?.length) {
    const year = Math.max(...i.opinion.surveys.map((s) => s.year));
    const us = i.opinion.surveys.find((s) => s.subject === 'US' && s.year === year);
    const cn = i.opinion.surveys.find((s) => s.subject === 'CN' && s.year === year);
    if (us && cn) opinion = { year, us: us.publishedMedian, cn: cn.publishedMedian, countries: us.countriesInMedian, africa: i.opinion.africa?.medianPositive ? { us: i.opinion.africa.medianPositive.us, cn: i.opinion.africa.medianPositive.cn } : null };
  }

  const usChina = US_CHINA_ROWS.map(([id, label]) => {
    const x = ind(id);
    return x ? { id, label, unit: x.unit, year: x.latestYear, us: x.standings.US?.value ?? null, cn: x.standings.CN?.value ?? null, usRank: x.standings.US?.rank ?? null, cnRank: x.standings.CN?.rank ?? null, of: x.standings.US?.of ?? x.standings.CN?.of ?? null } : null;
  }).filter((r): r is NonNullable<typeof r> => !!r);

  return { asOf: i.now.toISOString(), notices, tariffs, csms, measures, military, nato, sanctions, forcedLabor, opinion, usChina };
}
