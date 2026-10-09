import { Link } from 'react-router-dom';

// Shown on the Compliance calculator and every case page. The calculator uses an AI model and a
// small curated rule set, so it is labelled Beta and says plainly what it is not.
export function BetaBanner() {
  return (
    <div role="note" className="border-b border-review/30 bg-review-soft px-4 py-2 text-[13px] leading-snug text-review">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1">
        <span className="rounded-sm border border-review px-1.5 py-px text-[11px] font-bold tracking-wide">BETA</span>
        <span>
          This tool uses an AI model and a limited rule set, and can be wrong. It is not legal or customs advice and does not replace OFAC's own{' '}
          <a href="https://sanctionssearch.ofac.treas.gov/" target="_blank" rel="noreferrer" className="font-semibold underline">
            Sanctions List Search
          </a>{' '}
          or a licensed broker. Please do not enter personal or confidential information: cases are deleted after 30 days.{' '}
          <Link to="/methodology#coverage" className="font-semibold underline">
            What it covers
          </Link>
          .
        </span>
      </div>
    </div>
  );
}
