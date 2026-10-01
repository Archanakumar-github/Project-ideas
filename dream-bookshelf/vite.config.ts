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
      // We write our own service worker (src/sw.ts) and our own manifest (public/manifest.json)
      // so both stay readable, hand-tuned deliverables rather than generated black boxes.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      manifest: false,
      injectManifest: {
        // Precache the app shell, fonts and icons. Splash screens are fetched by iOS only once
        // at install time, so they are left out of the precache to keep updates small.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,json}'],
        globIgnores: ['splash/**'],
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
