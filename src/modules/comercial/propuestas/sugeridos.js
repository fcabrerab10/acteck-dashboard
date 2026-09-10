// sugeridos.js — SKUs que conviene proponer al cliente (los acepta Fernando; nunca se marcan solos).
// Regla: el cliente los vendió en los 3 meses cerrados (sellout90 > 0) y hoy su cobertura es crítica
// (< COBERTURA_CRITICA días a ritmo mensual de sell-out) o no tiene stock — misma regla y mismo tono
// que Inventario global (inventario/constantes.js · tonoCobertura).
// Piezas sugeridas = ritmo mensual × 1 mes − stock del cliente, redondeado hacia arriba a múltiplos de 5, mínimo 5.
import { tonoCobertura } from '../inventario/constantes';

const N = (v) => Number(v) || 0;

/** Fila del catálogo → { piezas, dias, stock, ritmo } o null si no aplica. */
export function sugeridoDe(r) {
  const ritmo = N(r.sellout90) / 3;             // pz/mes (sin redondear)
  if (!(ritmo > 0)) return null;
  const stock = N(r.invCliente);
  const dias = stock > 0 ? (stock / ritmo) * 30 : 0;
  if (tonoCobertura(dias, stock) !== 'red') return null;
  const faltan = ritmo - stock;
  const piezas = Math.max(5, Math.ceil(faltan / 5) * 5);
  return { piezas, dias: Math.floor(dias), stock, ritmo: Math.round(ritmo) };
}

/**
 * Mapa sku → sugerido. `activo` = false cuando falta el sell-out o el inventario del cliente
 * (sin esos datos todo parecería "sin stock" y la sugerencia sería ruido).
 */
export function calcularSugeridos(skus, { activo = true } = {}) {
  const m = new Map();
  if (!activo) return m;
  for (const r of skus || []) { const s = sugeridoDe(r); if (s) m.set(r.sku, s); }
  return m;
}
