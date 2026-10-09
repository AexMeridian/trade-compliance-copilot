// Placeholder rows shown while data loads, so the page keeps its shape instead of jumping when numbers
// arrive. Decorative (hidden from assistive tech); a visually hidden "Loading" message is announced instead.
export function Skeleton({ rows = 4, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={className} role="status">
      <span className="sr-only">Loading</span>
      <div aria-hidden="true" className="flex flex-col gap-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="skeleton h-4" style={{ width: `${92 - ((i * 13) % 40)}%` }} />
        ))}
      </div>
    </div>
  );
}
