// Accountless theme persistence -- localStorage only, same philosophy as
// pulsePrefs.ts's URL-based preference sharing, no login required. The
// initial theme (system preference, or a previously-saved explicit choice)
// is applied by a small inline script in index.html's <head>, before this
// module or React even loads, so there's no flash of the wrong theme on
// first paint. This module is what the in-page toggle button reads and
// writes after that.

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

// Fired whenever the applied theme changes, for the one component that can't
// just rely on CSS custom properties re-cascading on its own: PulseGlobe's
// wireframe/dot colors are drawn on a <canvas>, which has no idea a CSS
// variable changed underneath it and needs an explicit nudge to redraw.
export const THEME_CHANGE_EVENT = 'aex-theme-change';

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private browsing / blocked storage -- the toggle still works for this
    // page view via applyTheme(), it just won't persist across visits.
  }
}

export function getSystemTheme(): Theme {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** The theme actually applied to the page right now, read from the
 * `data-theme` attribute the inline script (or a previous call to
 * setTheme()) already set on <html>. */
export function getCurrentTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
  window.dispatchEvent(new CustomEvent<Theme>(THEME_CHANGE_EVENT, { detail: theme }));
}

/** Sets an explicit theme choice and persists it -- once a visitor has
 * toggled, their choice sticks across visits regardless of a later system
 * preference change, matching how most sites' theme toggles behave. */
export function setTheme(theme: Theme): void {
  applyTheme(theme);
  safeSetItem(STORAGE_KEY, theme);
}
