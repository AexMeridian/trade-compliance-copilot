import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { searchSite, type SearchEntry } from '../lib/siteSearch';

// A "jump to" search over the site's own structure -- pages, every tracked
// country, alliances and the real programs/lists this app screens against --
// not the live article-text search already on the Pulse page (which has to
// call the API). This one is pure client-side string matching over a static
// index already bundled with the app, so pressing a key here never makes a
// network request. See lib/siteSearch.ts for the index and ranking.
//
// Opens from the icon button in the header, or Cmd/Ctrl+K from anywhere --
// the listener lives here so it works regardless of which page is showing,
// since this component is mounted once in App.tsx's header.
export function SiteSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();

  const results = useMemo(() => searchSite(query), [query]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    document.body.style.overflow = 'hidden';
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      document.body.style.overflow = '';
      cancelAnimationFrame(raf);
      // Standard dialog behavior: closing (Escape, a result, or the backdrop)
      // returns focus to whatever opened it, so a keyboard/screen-reader user
      // doesn't land back at the top of the document.
      triggerRef.current?.focus();
    };
  }, [open]);

  useEffect(() => setActiveIndex(0), [query]);

  const go = (entry: SearchEntry) => {
    setOpen(false);
    // Feeds (/rss.xml) and /api/* are real server resources, not client-side
    // routes -- a router navigation there would just hit the 404 page.
    if (entry.url.startsWith('/api/') || /\.(xml|json)$/.test(entry.url)) window.location.href = entry.url;
    else navigate(entry.url);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search the site"
        title="Search (Ctrl/Cmd+K)"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-muted hover:text-ink"
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/50 px-4 pt-[12vh]" onClick={() => setOpen(false)}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Search the site"
              className="w-full max-w-lg border border-hairline bg-paper-raised shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="shrink-0 text-ink-faint"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setActiveIndex((i) => Math.max(i - 1, 0));
                    } else if (e.key === 'Enter' && results[activeIndex]) {
                      e.preventDefault();
                      go(results[activeIndex]);
                    }
                  }}
                  placeholder="Search pages, countries, programs…"
                  aria-label="Search query"
                  aria-controls="site-search-results"
                  aria-activedescendant={results[activeIndex] ? `site-search-result-${results[activeIndex].id}` : undefined}
                  className="w-full bg-transparent text-base text-ink outline-none placeholder:text-ink-faint"
                />
              </div>

              {query.trim() === '' ? (
                <p className="px-4 py-6 text-sm text-ink-faint">Try "China", "Section 301", "NATO" or "calculator".</p>
              ) : results.length === 0 ? (
                <p className="px-4 py-6 text-sm text-ink-faint">Nothing matches "{query}".</p>
              ) : (
                <ul id="site-search-results" role="listbox" className="max-h-[55vh] overflow-y-auto py-1.5">
                  {results.map((r, i) => (
                    <li key={r.id} id={`site-search-result-${r.id}`} role="option" aria-selected={i === activeIndex}>
                      <button
                        type="button"
                        onClick={() => go(r)}
                        onMouseEnter={() => setActiveIndex(i)}
                        className={`flex w-full items-start justify-between gap-3 px-4 py-2.5 text-left ${i === activeIndex ? 'bg-accent-soft' : ''}`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-ink">{r.title}</span>
                          <span className="mt-0.5 block truncate text-xs text-ink-faint">{r.description}</span>
                        </span>
                        <span className="mt-0.5 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{r.type}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-center gap-3 border-t border-hairline px-4 py-2 text-[11px] text-ink-faint">
                <span>&uarr;&darr; navigate</span>
                <span>&crarr; select</span>
                <span>esc close</span>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
