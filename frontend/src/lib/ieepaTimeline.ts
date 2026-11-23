// Timeline of the IEEPA ("reciprocal" and other emergency) tariffs. Every entry comes from an official or primary page that was fetched
// and read on VERIFIED_ON; the page behind each entry is its `sourceUrl`. Nothing here comes from a law-firm or news summary.
// Left out because no primary page could be fetched to confirm it: the 2025 Court of International Trade rulings and the Federal Circuit's
// holding (the Supreme Court docket confirms only that the Federal Circuit decided on 2025-08-29), the Court of International Trade's 2026
// refund orders and the government's appeal of them, the court's May 2026 ruling on Section 122, CBP's notice ending Section 122 collection,
// and the Federal Register text of the July 2026 Section 301 forced-labor action (it is carried in the tariff data with its own citation).

export const VERIFIED_ON = '2026-11-22';

export type IeepaStatus = 'in effect' | 'ended' | 'court' | 'refunds' | 'replacement';

export interface IeepaEvent {
  date: string; // YYYY-MM-DD
  title: string;
  authority: string;
  status: IeepaStatus;
  /** Status of this item as of VERIFIED_ON, in plain words. */
  statusNow: string;
  source: string; // who published the page
  sourceUrl: string;
  detail?: string;
}

const CBP_FAQ = 'https://www.cbp.gov/trade/programs-administration/trade-remedies/IEEPA-FAQ';
const CBP_REFUNDS = 'https://www.cbp.gov/trade/programs-administration/trade-remedies/ieepa-duty-refunds';
const CSMS_END = 'https://content.govdelivery.com/accounts/USDHSCBP/bulletins/40b11c9';
const ENDED_NOW = 'Ended: no longer collected on goods entered on or after 2026-02-24.';
const SC_DOCKET = 'https://www.supremecourt.gov/search.aspx?filename=/docket/docketfiles/html/public/25-250.html';

