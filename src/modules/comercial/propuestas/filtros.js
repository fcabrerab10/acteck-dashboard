// filtros.js — motor de filtros del catálogo del armador (misma idea que inventario/filtros.js: pills con conteo facetado).
// f = { tokens: [], marca: Set, familia: Set, roadmap: Set, soloStock, soloSellout, soloSpiff }
// Cada fila del catálogo trae `indice` (texto normalizado sin acentos: sku · descripción · marca · familia · roadmap).
import { normalizar, tokens as aTokens, coincide } from '../sellin/textos';

export { normalizar, aTokens as tokens };
export const FILTROS_VACIOS = () => ({ tokens: [], marca: new Set(), familia: new Set(), roadmap: new Set(), soloStock: false, soloSellout: false, soloSpiff: false });

export const indiceDe = (r) => normalizar(`${r.sku} ${r.descripcion || ''} ${r.marca || ''} ${r.familia || ''} ${r.categoria || ''} ${r.rdmp || ''}`);
export const claveMarca = (r) => String(r.marca || '').trim().toLowerCase();
export const claveFamilia = (r) => String(r.familia || '').trim().toLowerCase();
export const claveRoadmap = (r) => String(r.rdmp || '').trim().toUpperCase();

export function pasaGrupo(r, f, g) {
  switch (g) {
    case 'busqueda': return f.tokens.length === 0 || coincide(r.indice, f.tokens);
    case 'marca': return f.marca.size === 0 || f.marca.has(claveMarca(r));
    case 'familia': return f.familia.size === 0 || f.familia.has(claveFamilia(r));
    case 'roadmap': return f.roadmap.size === 0 || f.roadmap.has(claveRoadmap(r));
    case 'stock': return !f.soloStock || r.invActeck > 0;
    case 'sellout': return !f.soloSellout || r.sellout90 > 0;
    case 'spiff': return !f.soloSpiff || r.spiff > 0;
    default: return true;
  }
}
const GRUPOS = ['busqueda', 'marca', 'familia', 'roadmap', 'stock', 'sellout', 'spiff'];
export function pasaTodos(r, f, excluir) {
  for (const g of GRUPOS) if (g !== excluir && !pasaGrupo(r, f, g)) return false;
  return true;
}
export const nActivos = (f) => f.marca.size + f.familia.size + f.roadmap.size + (f.soloStock ? 1 : 0) + (f.soloSellout ? 1 : 0) + (f.soloSpiff ? 1 : 0);

/** Conteos facetados ("si además marco esto, quedan N"). */
export function facetas(rows, f) {
  const marca = new Map(), familia = new Map(), roadmap = new Map();
  let stock = 0, sellout = 0, spiff = 0;
  const suma = (m, k, label) => { if (!k) return; const it = m.get(k) || { label, n: 0 }; it.n += 1; m.set(k, it); };
  for (const r of rows) {
    if (pasaTodos(r, f, 'marca')) suma(marca, claveMarca(r), String(r.marca || '').trim());
    if (pasaTodos(r, f, 'familia')) suma(familia, claveFamilia(r), String(r.familia || '').trim());
    if (pasaTodos(r, f, 'roadmap')) suma(roadmap, claveRoadmap(r), claveRoadmap(r));
    if (pasaTodos(r, f, 'stock') && r.invActeck > 0) stock += 1;
    if (pasaTodos(r, f, 'sellout') && r.sellout90 > 0) sellout += 1;
    if (pasaTodos(r, f, 'spiff') && r.spiff > 0) spiff += 1;
  }
  const ordenar = (m) => [...m.entries()].map(([id, v]) => ({ id, label: v.label || id, n: v.n })).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, 'es'));
  return { marca: ordenar(marca), familia: ordenar(familia), roadmap: ordenar(roadmap), stock, sellout, spiff };
}
