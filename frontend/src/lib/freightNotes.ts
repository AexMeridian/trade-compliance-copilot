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

export function freightNoteFor(countryCode: string): FreightNote | null {
  return FREIGHT_NOTES[countryCode] ?? null;
}
