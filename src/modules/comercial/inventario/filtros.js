// Motor de filtros de Inventario global · pills combinables con conteo facetado.
// f = { tokens: [], marca: Set, familia: Set, roadmap: Set, estado: Set, soloStock: bool, soloTransito: bool }
// Los conteos de cada grupo se calculan con TODOS los demás filtros aplicados (facetas):
// "si además marco esto, quedan N SKUs".
import { coincideTokens, etiquetaCobertura } from './constantes';

export const FILTROS_VACIOS = () => ({ tokens: [], marca: new Set(), familia: new Set(), roadmap: new Set(), estado: new Set(), soloStock: false, soloTransito: false });

export const ESTADOS = [
  { id: 'riesgo', label: 'Riesgo', tone: 'red', title: 'Se agotan antes de que llegue su tránsito' },
  { id: 'Agotado', label: 'Agotado', tone: 'red', title: 'Sin stock y con demanda ERP' },
  { id: 'Crítica', label: 'Crítica', tone: 'orange', title: 'Menos de 30 días de cobertura' },
  { id: 'Sana', label: 'Sana', tone: 'green', title: 'Entre 30 y 90 días de cobertura' },
  { id: 'Sobre-stock', label: 'Sobre-stock', tone: 'orange', title: 'Más de 90 días de cobertura' },
  { id: 'Sin demanda', label: 'Sin demanda', tone: 'gray', title: 'Con stock y sin ventas ERP en 3 meses cerrados' },
];

// Estado de cobertura de una fila (misma regla que la pill "Días" de la tabla). Sin stock y sin demanda = null.
export function estadoDe(r) {
  if (!r.tieneStock) return r.demandaMes > 0 ? 'Agotado' : null;
  return etiquetaCobertura(r.coberturaDias, true);
}

export const claveMarca = (r) => String(r.marca || '').trim().toLowerCase();
export const claveFamilia = (r) => String(r.familia || '').trim().toLowerCase();
export const claveRoadmap = (r) => String(r.rdmp || '').trim().toUpperCase();

// ¿Pasa el grupo `g` del filtro `f`?
export function pasaGrupo(r, f, g) {
  switch (g) {
    case 'busqueda': return f.tokens.length === 0 || coincideTokens(r.indice, f.tokens);
    case 'marca': return f.marca.size === 0 || f.marca.has(claveMarca(r));
    case 'familia': return f.familia.size === 0 || f.familia.has(claveFamilia(r));
    case 'roadmap': return f.roadmap.size === 0 || f.roadmap.has(claveRoadmap(r));
    case 'estado': return f.estado.size === 0 || (f.estado.has('riesgo') && r.riesgo) || f.estado.has(r.estado);
    case 'stock': return !f.soloStock || r.tieneStock;
    case 'transito': return !f.soloTransito || r.transitoPz > 0;
    default: return true;
  }
}
const GRUPOS = ['busqueda', 'marca', 'familia', 'roadmap', 'estado', 'stock', 'transito'];

export function pasaTodos(r, f, excluir) {
  for (const g of GRUPOS) if (g !== excluir && !pasaGrupo(r, f, g)) return false;
  return true;
}

export function nActivos(f) {
  return f.marca.size + f.familia.size + f.roadmap.size + f.estado.size + (f.soloStock ? 1 : 0) + (f.soloTransito ? 1 : 0);
}

/** Conteos facetados por grupo: { marca: Map(clave → {label, n}), familia, roadmap, estado: Map(id → n), stock: n, transito: n }. */
export function facetas(rows, f) {
  const marca = new Map(), familia = new Map(), roadmap = new Map(), estado = new Map();
  let stock = 0, transito = 0;
  const suma = (m, k, label) => { if (!k) return; const it = m.get(k) || { label, n: 0 }; it.n += 1; m.set(k, it); };
  for (const r of rows) {
    if (pasaTodos(r, f, 'marca')) suma(marca, claveMarca(r), String(r.marca || '').trim());
    if (pasaTodos(r, f, 'familia')) suma(familia, claveFamilia(r), String(r.familia || '').trim());
    if (pasaTodos(r, f, 'roadmap')) suma(roadmap, claveRoadmap(r), claveRoadmap(r));
    if (pasaTodos(r, f, 'estado')) {
      if (r.estado) suma(estado, r.estado, r.estado);
      if (r.riesgo) suma(estado, 'riesgo', 'Riesgo');
    }
    if (pasaTodos(r, f, 'stock') && r.tieneStock) stock += 1;
    if (pasaTodos(r, f, 'transito') && r.transitoPz > 0) transito += 1;
  }
  const ordenar = (m) => [...m.entries()].map(([id, v]) => ({ id, label: v.label || id, n: v.n })).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, 'es'));
  return { marca: ordenar(marca), familia: ordenar(familia), roadmap: ordenar(roadmap), estado, stock, transito };
}
