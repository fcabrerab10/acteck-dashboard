// Buscador de productos «que entiende» (2026-10-05, Fernando: «que el buscador sea muy versátil, que pueda buscar de
// muchas maneras y se me entienda qué es lo que estoy buscando»). Puro: interpretarBusqueda() devuelve lo entendido
// como chips (SKU, marca, categoría, pulgadas, palabras) y una función para filtrar filas. Mismo normalizado que el
// armador de propuestas (propuestas/filtros.js). Pruebas en scripts/test-buscar-sku.mjs.
import { normalizarBusqueda, normalizar } from '../modules/comercial/propuestas/filtros.js';
import { normalizarMarca } from './marcas.js';

const MARCAS = [['acteck', 'Acteck'], ['balam', 'Balam Rush'], ['balam rush', 'Balam Rush'], ['balamrush', 'Balam Rush'], ['br', 'Balam Rush'], ['audive', 'Audive'], ['av', 'Audive']];
const PULGADAS = /^(\d{2}(?:\.\d)?)(?:"|''|pulg|pulgadas|in)$/;
const SKU_PARCIAL = /^(?:[a-z]{2,3}-?\d{3,}|\d{5,})[a-z]*$/;

/** Catálogo opcional { categorias: ['Monitores', …] } para reconocer categorías por nombre o por palabra contenida. */
export function interpretarBusqueda(q, { categorias = [] } = {}) {
  // «AC-9431» se pega antes de normalizar (la normalización convierte el guion en espacio y partiría el SKU).
  const toks = normalizarBusqueda(String(q || '').replace(/\b([A-Za-z]{2,3})-(\d{3,})/g, '$1$2')).split(' ').filter(Boolean);
  const chips = [];
  const cats = categorias.map((c) => [normalizar(c), c]);
  let i = 0;
  while (i < toks.length) {
    const t = toks[i], t2 = toks[i + 1] ? `${t} ${toks[i + 1]}` : null;
    const marca2 = t2 && MARCAS.find(([k]) => k === t2); if (marca2) { chips.push({ tipo: 'marca', valor: marca2[1], label: `Marca ${marca2[1]}` }); i += 2; continue; }
    const marca = MARCAS.find(([k]) => k === t && k.length > 2); if (marca) { chips.push({ tipo: 'marca', valor: marca[1], label: `Marca ${marca[1]}` }); i += 1; continue; }
    if (SKU_PARCIAL.test(t)) { chips.push({ tipo: 'sku', valor: t, label: `SKU ${t.replace(/^([a-z]{2,3})(\d)/, '$1-$2').toUpperCase()}` }); i += 1; continue; }
    const pul = t.match(PULGADAS) || (toks[i + 1] === 'pulgadas' && /^\d{2}(\.\d)?$/.test(t) ? [t, t] : null);
    if (pul) { chips.push({ tipo: 'pulgadas', valor: pul[1], label: `${pul[1]}"` }); i += toks[i + 1] === 'pulgadas' ? 2 : 1; continue; }
    const cat = cats.find(([n]) => n === t || n === t2 || (t.length >= 4 && n.startsWith(t)) || (t.length >= 5 && n.includes(t)));
    if (cat) { chips.push({ tipo: 'categoria', valor: cat[1], label: `Categoría ${cat[1]}` }); i += cat[0] === t2 ? 2 : 1; continue; }
    chips.push({ tipo: 'palabra', valor: t, label: `«${t}»` }); i += 1;
  }
  return { q, chips, vacio: chips.length === 0 };
}

/** Índice de una fila: sku (con y sin guion), descripción, marca, categoría, familia. */
export const indiceSku = (r) => {
  const sku = normalizar(r.sku || '');
  return ` ${normalizarBusqueda(`${r.sku || ''} ${r.descripcion || ''} ${r.marca || ''} ${r.categoria || ''} ${r.familia || ''}`)} ${sku.replace(/[^a-z0-9]/g, '')} `;
};

/** ¿La fila cumple TODO lo entendido? La marca se compara normalizada; la categoría por nombre; el SKU por prefijo/contenido. */
export function coincideSku(r, interp, indice = indiceSku(r)) {
  for (const c of interp.chips) {
    if (c.tipo === 'marca') { const m = normalizarMarca(r.marca) || null; if ((m || '').toLowerCase() !== c.valor.toLowerCase()) return false; continue; }
    if (c.tipo === 'categoria') { if (normalizar(r.categoria || '') !== normalizar(c.valor) && !normalizar(r.categoria || '').includes(normalizar(c.valor))) return false; continue; }
    if (c.tipo === 'sku') { if (!normalizar(r.sku || '').replace(/[^a-z0-9]/g, '').includes(c.valor) && !indice.includes(c.valor)) return false; continue; } // «SP270» también es un modelo dentro de la descripción
    if (c.tipo === 'pulgadas') { if (!new RegExp(`(^|[^\\d])${c.valor.replace('.', '\\.')}(\\s*(\\"|''|pulg|in\\b)|\\s|$)`).test(normalizarBusqueda(r.descripcion || ''))) return false; continue; }
    if (!indice.includes(` ${c.valor}`) && !indice.includes(c.valor)) return false;
  }
  return true;
}

/** Texto corto de lo entendido: «SKU AC-9431 · Categoría Monitores · 27"». */
export const resumenBusqueda = (interp) => interp.chips.map((c) => c.label).join(' · ');
