// Model-written summaries arrive as one dense paragraph. Professionals scan
// before they read, so show the first sentence as the headline and the rest
// as short bullets. Purely presentational: the text itself is never altered,
// only broken at sentence boundaries.

// Dots that do NOT end a sentence ("U.S.", "Fed. Reg.", "No. 5", "e.g.").
const ABBREVIATIONS = /\b(St|Mt|Dr|Mr|Ms|Mrs|U\.S|U\.S\.C|C\.F\.R|Fed|Reg|No|Nos|Inc|Ltd|Co|Corp|Sec|Supp|Art|vs|v|e\.g|i\.e|approx|incl|etc|cf|al)\./g;
const PLACEHOLDER = '\u0000';

export function splitSentences(text: string): string[] {
  const protectedText = text.trim().replace(ABBREVIATIONS, (m) => m.replace(/\./g, PLACEHOLDER));
  return protectedText
    .split(/(?<=[.!?])\s+(?=[A-Z0-9(‘'"“])/)
    .map((s) => s.split(PLACEHOLDER).join('.').trim())
    .filter(Boolean);
}

export function SummaryList({ text, className = '' }: { text: string | null | undefined; className?: string }) {
  if (!text) return null;
  const sentences = splitSentences(text);
  if (sentences.length <= 1) return <p className={`max-w-prose text-[15px] leading-relaxed text-ink ${className}`}>{text}</p>;
  const [lead, ...rest] = sentences;
  return (
    <div className={`max-w-prose ${className}`}>
      <p className="text-[15px] font-medium leading-relaxed text-ink">{lead}</p>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-muted marker:text-ink-faint">
        {rest.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </div>
  );
}
