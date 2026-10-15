import type { PartyOwnershipHint } from '../types/case';

// Ownership context under a screened party. Parents come from the party's own GLEIF registration; a parent whose name
// resembles a listed party is flagged as a prompt to look further, never as a finding.
export function OwnershipNote({ hint }: { hint: PartyOwnershipHint }) {
  if (hint.parents.length === 0) return null;
  return (
    <div className="mt-1.5 border-l-2 border-hairline-strong pl-3 text-xs text-ink-muted">
      <p>
        Registered parent{hint.parents.length === 1 ? '' : 's'} of {hint.entity.name}{' '}
        <a href={hint.source_url} target="_blank" rel="noreferrer" className="text-accent">
          (GLEIF)
        </a>
        :
      </p>
      <ul className="mt-0.5 space-y-0.5">
        {hint.parents.map((p) => (
          <li key={p.lei}>
            <span className="capitalize">{p.relation}</span> parent: <span className="text-ink">{p.name}</span>
            {p.country ? ` (${p.country})` : ''}
            {p.listed_as && (
              <span className="text-review">
                {' '}
                resembles {p.listed_as.name} on the {p.listed_as.list} list (score {p.listed_as.score.toFixed(2)}). Check this parent and the 50 percent ownership rule
                before proceeding.
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
