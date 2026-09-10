// Motor de filtros del S&OP · buscador por palabras (cualquier orden, sin acentos) + pills combinables
// con conteo facetado. Mismo patrón que inventario/filtros.js y sellin/textos.js (se reutilizan sus helpers).
//   f = { tokens: [], proveedor: Set, familia: Set, marca: Set, cliente: Set, roadmap: Set, estado: Set, soloSugerido: bool }
// Los conteos de cada grupo se calculan con TODOS los demás filtros aplicados: "si además marco esto, quedan N".
import { normalizar, tokens as tokensDe, coincide } from '../sellin/textos';
import { COBERTURA_CRITICA, COBERTURA_SOBRESTOCK } from '../inventario/constantes';

export const FILTROS_VACIOS = () => ({ tokens: [], proveedor: new Set(), familia: new Set(), marca: new Set(), cliente: new Set(), roadmap: new Set(), estado: new Set(), soloSugerido: false });

export const ESTADOS_SOP = [
  { id: 'brecha', label: 'Con brecha', tone: 'red', title: 'Objetivo 3 meses (+crecimiento +seguridad) mayor que inventario + tránsito' },
  { id: 'critico', label: 'Crítico', tone: 'orange', title: `Menos de ${COBERTURA_CRITICA} días de cobertura a ritmo ERP de 3 meses` },
  { id: 'sobrestock', label: 'Sobre-stock', tone: 'yellow', title: `Más de ${COBERTURA_SOBRESTOCK} días de cobertura` },
  { id: 'sinDemanda', label: 'Sin demanda', tone: 'gray', title: 'Con stock y sin ventas ERP en los últimos 3 meses' },
  { id: 'marcado', label: 'Marcado crítico', tone: 'purple', title: 'SKU marcado como crítico en sku_config (lleva meses de seguridad)' },
];

export const SIN = '—';
export const claveProveedor = (r) => String(r.supplier || '').trim() || SIN;
export const claveFamilia = (r) => String(r.familia || '').trim() || SIN;
export const claveMarca = (r) => String(r.marca || '').trim() || SIN;
export const claveRoadmap = (r) => String(r.roadmapEstado || '').trim().toUpperCase() || SIN;

/** Estados (varios por fila) según las mismas reglas de la tabla y el hero. */
export function estadosDe(r) {
  const out = [];
  if (Number(r.brecha || 0) > 0) out.push('brecha');
  const cob = r.coberturaDiasErp;
  if (cob != null && isFinite(cob) && cob < COBERTURA_CRITICA) out.push('critico');
  if (cob != null && isFinite(cob) && cob > COBERTURA_SOBRESTOCK) out.push('sobrestock');
  if (Number(r.inv || 0) > 0 && !(Number(r.demandaMesErp || 0) > 0)) out.push('sinDemanda');
  if (r.esCritico) out.push('marcado');
  return out;
}

/** Clientes ERP con consumo en 6 meses (nombre tal cual el ERP). */
export const clientesDe = (r) => (Array.isArray(r.demandaPorClienteErp) ? r.demandaPorClienteErp : []).filter((c) => Number(c.total6m || 0) > 0).map((c) => c.cliente);

/** Enriquece las filas del motor con el índice de búsqueda y las claves de faceta (una sola vez por cálculo). */
export function indexar(rows) {
  return rows.map((r) => ({
    ...r,
    _indice: normalizar([r.sku, r.descripcion, r.marca, r.supplier, r.familia, r.roadmapEstado].filter(Boolean).join(' ')),
    _estados: estadosDe(r),
    _clientes: clientesDe(r),
    _proveedor: claveProveedor(r),
    _familia: claveFamilia(r),
    _marca: claveMarca(r),
    _roadmap: claveRoadmap(r),
  }));
}

export const tokensBusqueda = tokensDe;

export function pasaGrupo(r, f, g) {
  switch (g) {
    case 'busqueda': return f.tokens.length === 0 || coincide(r._indice, f.tokens);
    case 'proveedor': return f.proveedor.size === 0 || f.proveedor.has(r._proveedor);
    case 'familia': return f.familia.size === 0 || f.familia.has(r._familia);
    case 'marca': return f.marca.size === 0 || f.marca.has(r._marca);
    case 'cliente': return f.cliente.size === 0 || r._clientes.some((c) => f.cliente.has(c));
    case 'roadmap': return f.roadmap.size === 0 || f.roadmap.has(r._roadmap);
    case 'estado': return f.estado.size === 0 || r._estados.some((e) => f.estado.has(e));
    case 'sugerido': return !f.soloSugerido || Number(r.sugerido || 0) > 0;
    default: return true;
  }
}
const GRUPOS = ['busqueda', 'proveedor', 'familia', 'marca', 'cliente', 'roadmap', 'estado', 'sugerido'];

export function pasaTodos(r, f, excluir) {
  for (const g of GRUPOS) if (g !== excluir && !pasaGrupo(r, f, g)) return false;
  return true;
}

export function nActivos(f) {
  return f.proveedor.size + f.familia.size + f.marca.size + f.cliente.size + f.roadmap.size + f.estado.size + (f.soloSugerido ? 1 : 0);
}

/** Conteos facetados: { proveedor: [{id,label,n}], familia, marca, cliente, roadmap, estado: Map(id → n), sugerido: n }. */
export function facetas(rows, f) {
  const proveedor = new Map(), familia = new Map(), marca = new Map(), cliente = new Map(), roadmap = new Map(), estado = new Map();
  let sugerido = 0;
  const suma = (m, k) => { if (!k) return; m.set(k, (m.get(k) || 0) + 1); };
  for (const r of rows) {
    if (pasaTodos(r, f, 'proveedor')) suma(proveedor, r._proveedor);
    if (pasaTodos(r, f, 'familia')) suma(familia, r._familia);
    if (pasaTodos(r, f, 'marca')) suma(marca, r._marca);
    if (pasaTodos(r, f, 'roadmap')) suma(roadmap, r._roadmap);
    if (pasaTodos(r, f, 'cliente')) r._clientes.forEach((c) => suma(cliente, c));
    if (pasaTodos(r, f, 'estado')) r._estados.forEach((e) => suma(estado, e));
    if (pasaTodos(r, f, 'sugerido') && Number(r.sugerido || 0) > 0) sugerido += 1;
  }
  const ordenar = (m, sel) => {
    for (const s of sel) if (!m.has(s)) m.set(s, 0);
    return [...m.entries()].map(([id, n]) => ({ id, label: id, n })).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, 'es'));
  };
  return {
    proveedor: ordenar(proveedor, f.proveedor), familia: ordenar(familia, f.familia), marca: ordenar(marca, f.marca),
    cliente: ordenar(cliente, f.cliente), roadmap: ordenar(roadmap, f.roadmap), estado, sugerido,
  };
}
