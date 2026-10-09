import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __BUILD__: JSON.stringify(BUILD) },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
  },
})
