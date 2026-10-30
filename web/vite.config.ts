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
      includeAssets: ['pin-icon.svg', 'pin-apple-touch-icon.png', 'pin-favicon-48.png', 'favicon.ico'],
      manifest: {
        name: 'Babi Life',
        short_name: 'Babi Life',
        description: "Ta vie. Ton quartier. Ton Babi. Un jeu de vie en Côte d'Ivoire, à l'heure d'Abidjan.",
        lang: 'fr',
        dir: 'ltr',
        // The game for testers, the wish list for everyone else (App.tsx sends them there).
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        // The phone's own splash at launch: the loading screen's cream (components/Splash.tsx).
        background_color: '#fff4e8',
        theme_color: '#0f1230',
        categories: ['games', 'entertainment'],
        icons: [
          { src: 'pin-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pin-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pin-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Not the pages themselves: they come from the network when online
        // (below), so a page never points at program files a newer version
        // replaced.
        globPatterns: ['**/*.{js,css,svg,png,woff2}'],
        // Not downloaded ahead on the first visit (that's megabytes on a phone
        // plan): the map (1.9 MB), the screen effects, and fonts for
        // alphabets the game never shows. They're kept once used (see
        // runtimeCaching). Nor the English words (lang-en: only for who plays in English).
        globIgnores: ['**/MapboxMap-*', '**/lang-*', '**/effects-*', '**/*-{devanagari,cyrillic,cyrillic-ext,greek,vietnamese}-*.woff2'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: null,
        // The notifications' handlers (public/push-sw.js).
        importScripts: ['push-sw.js'],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          // The pages: from the network, the last copy only when offline.
          { urlPattern: ({ request }) => request.mode === 'navigate', handler: 'NetworkFirst', options: { cacheName: 'pages', networkTimeoutSeconds: 5, expiration: { maxEntries: 10 } } },
          // Hashed file names never change: once fetched, kept.
          { urlPattern: /\/assets\/.*\.(js|css|woff2)$/, handler: 'CacheFirst', options: { cacheName: 'assets', expiration: { maxEntries: 80 } } },
        ],
      },
    }),
  ],
  // mapbox-gl is big but only loaded when a token is set.
  build: { chunkSizeWarningLimit: 2000 },
})
