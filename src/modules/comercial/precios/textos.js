// Estrategia de Precios · constantes, formatos y texto de WhatsApp ("Compartir precio").
// Reutiliza la búsqueda sin acentos y los formatos del Sell In consolidado (sellin/textos.js).
// El texto de precio NUNCA nombra la lista ni lleva costo/margen (regla de src/lib/whatsapp.js, que no se modifica).
import { precio as fmtPrecioWA, fechaHora, nombreCorto } from '../../../lib/whatsapp';
import { TYPO } from '../../../lib/themeTokens';

export { MESES, MESES_LARGO, normalizar, tokens, coincide, N, fmtInt, fmtPct, fmtMoneyShort, pctDelta, mesesCerrados, roadmapTone } from '../sellin/textos';

// Orden aprobado: Mayoreo AAA primero y las demás a la derecha.
export const LISTAS = ['Mayoreo AAA', 'DICOTECH', 'PCEL PROVISIONAL', 'API PROVISIONAL', 'DECME PROVISIONAL'];
export const LISTA_LBL = { 'Mayoreo AAA': 'Mayoreo AAA', DICOTECH: 'Dicotech', 'PCEL PROVISIONAL': 'PCEL', 'API PROVISIONAL': 'API', 'DECME PROVISIONAL': 'DECME' };
export const listaLbl = (l) => LISTA_LBL[l] || l;

/** Color de cada lista (una línea por lista en la evolución del precio). */
export function listaColor(theme, lista) {
  const m = {
    'Mayoreo AAA': theme.accent || '#007AFF',
    DICOTECH: theme.purple || '#AF52DE',
    'PCEL PROVISIONAL': theme.orange || '#FF9500',
    'API PROVISIONAL': theme.green || '#34C759',
    'DECME PROVISIONAL': theme.teal || '#5AC8FA',
  };
  return m[lista] || theme.textMuted || '#8E8E93';
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
