// EAN (código de barras) por SKU · 2026-09-12
//
// Vive en dos tablas que la app NO puede leer (RLS encendida y sin políticas):
// `catalogo_articulos.isbn` y `series_generadas.ean`. La vista `v_sku_ean`
// (migración 20260912_precios_historia.sql) expone sólo `sku, ean` ya normalizado
// (dígitos, longitud 8/12/13/14 — la mitad de los `isbn` del catálogo son un "0"
// de relleno, por eso no son 8,850 sino ~4,200 SKUs con código real).
//
// Regla de rendimiento: NUNCA se baja la vista completa. Se piden sólo los SKUs
// que están en pantalla con `.in('sku', …)`, en trozos de 200 por URL, y con
// `cachedQuery` (cache de 5 min por URL + dedupe, como el resto de las lecturas).
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { cachedQuery } from './queries';

const TROZO = 200;         // tope del .in(…) por URL
const STALE = 30 * 60 * 1000; // el catálogo casi no cambia

/** Normaliza y ordena la lista de SKUs para que la queryKey sea estable. */
export const clavesSku = (skus) => [...new Set((skus || []).map((s) => String(s || '').trim()).filter(Boolean))].sort();

/** Baja el EAN de una lista de SKUs → Map sku → ean. Sin React (se puede usar al exportar). */
export async function mapaEan(skus) {
  const lista = clavesSku(skus);
  const out = new Map();
  if (!lista.length) return out;
  const trozos = [];
  for (let i = 0; i < lista.length; i += TROZO) trozos.push(lista.slice(i, i + TROZO));
  const res = await Promise.all(trozos.map((t) => cachedQuery(supabase.from('v_sku_ean').select('sku,ean').in('sku', t))));
  for (const r of res) for (const f of r?.data || []) if (f?.ean) out.set(f.sku, f.ean);
  return out;
}

/** Hook: Map sku → ean para los SKUs en pantalla. `data` nunca es undefined (Map vacío mientras carga). */
export function useEan(skus) {
  const lista = clavesSku(skus);
  const q = useQuery({
    queryKey: ['ean', lista.length, lista.join('|').slice(0, 2000)],
    enabled: lista.length > 0,
    staleTime: STALE,
    queryFn: () => mapaEan(lista),
  });
  return q.data || VACIO;
}
const VACIO = new Map();

/** '7506215944458' → '7 506215 944458' (se lee mejor en una ficha). */
export const eanLegible = (ean) => {
  const s = String(ean || '').replace(/\D/g, '');
  if (s.length === 13) return `${s.slice(0, 1)} ${s.slice(1, 7)} ${s.slice(7)}`;
  if (s.length === 12) return `${s.slice(0, 1)} ${s.slice(1, 6)} ${s.slice(6, 11)} ${s.slice(11)}`;
  if (s.length === 8) return `${s.slice(0, 4)} ${s.slice(4)}`;
  return s;
};
