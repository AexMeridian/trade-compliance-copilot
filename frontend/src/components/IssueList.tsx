// Open issues arrive as flat strings prefixed with the module that raised them
// ("Origin: ...", "Determination: ..."). Group them by module, most
// consequential first, and split each into a short title and its detail so a
// reviewer can triage by scanning titles.

const GROUPS = ['Screening', 'Determination', 'Classification', 'Origin'] as const;
type Group = (typeof GROUPS)[number] | 'Other';

export interface ParsedIssue {
  group: Group;
  title: string | null;
  body: string;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function parseIssue(issue: string): ParsedIssue {
  const prefixed = issue.match(/^(Screening|Determination|Classification|Origin)\s*(?::|--|—)\s*(.*)$/s);
  // "Classification is ambiguous between ..." names its module without a colon;
  // group it, but keep the full sentence so it still reads naturally.
  const bare = issue.match(/^(Screening|Determination|Classification|Origin)\b/);
  const group: Group = prefixed ? (prefixed[1] as Group) : bare ? (bare[1] as Group) : 'Other';
  const rest = (prefixed ? prefixed[2] : issue).trim();
  // "Short title: longer explanation" -- only when the title is genuinely short.
  const t = rest.match(/^(.{6,90}?):\s+(.*)$/s);
  if (t && !/^https?$/i.test(t[1])) return { group, title: cap(t[1]), body: cap(t[2]) };
  return { group, title: null, body: cap(rest) };
}

const parse = parseIssue;

export function IssueList({ issues }: { issues: string[] }) {
  const parsed = issues.map(parse);
  const order: Group[] = [...GROUPS, 'Other'];
  return (
    <div className="mt-3 space-y-5">
      {order.map((g) => {
        const items = parsed.filter((p) => p.group === g);
        if (items.length === 0) return null;
        return (
          <div key={g}>
            <h3 className="flex items-baseline gap-2 text-sm font-semibold text-ink">
              {g === 'Other' ? 'General' : g}
              <span className="text-xs font-normal tabular-nums text-ink-faint">{items.length}</span>
            </h3>
            <ul className="mt-1.5 divide-y divide-hairline border-y border-hairline">
              {items.map((it, i) => (
                <li key={i} className="py-2.5">
                  {it.title && <p className="text-sm font-medium text-ink">{it.title}</p>}
                  <p className={`max-w-prose text-sm leading-relaxed text-ink-muted ${it.title ? 'mt-0.5' : ''}`}>{it.body}</p>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
