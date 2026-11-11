// Acteck PCs · acceso a datos (2026-11-11). Las cinco tablas pcs_* las ESCRIBE la app: useQuery propio e
// invalidación a mano tras cada escritura (nunca cachedQuery). Lo de sólo lectura (precio de lista, inventario
// y tránsito de nuestros componentes, ventas del ERP) va en la misma consulta porque son pocas filas por SKU.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { queryClient } from '../../../lib/queryClient';

const KEY = ['acteck-pcs'];
export const invalidarPcs = () => queryClient.invalidateQueries({ queryKey: KEY });
export const LISTA_PCS = 'Mayoreo PMM';

const leer = async (q) => { const { data, error } = await q; if (error) throw error; return data || []; };
const suave = (p) => p.catch(() => []);

export function usePcs() {
  return useQuery({
    queryKey: KEY,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const [modelos, componentes, costos, ordenes, lineas] = await Promise.all([
        leer(supabase.from('pcs_modelos').select('*').order('orden')),
        leer(supabase.from('pcs_componentes').select('*').order('orden')),
        leer(supabase.from('pcs_costos').select('*').order('vigente_desde', { ascending: false })),
        leer(supabase.from('pcs_ordenes').select('*').order('fecha', { ascending: false })),
        leer(supabase.from('pcs_orden_lineas').select('*')),
      ]);
      const skus = modelos.map((m) => m.sku);
      const propios = Array.from(new Set(componentes.map((c) => c.sku_propio).filter(Boolean)));
      const [precios, ventas, inv, tra, desc] = await Promise.all([
        skus.length ? suave(leer(supabase.from('v_estrategia_precios_lista').select('sku,lista,precio').in('sku', skus))) : [],
        skus.length ? suave(leer(supabase.from('v_pcs_ventas').select('sku,cliente_nombre,fecha,folio,movimiento_venta,piezas,monto'))) : [],
        propios.length ? suave(leer(supabase.from('v_medidas_inventario_sku').select('articulo,inv_actual_disponible').in('articulo', propios))) : [],
        propios.length ? suave(leer(supabase.from('v_transito_sku').select('sku,cantidad,eta_mas_cercana').in('sku', propios))) : [],
        propios.length ? suave(leer(supabase.from('roadmap_sku').select('sku,descripcion').in('sku', propios))) : [],
      ]);
      const mapaPrecios = {};
      for (const p of precios) if (p.lista === LISTA_PCS || mapaPrecios[p.sku] == null) mapaPrecios[p.sku] = Number(p.precio);
      return {
        modelos, componentes, costos, ordenes, lineas, ventas,
        precios: mapaPrecios,
        inventario: Object.fromEntries(inv.map((r) => [r.articulo, Number(r.inv_actual_disponible) || 0])),
        transito: Object.fromEntries(tra.map((r) => [r.sku, { cantidad: Number(r.cantidad) || 0, eta: r.eta_mas_cercana }])),
        descripciones: Object.fromEntries(desc.map((r) => [r.sku, r.descripcion])),
      };
    },
  });
}

const limpio = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === '' ? null : v]));
const hecho = async (q) => { const { data, error } = await q; if (error) throw error; await invalidarPcs(); return data; };

// ─── Pedidos ───
export async function guardarOrden(orden, lineas, perfil) {
  const { id, ...campos } = orden;
  const fila = limpio({ ...campos, updated_at: new Date().toISOString() });
  let ordenId = id;
  if (id) {
    const { error } = await supabase.from('pcs_ordenes').update(fila).eq('id', id);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from('pcs_ordenes').insert({ ...fila, creado_por: perfil?.user_id || null }).select('id').single();
    if (error) throw error;
    ordenId = data.id;
  }
  if (lineas) {
    const buenas = lineas.filter((l) => l.sku_modelo && Number(l.equipos) > 0)
      .map((l) => ({ orden_id: ordenId, sku_modelo: l.sku_modelo, equipos: Math.round(Number(l.equipos)), precio: l.precio === '' || l.precio == null ? null : Number(l.precio), costo: l.costo === '' || l.costo == null ? null : Number(l.costo) }));
    const { error: e1 } = await supabase.from('pcs_orden_lineas').delete().eq('orden_id', ordenId);
    if (e1) throw e1;
    if (buenas.length) { const { error: e2 } = await supabase.from('pcs_orden_lineas').insert(buenas); if (e2) throw e2; }
  }
  await invalidarPcs();
  return ordenId;
}
export const actualizarOrden = (id, cambios) => hecho(supabase.from('pcs_ordenes').update({ ...limpio(cambios), updated_at: new Date().toISOString() }).eq('id', id));
export const eliminarOrden = (id) => hecho(supabase.from('pcs_ordenes').delete().eq('id', id));

// ─── Modelos, componentes y costos ───
export const guardarModelo = (sku, campos) => hecho(supabase.from('pcs_modelos').upsert({ sku, ...limpio(campos), updated_at: new Date().toISOString() }));
export async function guardarComponentes(sku, lista) {
  const { error } = await supabase.from('pcs_componentes').delete().eq('sku_modelo', sku);
  if (error) throw error;
  const filas = lista.filter((c) => String(c.descripcion || '').trim())
    .map((c, i) => ({ sku_modelo: sku, tipo: c.tipo || 'otro', descripcion: String(c.descripcion).trim(), sku_propio: String(c.sku_propio || '').trim().toUpperCase() || null, cantidad: Number(c.cantidad) || 1, orden: i }));
  if (filas.length) { const { error: e2 } = await supabase.from('pcs_componentes').insert(filas); if (e2) throw e2; }
  await invalidarPcs();
}
export const agregarCosto = (sku, { vigente_desde, costo, desglose, nota }, perfil) => hecho(supabase.from('pcs_costos').insert({
  sku_modelo: sku, vigente_desde, costo: Number(costo), nota: nota || null, creado_por: perfil?.user_id || null,
  desglose: (desglose || []).filter((d) => d.costo !== '' && d.costo != null).map((d) => ({ tipo: d.tipo, descripcion: d.descripcion, costo: Number(d.costo) })),
}));
export const eliminarCosto = (id) => hecho(supabase.from('pcs_costos').delete().eq('id', id));
