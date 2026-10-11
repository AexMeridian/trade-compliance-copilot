import { Link } from 'react-router-dom';

// Where this page sits in the site, as a short trail above the title. The last item is the current page.
export function Breadcrumb({ trail }: { trail: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-[13px] text-ink-faint">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {trail.map((t, i) => {
          const last = i === trail.length - 1;
          return (
            <li key={t.label} className="flex items-center gap-2">
              {t.to && !last ? (
                <Link to={t.to} className="text-ink-muted no-underline hover:text-ink hover:underline">
                  {t.label}
                </Link>
              ) : (
                <span aria-current={last ? 'page' : undefined} className={last ? 'text-ink' : ''}>
                  {t.label}
                </span>
              )}
              {!last && <span aria-hidden="true">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
