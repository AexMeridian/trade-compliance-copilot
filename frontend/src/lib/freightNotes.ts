// Rough, static reference notes on ocean/air transit for the major U.S.
// trading partners this app already tracks tariff/export-control data for --
// NOT a live logistics quote (no carrier API is wired up, and none was
// scoped for this app). Ranges are general industry rules of thumb for
// standard commercial routings to major U.S. ports, not a specific lane,
// carrier or season -- a procurement reader should treat these as "is this
// lane fundamentally a 2-week hop or a 5-week ocean crossing," not as a
// shippable transit date. Re-verify by hand if these ever look stale; there
// is no automated refresh for this file.
export interface FreightNote {
  mode: 'Ocean' | 'Ocean or air' | 'Land (truck/rail)';
  transitRange: string;
  note: string;
  // true for a regional generalization (REGION_FREIGHT_NOTES below), false/
  // absent for a real country-specific entry (FREIGHT_NOTES) -- the one
  // piece of this object the UI needs to word the disclosure correctly.
  fromRegion?: boolean;
}

export const FREIGHT_NOTES: Record<string, FreightNote> = {
  CN: { mode: 'Ocean', transitRange: '20-35 days', note: 'To U.S. West Coast ports; add 1-2 weeks for East Coast via all-water or West Coast plus rail.' },
  VN: { mode: 'Ocean', transitRange: '25-35 days', note: 'To U.S. West Coast ports; a common China-alternative sourcing lane, generally similar transit to southern China.' },
  IN: { mode: 'Ocean', transitRange: '30-40 days', note: 'To U.S. East Coast via the Suez or Cape routing; West Coast via trans-Pacific is longer and less common.' },
  KR: { mode: 'Ocean', transitRange: '12-18 days', note: 'To U.S. West Coast ports.' },
  JP: { mode: 'Ocean', transitRange: '12-18 days', note: 'To U.S. West Coast ports.' },
  TW: { mode: 'Ocean', transitRange: '14-20 days', note: 'To U.S. West Coast ports.' },
  DE: { mode: 'Ocean', transitRange: '10-16 days', note: 'To U.S. East Coast ports.' },
  GB: { mode: 'Ocean', transitRange: '8-14 days', note: 'To U.S. East Coast ports.' },
  MX: { mode: 'Land (truck/rail)', transitRange: '1-5 days', note: 'Cross-border truck or rail, depending on origin region and border-crossing congestion.' },
  CA: { mode: 'Land (truck/rail)', transitRange: '1-5 days', note: 'Cross-border truck or rail, depending on origin region and border-crossing congestion.' },
};

// A coarser fallback for the ~160 countries without their own entry above,
// keyed on the exact World Bank region strings migration 0022 seeds into
// country_snapshot.region -- so a country with no dedicated lane still gets
// a real, honest (if wide) ocean-transit range instead of nothing. These are
// deliberately wider ranges than the country-specific rows, since a whole
// World Bank region spans very different real distances/routings -- every
// one is marked `fromRegion: true` so the UI discloses it as a regional
// generalization, not a country-specific fact the way the rows above are.
export const REGION_FREIGHT_NOTES: Record<string, FreightNote> = {
  'East Asia & Pacific': {
    mode: 'Ocean',
    transitRange: '14-35 days',
    note: 'To U.S. West Coast ports; wide range because this region spans both nearby (Japan, Korea) and far (Southeast Asia, Pacific islands) origins.',
    fromRegion: true,
  },
  'Europe & Central Asia': {
    mode: 'Ocean',
    transitRange: '10-20 days',
    note: 'To U.S. East Coast ports; Central Asian origins with no direct sea access typically route overland to a European port first, adding time.',
    fromRegion: true,
  },
  'Latin America & Caribbean': {
    mode: 'Ocean',
    transitRange: '5-20 days',
    note: 'To U.S. Gulf or East Coast ports; wide range because this region spans both nearby Caribbean/Central American and farther South American origins.',
    fromRegion: true,
  },
  'Middle East, North Africa, Afghanistan & Pakistan': {
    mode: 'Ocean',
    transitRange: '25-40 days',
    note: 'To U.S. East Coast ports, typically via the Suez Canal.',
    fromRegion: true,
  },
  'North America': {
    mode: 'Land (truck/rail)',
    transitRange: '1-5 days',
    note: 'Cross-border truck or rail, depending on origin region and border-crossing congestion.',
    fromRegion: true,
  },
  'South Asia': {
    mode: 'Ocean',
    transitRange: '30-40 days',
    note: 'To U.S. East Coast via the Suez or Cape routing; West Coast via trans-Pacific is longer and less common.',
    fromRegion: true,
  },
  'Sub-Saharan Africa': {
    mode: 'Ocean',
    transitRange: '30-45 days',
    note: 'To U.S. East Coast ports, typically via transshipment through a European or Mediterranean hub port.',
    fromRegion: true,
  },
};

export function freightNoteFor(countryCode: string, region?: string | null): FreightNote | null {
  return FREIGHT_NOTES[countryCode] ?? (region ? (REGION_FREIGHT_NOTES[region] ?? null) : null);
}
