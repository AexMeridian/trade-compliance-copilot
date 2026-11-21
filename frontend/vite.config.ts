import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import { execSync } from 'node:child_process'

// The short git commit this build was made from, shown in the footer so a figure can be cited against a
// specific version of the site. Falls back to 'dev' where git is unavailable.
const BUILD = (() => {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'dev'
  }
})()

// The UTC date of this build, shown in the footer in plain words (the commit hash stays in __BUILD__ for anything that needs it).
const BUILD_DATE = new Date().toISOString().slice(0, 10);

// Preloads the faces the first screen needs (body and headings) so the browser asks for them alongside the CSS instead of after it
// has been parsed. Fontsource hashes the file names, so the links are written from the finished bundle.
const ABOVE_THE_FOLD_FONTS = ['ibm-plex-sans-latin-400-normal', 'ibm-plex-sans-latin-600-normal', 'ibm-plex-serif-latin-600-normal', 'ibm-plex-serif-latin-700-normal'];
const preloadFonts = (): Plugin => ({
  name: 'preload-above-the-fold-fonts',
  transformIndexHtml: {
    order: 'post',
    handler(_html, ctx) {
      const files = Object.keys(ctx.bundle ?? {});
      return ABOVE_THE_FOLD_FONTS.flatMap((stem) => {
        const file = files.find((f) => f.includes(stem) && f.endsWith('.woff2'));
        return file ? [{ tag: 'link', injectTo: 'head-prepend' as const, attrs: { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: '', href: `/${file}` } }] : [];
      });
    },
  },
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), preloadFonts()],
  define: { __BUILD__: JSON.stringify(BUILD), __BUILD_DATE__: JSON.stringify(BUILD_DATE) },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
  },
})