export const IEEPA_EVENTS: IeepaEvent[] = [
  {
    date: '2025-02-04',
    title: 'IEEPA duties on products of China and Hong Kong take effect',
    authority: 'Executive Order 14195 (IEEPA)',
    status: 'ended',
    statusNow: ENDED_NOW,
    source: 'U.S. Customs and Border Protection, IEEPA FAQ',
    sourceUrl: CBP_FAQ,
  },
  {
    date: '2025-03-04',
    title: 'IEEPA duties on products of Canada and Mexico take effect (USMCA exception from 2025-03-07)',
    authority: 'Executive Orders 14193 and 14194 (IEEPA)',
    status: 'ended',
    statusNow: ENDED_NOW,
    source: 'U.S. Customs and Border Protection, IEEPA FAQ',
    sourceUrl: CBP_FAQ,
  },
  {
    date: '2025-04-05',
    title: 'Reciprocal tariffs take effect',
    authority: 'Executive Order 14257, as amended (IEEPA)',
    status: 'ended',
    statusNow: ENDED_NOW,
    source: 'U.S. Customs and Border Protection, IEEPA FAQ',
    sourceUrl: CBP_FAQ,
    detail: 'Rates for China changed several times in April and May 2025; CBP lists the dates and heading numbers on the same page.',
  },
  {
    date: '2025-08-06',
    title: 'IEEPA duties on products of Brazil take effect',
    authority: 'Executive Order 14323, as amended (IEEPA)',
    status: 'ended',
    statusNow: ENDED_NOW,
    source: 'U.S. Customs and Border Protection, IEEPA FAQ',
    sourceUrl: CBP_FAQ,
  },
  {
    date: '2025-08-27',
    title: 'IEEPA duties on products of India take effect',
    authority: 'IEEPA (executive order number not stated on the CBP page)',
    status: 'ended',
    statusNow: ENDED_NOW,
    source: 'U.S. Customs and Border Protection, IEEPA FAQ',
    sourceUrl: CBP_FAQ,
  },
  {
    date: '2025-08-29',
    title: 'Federal Circuit decision reviewed by the Supreme Court (Nos. 2025-1812, 2025-1813)',
    authority: 'U.S. Court of Appeals for the Federal Circuit',
    status: 'court',
    statusNow: 'Reviewed by the Supreme Court, which affirmed on 2026-02-20.',
    source: 'Supreme Court docket 25-250',
    sourceUrl: SC_DOCKET,
  },
  {
    date: '2025-11-05',
    title: 'Supreme Court hears argument (Learning Resources v. Trump, No. 24-1287; Trump v. V.O.S. Selections, No. 25-250)',
    authority: 'Supreme Court of the United States',
    status: 'court',
    statusNow: 'Decided 2026-02-20.',
    source: 'Supreme Court docket 25-250',
    sourceUrl: SC_DOCKET,
  },
  {
    date: '2026-02-20',
    title: 'Supreme Court rules that IEEPA does not authorize tariffs',
    authority: 'Learning Resources, Inc. v. Trump, 607 U.S. 229 (2026)',
    status: 'court',
    statusNow: 'Final. Judgment in No. 25-250 affirmed; No. 24-1287 vacated and remanded with instructions to dismiss for lack of jurisdiction. Judgment issued 2026-03-24.',
    source: 'Supreme Court, slip opinions of the 2025 term',
    sourceUrl: 'https://www.supremecourt.gov/opinions/25pdf/607us2r12_8nj9.pdf',
    detail: 'The Court\'s summary: "The International Emergency Economic Powers Act ... does not authorize the President to impose tariffs."',
  },
  {
    date: '2026-02-20',
    title: 'Executive order "Ending Certain Tariff Actions" terminates the IEEPA duties',
    authority: 'Executive Order 14389; ends the duties under Executive Orders 14193, 14194, 14195, 14245, 14257, 14323, 14329, 14380 and 14382',
    status: 'ended',
    statusNow: 'In force. It does not affect Section 232 or Section 301 duties.',
    source: 'White House, presidential actions',
    sourceUrl: 'https://www.whitehouse.gov/presidential-actions/2026/02/ending-certain-tariff-actions/',
  },
  {
    date: '2026-02-22',
    title: 'CBP: collection of IEEPA duties ends for goods entered on or after 12:00 a.m. Eastern time on 2026-02-24',
    authority: 'CSMS # 67834313 (issued 2026-02-22, 9:57 p.m. Eastern)',
    status: 'ended',
    statusNow: 'IEEPA duties are no longer collected. The IEEPA tariff numbers are inactive in ACE from 2026-02-24.',
    source: 'U.S. Customs and Border Protection, CSMS',
    sourceUrl: CSMS_END,
  },
  {
    date: '2026-02-24',
    title: 'Temporary 10 percent import surcharge replaces the IEEPA duties for 150 days',
    authority: 'Presidential proclamation of 2026-02-20 under Section 122 of the Trade Act of 1974 (19 U.S.C. 2132); CBP CSMS # 67844987, heading 9903.03.01',
    status: 'replacement',
    statusNow: 'Its stated end date, 12:01 a.m. EDT on 2026-07-24, has passed. A CBP notice ending collection was not found, so the end is not confirmed here.',
    source: 'White House proclamation; CBP CSMS # 67844987 at content.govdelivery.com/accounts/USDHSCBP/bulletins/40b3b7b',
    sourceUrl: 'https://www.whitehouse.gov/presidential-actions/2026/02/imposing-a-temporary-import-surcharge-to-address-fundamental-international-payments-problems/',
    detail: 'Exempts articles subject to Section 232 and goods that enter duty-free under USMCA.',
  },
  {
    date: '2026-04-20',
    title: 'CBP opens CAPE, its refund tool in ACE, for IEEPA duties (phase 1: certain unliquidated entries and entries within 80 days of liquidation)',
    authority: 'CBP CSMS # 68340863',
    status: 'refunds',
    statusNow: 'Open. Later phases are listed by CBP without dates.',
    source: 'U.S. Customs and Border Protection, IEEPA duty refunds',
    sourceUrl: CBP_REFUNDS,
  },
  {
    date: '2026-06-29',
    title: 'CAPE phase 2: entries flagged for reconciliation where the reconciliation entry is not yet on file',
    authority: 'CBP CSMS # 69035485',
    status: 'refunds',
    statusNow: 'Open. Entries with a reconciliation entry already on file, drawback entries, warehouse entries, open protests and finally liquidated entries are slated for later phases.',
    source: 'U.S. Customs and Border Protection, IEEPA duty refunds',
    sourceUrl: CBP_REFUNDS,
  },
  {
    date: '2026-11-05',
    title: 'Court of International Trade posts its "IEEPA Refund Class Action Litigation" page',
    authority: 'U.S. Court of International Trade',
    status: 'court',
    statusNow: 'The page links to the litigation documents; their contents were not read here. Check the court page for orders.',
    source: 'U.S. Court of International Trade',
    sourceUrl: 'https://www.cit.uscourts.gov/news/ieepa-refund-class-action-litigation',
  },
];

export const IEEPA_REFUND_LINKS: { label: string; url: string }[] = [
  { label: 'CBP: IEEPA duty refunds and CAPE (page last changed 2026-11-02)', url: CBP_REFUNDS },
  { label: 'CBP: IEEPA frequently asked questions', url: CBP_FAQ },
  { label: 'CBP: Trade information notice on CAPE', url: 'https://www.cbp.gov/document/guidance/trade-information-notice-cape' },
  { label: 'CBP: fact sheet on CAPE refund fraud', url: 'https://www.cbp.gov/document/fact-sheets/fact-sheet-cape-refund-fraud-solicitation' },
  { label: 'Court of International Trade: IEEPA refund class action litigation', url: 'https://www.cit.uscourts.gov/news/ieepa-refund-class-action-litigation' },
];

export const IEEPA_STATUS_NOW = {
  asOf: VERIFIED_ON,
  headline: 'The IEEPA tariffs, including the "reciprocal" tariffs, ended on 2026-02-24.',
  body: "The Supreme Court held on 2026-02-20 that IEEPA does not authorize tariffs, and CBP stopped collecting the duties on goods entered on or after 2026-02-24. Section 232 and Section 301 duties were not affected. Refunds of IEEPA duties already paid are handled through CBP's CAPE tool in ACE.",
};
