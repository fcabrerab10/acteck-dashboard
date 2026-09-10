import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// Versión semántica (package.json, se edita a mano — ver CLAUDE.md → Flujo de trabajo)
// + hash corto del commit. La app los muestra en el menú de usuario y los usa como
// buster del cache persistido de React Query (src/lib/version.js).
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
let commitHash = ''
try {
  commitHash = execSync('git rev-parse --short HEAD').toString().trim()
} catch (_) {
  // en producción (Vercel) puede no haber git — usar env de Vercel
  commitHash = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || ''
}

export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
    'import.meta.env.VITE_COMMIT': JSON.stringify(commitHash),
  },
  build: {
    chunkSizeWarningLimit: 1024,
    rollupOptions: {
      output: {
        // Función en vez de objeto: la forma objeto dejaba 'vendor-react' en
        // 0 KB (React se resolvía dentro de index.js vía jsx-runtime) y con
        // React.lazy por pantalla eso duplicaría React en cada chunk.
        // Aquí clasificamos por ruta real dentro de node_modules.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@tanstack') || id.includes('idb-keyval')) return 'vendor-query';
          if (id.includes('@supabase')) return 'vendor-supabase';
          if (id.includes('xlsx')) return 'vendor-xlsx';
          if (id.includes('recharts') || id.includes('/d3-') || id.includes('victory-vendor')) return 'vendor-recharts';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (
            id.includes('/react/') || id.includes('/react-dom/') ||
            id.includes('/scheduler/') || id.includes('/react-is/')
          ) return 'vendor-react';
          return 'vendor';
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      // 'prompt': el SW nuevo queda en waiting y src/main.jsx avisa con un toast
      // ("Hay una versión nueva · Recargar"); updateSW(true) manda SKIP_WAITING y recarga.
      registerType: 'prompt',
      injectRegister: null,
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
        // Sin skipWaiting: con registerType 'prompt' el SW nuevo espera a que el
        // usuario pulse "Recargar" en el toast (main.jsx → updateSW(true) manda
        // SKIP_WAITING). clientsClaim para que, ya activado, tome todas las tabs.
        // index.html se sirve NetworkFirst (abajo), así que nunca queda un HTML
        // stale apuntando a chunks que ya no existen (bug del 404 de assets).
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
