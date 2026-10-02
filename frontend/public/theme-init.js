// Sets the theme before any CSS paints, so there's no flash of the wrong
// theme -- a previously-saved explicit choice wins, otherwise the OS/
// browser's prefers-color-scheme. See frontend/src/lib/theme.ts, which the
// in-page toggle button uses after this.
//
// This has to be an external file, not an inline <script> in index.html's
// <head> -- this site's CSP (frontend/public/_headers) is script-src 'self'
// with no 'unsafe-inline', so an inline script is silently blocked by the
// browser (confirmed live: it never ran, meaning the theme never restored on
// a fresh page load, only after the in-page toggle was clicked that
// session). A same-origin external file is 'self' and allowed.
(function () {
  try {
    var saved = localStorage.getItem('theme');
    var theme = saved === 'light' || saved === 'dark' ? saved : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
  } catch (e) {}
})();
