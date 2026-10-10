import { Component, type ErrorInfo, type ReactNode } from 'react';
import { SITE } from '../lib/site';

// Without this, any error thrown while rendering leaves a completely blank page. It shows what happened and
// how to recover instead. A failed download of a page chunk (typical right after a new release, when an old
// tab asks for a file that no longer exists) reloads once automatically, since that fixes itself.
const STALE_CHUNK = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i;
const RELOAD_FLAG = 'aex:chunk-reloaded';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
    if (STALE_CHUNK.test(error.message)) {
      try {
        if (!sessionStorage.getItem(RELOAD_FLAG)) {
          sessionStorage.setItem(RELOAD_FLAG, '1');
          window.location.reload();
        }
      } catch {
        /* storage blocked: show the message below */
      }
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const report = `mailto:${SITE.contactEmail}?subject=${encodeURIComponent('Page failed to load')}&body=${encodeURIComponent(
      `Page: ${window.location.href}\nBrowser: ${navigator.userAgent}\nError: ${error.message}\n`
    )}`;
    return (
      <main className="mx-auto max-w-xl px-4 py-24 text-ink">
        <h1 className="display text-3xl">This page didn't load</h1>
        <p className="mt-3 text-ink-muted">
          Something went wrong while showing this page. Reloading usually fixes it. If it keeps happening, clearing this site's data in your browser settings may help.
        </p>
        <p className="mt-3 break-words text-sm text-ink-faint">Details: {error.message}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
            Reload the page
          </button>
          {SITE.contactEmail && (
            <a className="btn" href={report}>
              Report this
            </a>
          )}
        </div>
      </main>
    );
  }
}
