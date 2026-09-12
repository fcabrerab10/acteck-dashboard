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
          // iceberg-js y tslib son dependencias de @supabase/* (storage-js / auth-js):
          // sin esta línea caían en 'vendor-base' y viajaban en el arranque.
          if (id.includes('@supabase') || id.includes('/iceberg-js/') || id.includes('/tslib/')) return 'vendor-supabase';
          if (id.includes('xlsx')) return 'vendor-xlsx';
          // Recharts 3 arrastra redux + immer + reselect + es-toolkit + decimal.js-light…
          // (~90 KB · 30 KB gz). Antes caían en 'vendor', que el entry importa por
          // workbox-window, así que TODA la maquinaria de las gráficas se descargaba
          // en el arranque aunque no hubiera ninguna gráfica en pantalla.
          if (
            id.includes('recharts') || id.includes('/d3-') || id.includes('victory-vendor') ||
            id.includes('@reduxjs/') || id.includes('/react-redux/') || id.includes('/redux/') ||
            id.includes('/redux-thunk/') || id.includes('/reselect/') || id.includes('/immer/') ||
            id.includes('/decimal.js-light/') || id.includes('/es-toolkit/') ||
            id.includes('/eventemitter3/') || id.includes('/internmap/') ||
            id.includes('/tiny-invariant/') || id.includes('/clsx/') ||
            id.includes('@standard-schema/') || id.includes('/use-sync-external-store/')
          ) return 'vendor-recharts';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (
            id.includes('/react/') || id.includes('/react-dom/') ||
            id.includes('/scheduler/') || id.includes('/react-is/')
          ) return 'vendor-react';
          // Resto (workbox-window). Nombre explícito para poder precachearlo por glob.
          return 'vendor-base';
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
        // ── Precache = SÓLO el cascarón (2026-09-12) ────────────────────────────
        // Antes el precache eran 155 entradas / 4.9 MB: la app entera (las ~130
        // pantallas lazy, recharts, xlsx, el mapa de México, uploads.html…) se
        // descargaba en la PRIMERA visita antes de que el usuario tocara nada.
        // Ahora se precachea el cascarón que pinta la primera pantalla y el resto
        // entra por runtimeCaching (CacheFirst con hash en el nombre → seguro).
        globPatterns: [
          'index.html',
          'manifest.webmanifest',
          'favicon.svg',
          'apple-touch-icon.png',
          'pwa/*.png',
          'assets/index-*.css',
          'assets/index-*.js',
          'assets/vendor-react-*.js',
          'assets/vendor-supabase-*.js',
          'assets/vendor-query-*.js',
          'assets/vendor-icons-*.js',
          'assets/vendor-base-*.js',
        ],
        // uploads.html DEBE venir siempre de red porque contiene los parsers Excel
        // que se actualizan seguido; si el SW lo cachea se rompe silenciosamente la
        // carga del ERP. Ya no entra por globPatterns, pero se deja el ignore por si
        // alguien amplía los patrones.
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
          // /assets/*.js|css (chunks por pantalla, recharts, xlsx, el mapa…) →
          // CacheFirst. El nombre lleva hash de contenido, así que un archivo nunca
          // cambia bajo el mismo nombre: la primera vez cuesta red, las siguientes
          // salen del disco igual que si estuvieran precacheadas. cleanupOutdatedCaches
          // no toca este cache, por eso la expiración (60 días / 250 entradas) lo poda.
          {
            urlPattern: /\/assets\/[^/]+\.(?:js|css)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'acteck-chunks',
              expiration: { maxEntries: 250, maxAgeSeconds: 60 * 60 * 24 * 60, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Fuentes (SF Pro) → CacheFirst largo: no cambian nunca.
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'acteck-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Resto de estáticos (imágenes, svg de fondos de avatar, css sueltos) →
          // StaleWhileRevalidate: pinta al instante y se refresca por detrás.
          {
            urlPattern: ({ request, url }) =>
              url.origin === self.location.origin &&
              (request.destination === 'style' || request.destination === 'script' || request.destination === 'image'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'acteck-assets',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
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
