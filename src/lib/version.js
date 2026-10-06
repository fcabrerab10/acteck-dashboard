// Versión de la app (V3). VITE_APP_VERSION viene de package.json y VITE_COMMIT del hash corto de git
// (ambos inyectados por `define` en vite.config.js). Regla en CLAUDE.md → Flujo de trabajo.
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.0.0';
export const COMMIT = import.meta.env.VITE_COMMIT || '';

// "v3.0.0 · a1b2c3d" si hay commit, si no sólo "v3.0.0".
export function versionLabel() {
  return COMMIT ? `v${APP_VERSION} · ${COMMIT}` : `v${APP_VERSION}`;
}

// Identificador del build (versión + commit): etiqueta y telemetría.
export const BUILD_ID = COMMIT ? `${APP_VERSION}+${COMMIT}` : APP_VERSION;

// Buster del cache persistido de React Query (3.89.0 · 2026-10-06). ANTES era BUILD_ID: cada deploy borraba toda la
// caché de datos del iPad/celular y todas las pestañas volvían a bajar todo («cada rato carga»). Las llaves de la
// caché ya llevan la URL con sus columnas, así que un cambio de consulta es una llave nueva por sí solo. Sólo hay que
// subir esta generación a mano si cambia la FORMA de algo cacheado sin cambiar su URL (p. ej. una vista con las
// mismas columnas pero otro significado).
export const CACHE_GEN = 'rq-2026-10-06';
