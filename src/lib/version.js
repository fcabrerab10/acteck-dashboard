// Versión de la app (V3). VITE_APP_VERSION viene de package.json y VITE_COMMIT del hash corto de git
// (ambos inyectados por `define` en vite.config.js). Regla en CLAUDE.md → Flujo de trabajo.
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.0.0';
export const COMMIT = import.meta.env.VITE_COMMIT || '';

// "v3.0.0 · a1b2c3d" si hay commit, si no sólo "v3.0.0".
export function versionLabel() {
  return COMMIT ? `v${APP_VERSION} · ${COMMIT}` : `v${APP_VERSION}`;
}

// Buster del cache persistido de React Query: cambia con cada build distinto.
export const BUILD_ID = COMMIT ? `${APP_VERSION}+${COMMIT}` : APP_VERSION;
