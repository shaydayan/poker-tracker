import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { offlineCache } from './scripts/offline-cache.js'

// https://vite.dev/config/
// `base: './'` makes every built path relative, so the same build works at a site's root or under a sub-path.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), offlineCache()],
  server: { host: true, port: 5173 },
  test: { environment: 'node', include: ['src/**/*.test.js'] },
})
