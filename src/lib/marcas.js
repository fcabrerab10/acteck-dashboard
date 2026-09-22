// marcas.js — fuente única de las marcas propias de la casa (Acteck · Balam Rush · Audive).
//
// Antes cada pantalla tenía su propio mapa de prefijos ("AC-" → Acteck, "BR-" → Balam Rush) y
// su propia paleta, así que dar de alta una marca obligaba a tocar diez archivos. Aquí viven:
//   · MARCAS_PROPIAS  — la lista (key, label, prefijos de SKU, color)
//   · marcaDeSku()    — marca inferida del prefijo del SKU (fallback cuando el roadmap aún no
//                       tiene el SKU; es el caso de Audive: llega primero en embarques_compras)
//   · normalizarMarca() — colapsa ACTECK/Acteck, BALAM RUSH/Balam Rush/Balam Rush Spectrum, AUDIVE…
//   · esMarcaPropia() · colorMarca() · etiquetaMarcasCliente()
//
// Regla: ninguna pantalla vuelve a escribir `sku.startsWith('AC')` ni un hex de marca a mano.

export const MARCAS_PROPIAS = [
  { key: 'acteck',     label: 'Acteck',     prefijos: ['AC'], color: '#007AFF', tone: 'blue' },
  { key: 'balamrush',  label: 'Balam Rush', prefijos: ['BR'], color: '#8B5CF6', tone: 'purple' },
  { key: 'audive',     label: 'Audive',     prefijos: ['AV'], color: '#FF9500', tone: 'orange' },
];

/** Marcas de terceros que también distribuimos (no propias, pero sí reconocibles por prefijo). */
export const PREFIJOS_TERCEROS = {
  ES: 'Acteck',        // línea Acteck con prefijo viejo
  SW: 'Swann',
  MG: 'DXT Gaming',
  ZM: 'DXT Gaming',
  TG: 'DXT Gaming',
  NA: 'Xtreme PC',
  RR: 'Xtreme PC',
};

const COLOR_OTRA = '#8E8E93';

const PREFIJO_A_LABEL = (() => {
  const m = {};
  for (const x of MARCAS_PROPIAS) for (const p of x.prefijos) m[p] = x.label;
  for (const [p, label] of Object.entries(PREFIJOS_TERCEROS)) if (!m[p]) m[p] = label;
  return m;
})();

/** "AV-946360" → "AV" · "AC946360" → "AC" · "" → "" */
function prefijoDeSku(sku) {
  const s = String(sku || '').trim().toUpperCase();
  if (!s) return '';
  return (s.split('-')[0] || '').replace(/[^A-Z]/g, '');
}

/** Marca inferida del prefijo del SKU. Devuelve la etiqueta oficial o null si no se reconoce. */
export function marcaDeSku(sku) {
  const p = prefijoDeSku(sku);
  return (p && PREFIJO_A_LABEL[p]) || null;
}

/** ¿El SKU es de una marca propia (Acteck, Balam Rush, Audive)? */
export function esSkuPropio(sku) {
  const p = prefijoDeSku(sku);
  return MARCAS_PROPIAS.some((m) => m.prefijos.includes(p));
}

/**
 * Colapsa las variantes de escritura a la etiqueta oficial.
 * ACTECK/acteck → "Acteck" · BALAM/BALAM RUSH/Balam Rush Spectrum → "Balam Rush" · AUDIVE → "Audive".
 * Lo que no reconoce se devuelve tal cual (ya recortado), nunca vacío por sorpresa.
 */
export function normalizarMarca(str) {
  const raw = String(str == null ? '' : str).trim();
  if (!raw) return '';
  const u = raw.toUpperCase();
  if (u === 'ACTECK') return 'Acteck';
  if (u === 'BALAM' || u.startsWith('BALAM RUSH')) return 'Balam Rush';
  if (u === 'AUDIVE') return 'Audive';
  return raw;
}

/** ¿Es una de las tres marcas de la casa? Acepta cualquier variante de escritura. */
export function esMarcaPropia(m) {
  const label = normalizarMarca(m);
  return MARCAS_PROPIAS.some((x) => x.label === label);
}

/** Definición completa de una marca propia por etiqueta/key, o null. */
export function marcaPropia(m) {
  const label = normalizarMarca(m);
  return MARCAS_PROPIAS.find((x) => x.label === label || x.key === String(m || '').toLowerCase()) || null;
}

/** Color oficial de la marca (gris neutro para todo lo que no sea propio). */
export function colorMarca(m, fallback = COLOR_OTRA) {
  return marcaPropia(m)?.color || fallback;
}

/** Tono del kit (Pill/DeltaPill) para la marca; gris para lo que no sea propio. */
export function toneMarca(m, fallback = 'gray') {
  return marcaPropia(m)?.tone || fallback;
}

/** Etiqueta de marcas de un cliente: ['acteck','balamrush','audive'] → "Acteck · Balam Rush · Audive". */
export function etiquetaMarcasCliente(keys = []) {
  return keys
    .map((k) => marcaPropia(k)?.label || normalizarMarca(k))
    .filter(Boolean)
    .join(' · ');
}

/** Todas las marcas propias, en orden, como opciones {id,label,color} para selectores. */
export const OPCIONES_MARCA_PROPIA = MARCAS_PROPIAS.map((m) => ({ id: m.label, label: m.label, color: m.color }));

/** Etiqueta lista para los clientes que venden las tres marcas. */
export const MARCAS_CASA_LABEL = etiquetaMarcasCliente(MARCAS_PROPIAS.map((m) => m.key));
