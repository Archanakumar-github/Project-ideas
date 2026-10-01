import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

// Set BASE_PATH when hosting under a sub-path (e.g. GitHub Pages: BASE_PATH=/Project-ideas/).
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Hand-written service worker (src/sw.ts) and manifest (public/manifest.json).
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      manifest: false,
      injectManifest: {
        // The whole app (every lazy chunk included) is precached so it launches with no network.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json,md}'],
        globIgnores: ['splash/**'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      devOptions: {
        enabled: false,
        type: 'module',
      },
    }),
  ],
  build: {
    target: ['es2022', 'safari15'],
    sourcemap: false,
  },
})
