import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // VITE_ variables, and the commit Vercel builds from (shown as the version).
  envPrefix: ['VITE_', 'VERCEL_GIT_COMMIT_SHA'],
  plugins: [
    react(),
    tailwindcss(),
    // Installable app: the shell (code, fonts, icons) is cached so it opens
    // instantly and offline; game data always comes live from the API.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'favicon-48.png'],
      manifest: {
        name: 'Babi Life',
        short_name: 'Babi Life',
        description: "Ta vie. Ton quartier. Ton Babi. Une vie à la Sims en Côte d'Ivoire.",
        lang: 'fr',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f1230',
        theme_color: '#0f1230',
        categories: ['games', 'entertainment'],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // The map chunk is large; keep it so the map opens offline too.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        // The two body models (~3 MB each) are kept after the first visit.
        runtimeCaching: [{ urlPattern: /\/models\/.*\.glb$/, handler: 'StaleWhileRevalidate', options: { cacheName: 'models' } }],
      },
    }),
  ],
  // mapbox-gl is big but only loaded when a token is set.
  build: { chunkSizeWarningLimit: 2000 },
})
