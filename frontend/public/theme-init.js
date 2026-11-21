// Sets the theme before any CSS paints, so there's no flash of the wrong
// theme -- a previously-saved explicit choice wins, otherwise light (the
// site's default look; the OS preference is deliberately not consulted). See frontend/src/lib/theme.ts, which the
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
    var theme = saved === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    // The browser bar follows the site's own theme, not the OS setting (see index.html: no static theme-color tags).
    var meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = theme === 'dark' ? '#0c0d10' : '#ffffff';
    document.head.appendChild(meta);
    // A visitor who paused motion keeps it paused (see src/lib/motion.ts).
    if (localStorage.getItem('motion') === 'paused') document.documentElement.setAttribute('data-motion', 'paused');
  } catch {}
})();
