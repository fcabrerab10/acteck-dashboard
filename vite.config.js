import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'

// Version stamp = short git hash. Se usa como buster del cache persistido
// de React Query — al cambiar el commit, invalidamos el cache viejo.
let commitHash = 'dev'
try {
  commitHash = execSync('git rev-parse --short HEAD').toString().trim()
} catch (_) {
  // en producción (Vercel) puede no haber git — usar env de Vercel
  commitHash = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'prod'
}

export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(commitHash),
  },
  build: {
    chunkSizeWarningLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-recharts': ['recharts'],
          'vendor-xlsx': ['xlsx', 'xlsx-js-style'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-query': ['@tanstack/react-query', '@tanstack/react-query-persist-client', '@tanstack/react-query-devtools', 'idb-keyval'],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Acteck Dashboard',
        short_name: 'Acteck',
        description: 'Dashboard de administración de clientes — Acteck y Balam Rush.',
        theme_color: '#000000',
        background_color: '#F5F5F7',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Excluir chunks pesados, devtools de React Query y uploads.html del
        // precache. uploads.html DEBE venir siempre de red porque contiene los
        // parsers Excel que se actualizan seguido; si el SW lo cachea se rompe
        // silenciosamente la carga del ERP.
        globIgnores: ['**/react-query-devtools*', '**/node_modules/**', '**/uploads.html'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        navigateFallbackDenylist: [/^\/api\//, /^\/uploads\.html$/],
        // El SW nuevo toma control inmediatamente al detectarse deploy nuevo
        // (sin esperar a que se cierren todas las tabs). Combinado con
        // registerType:'autoUpdate' arriba y el listener onNeedRefresh del
        // app garantiza que el usuario nunca quede con index.html stale
        // apuntando a chunks JS que ya no existen (bug del 404 de assets).
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          // uploads.html → SIEMPRE red, JAMÁS cache. Es un HTML monolítico que
          // contiene los parsers Excel embebidos y se actualiza seguido. Si el
          // SW sirve una versión vieja los uploads llegan mal parseados a
          // Supabase (bug del inventario con no_almacen=93/4828/449102).
          {
            urlPattern: /\/uploads\.html($|\?)/,
            handler: 'NetworkOnly',
          },
          // Navegación (index.html) → SIEMPRE Network primero. Si offline,
          // fallback al cache. Esto evita servir HTML viejo con referencias
          // a bundles JS que ya no existen tras un deploy.
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'acteck-html',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Fuentes/assets estáticos → CacheFirst (los hashes son únicos
          // por build, así que si el HTML se actualiza vía NetworkFirst,
          // apunta a los hashes nuevos automáticamente).
          {
            urlPattern: ({ request }) =>
              request.destination === 'style' ||
              request.destination === 'script' ||
              request.destination === 'font' ||
              request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'acteck-assets',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          // Supabase REST → NetworkFirst con fallback a cache
          {
            urlPattern: /^https:\/\/hrhccvuhnedahznewgaj\.supabase\.co\/rest\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-rest',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Supabase auth → NO cachear
          {
            urlPattern: /^https:\/\/hrhccvuhnedahznewgaj\.supabase\.co\/auth\/.*/i,
            handler: 'NetworkOnly',
          },
          // Supabase storage/realtime → NO cachear
          {
            urlPattern: /^https:\/\/hrhccvuhnedahznewgaj\.supabase\.co\/(storage|realtime)\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        enabled: false, // solo en prod para no molestar en dev
      },
    }),
  ],
})
