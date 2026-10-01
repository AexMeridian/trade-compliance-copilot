// BIS's own published "Know Your Customer" red-flag indicators (15 CFR Part
// 732, Supplement No. 3) -- static, cited reference content, not computed
// from this case's own data. A clean automated screening result is necessary
// but not sufficient for real due diligence; these are the questions BIS
// itself says should still be asked by hand.
const RED_FLAGS: string[] = [
  'The customer or its address matches an entity on the BIS Entity List, Denied Persons List or Unverified List (checked automatically above).',
  'The customer is reluctant to offer information about the end use of the item.',
  'The product’s capabilities don’t fit the buyer’s stated line of business.',
  'The item ordered is incompatible with the technical level of the country it’s being shipped to.',
  'The customer is willing to pay cash for a high-value order when the terms of sale would normally call for financing.',
  'The customer has little or no business background, or is unfamiliar with the product’s performance characteristics.',
  'Delivery dates are vague, or the shipment routing is unusual for the product or the destination.',
  'A freight forwarder is listed as the product’s final destination.',
  'The shipping route is abnormal for the product and destination (e.g. a transshipment point with no logical connection to the stated end user).',
  'Routine installation, training or maintenance services are declined, even though they would normally be expected.',
];

export function ScreeningRedFlags() {
  return (
    <details className="card mt-3 px-4 py-3 text-sm">
      <summary className="cursor-pointer font-semibold text-ink">BIS red-flag indicators to check by hand</summary>
      <p className="mt-2 text-ink-muted">
        A clean automated match above isn't the end of due diligence. These are the Bureau of Industry and Security's own published "Know Your Customer"
        indicators (15 CFR Part 732, Supplement No. 3) -- if any apply, treat it as a reason to ask more questions before relying on a clean screening result.
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-muted">
        {RED_FLAGS.map((flag) => (
          <li key={flag}>{flag}</li>
        ))}
      </ul>
    </details>
  );
}
