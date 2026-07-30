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
        // Excluir chunks pesados y el devtools de React Query del precache
        globIgnores: ['**/react-query-devtools*', '**/node_modules/**'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        navigateFallbackDenylist: [/^\/api\//, /^\/uploads\.html$/],
        runtimeCaching: [
          // Fuentes/assets estáticos → CacheFirst
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
