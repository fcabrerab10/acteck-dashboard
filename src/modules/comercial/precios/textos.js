// Estrategia de Precios · constantes, formatos y texto de WhatsApp ("Compartir precio").
// Reutiliza la búsqueda sin acentos y los formatos del Sell In consolidado (sellin/textos.js).
// El texto de precio NUNCA nombra la lista ni lleva costo/margen (regla de src/lib/whatsapp.js, que no se modifica).
import { precio as fmtPrecioWA, fechaHora, nombreCorto } from '../../../lib/whatsapp';
import { TYPO } from '../../../lib/themeTokens';

export { MESES, MESES_LARGO, normalizar, tokens, coincide, N, fmtInt, fmtPct, fmtMoneyShort, pctDelta, mesesCerrados, roadmapTone } from '../sellin/textos';

// Orden de presentación. Las 5 primeras son el orden aprobado por Fernando (Mayoreo AAA
// primero); las 5 siguientes se sumaron el 2026-09-12, cuando el puente pasó de cargar 5 a
// cargar las 10 listas con más facturación 2026 (ver LISTAS_PRECIOS en bridge/lib/mappers.mjs).
// IMPORTANTE: este arreglo es sólo ORDEN y ETIQUETA. Las listas que la pantalla usa salen
// SIEMPRE de los datos (listasDeDatos en calculo.js), así que una lista que el puente
// agregue mañana aparece sola aunque no esté aquí (se ordena al final, con su nombre crudo).
export const LISTAS = [
  'Mayoreo AAA', 'DICOTECH', 'PCEL PROVISIONAL', 'API PROVISIONAL', 'DECME PROVISIONAL',
  'Mayoreo PMM', 'Ingram Retail', 'MERCADO LIBRE FULL', 'SVENSKA PROVISIONAL', 'AMAZON',
];
export const LISTA_LBL = {
  'Mayoreo AAA': 'Mayoreo AAA', DICOTECH: 'Dicotech', 'PCEL PROVISIONAL': 'PCEL',
  'API PROVISIONAL': 'API', 'DECME PROVISIONAL': 'DECME', 'Mayoreo PMM': 'Mayoreo PMM',
  'Ingram Retail': 'Ingram Retail', 'MERCADO LIBRE FULL': 'ML Full',
  'SVENSKA PROVISIONAL': 'Svenska', AMAZON: 'Amazon',
};
export const listaLbl = (l) => LISTA_LBL[l] || l;

/** Columnas de lista que caben en la tabla sin scroll horizontal (regla de ancho). El resto se ve con el filtro "Listas". */
export const MAX_COLUMNAS_LISTA = 5;

/** Ordena nombres de lista: primero los del catálogo (en su orden), luego los desconocidos alfabéticamente. */
export function ordenarListas(nombres) {
  const idx = new Map(LISTAS.map((l, i) => [l, i]));
  return [...new Set(nombres || [])].filter(Boolean)
    .sort((a, b) => (idx.has(a) ? idx.get(a) : 999) - (idx.has(b) ? idx.get(b) : 999) || String(a).localeCompare(String(b), 'es'));
}

/** Color de cada lista (una línea por lista en la evolución del precio). */
const PALETA_LISTA = ['accent', 'purple', 'orange', 'green', 'teal', 'pink', 'indigo', 'yellow', 'red', 'blue'];
const FALLBACK_LISTA = ['#007AFF', '#AF52DE', '#FF9500', '#34C759', '#5AC8FA', '#FF2D55', '#5856D6', '#FFCC00', '#FF3B30', '#0A84FF'];
export function listaColor(theme, lista) {
  const i = LISTAS.indexOf(lista);
  if (i < 0) return theme.textMuted || '#8E8E93';
  return theme[PALETA_LISTA[i]] || FALLBACK_LISTA[i];
}

// Lista que le corresponde a cada cliente (regla aprobada): digitalife → API, pcel → PCEL, dicotech → DICOTECH, resto → Mayoreo AAA.
export const LISTA_DE_KEY = { digitalife: 'API PROVISIONAL', pcel: 'PCEL PROVISIONAL', dicotech: 'DICOTECH' };
/** Acepta cliente_key (facturacion_clientes) o, si no viene, el nombre del ERP (v_estrategia_precios_bajo sólo trae el nombre). */
export function listaDeCliente({ cliente_key, cliente_nombre } = {}) {
  if (cliente_key && LISTA_DE_KEY[cliente_key]) return LISTA_DE_KEY[cliente_key];
  const n = String(cliente_nombre || '').toUpperCase();
  if (/^API GLOBAL|^CAJADL01/.test(n)) return 'API PROVISIONAL';
  if (/^PC ONLINE/.test(n)) return 'PCEL PROVISIONAL';
  if (/DICOTECH/.test(n)) return 'DICOTECH';
  return 'Mayoreo AAA';
}

// ── Formatos ──
/** 99 → '$99' · 89.1 → '$89.10' · 1234.5 → '$1,234.50' (precios de lista traen centavos). */
export const fmtMoney = (n) => {
  if (n == null || !isFinite(Number(n))) return '—';
  const v = Number(n);
  const dec = Math.abs(v - Math.round(v)) < 0.005 ? 0 : 2;
  return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('es-MX', { minimumFractionDigits: dec, maximumFractionDigits: dec });
};
export const fmtPctDelta = (n, d = 1) => (n == null || !isFinite(n) ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(d)}%`);
export const periodoLbl = (anio, mes) => (anio && mes ? `${['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][mes - 1]} ${String(anio).slice(-2)}` : '—');

/** Elasticidad: −1.2 → '−1.20' (con signo). */
export const fmtElast = (e) => (e == null || !isFinite(e) ? '—' : (e > 0 ? '+' : '') + Number(e).toFixed(2));
/** Estilo pill para <select>/<input> pequeños del drill (26 px, hairline). */
export const selectPill = (theme) => ({ height: 26, borderRadius: 999, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, fontFamily: TYPO.fontText, fontSize: 11.5, padding: '0 10px', outline: 'none' });

export const CAMBIO_TONE = { subio: 'green', bajo: 'red', nuevo: 'blue', sin_cambio: 'gray' };
export const CAMBIO_LBL = { subio: 'Subió', bajo: 'Bajó', nuevo: 'Nuevo', sin_cambio: 'Sin cambio' };

// ── WhatsApp · "Compartir precio" ──
export const IVA = 0.16;
/**
 * Texto para compartir el precio de un SKU. La lista es obligatoria para elegir el precio,
 * pero el texto NO la menciona y no lleva nada sensible.
 *   *Acteck · Precio*
 *   10 sep · 13:00
 *
 *   AC-913973 · Mouse Óptico Entry MO230
 *   Precio + IVA: $114.84 (sin IVA $99.00)
 */
export function textoPrecio({ sku, descripcion, precio, marca = 'Acteck', fecha = new Date() } = {}) {
  const sinIva = Number(precio) || 0;
  const conIva = sinIva * (1 + IVA);
  return [
    `*${marca} · Precio*`,
    fechaHora(fecha),
    '',
    `${sku} · ${nombreCorto(descripcion) || sku}`,
    `Precio + IVA: ${fmtPrecioWA(conIva)} (sin IVA ${fmtPrecioWA(sinIva)})`,
  ].join('\n');
}
export const marcaDe = (marca) => (/balam/i.test(String(marca || '')) ? 'Balam Rush' : 'Acteck');
