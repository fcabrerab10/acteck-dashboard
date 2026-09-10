// Compartir disponibilidad desde Inventario global (escritorio).
// El texto es EXACTAMENTE el de lib/whatsapp.textoDisponibilidad (mismo que el móvil):
// precio de lista sin IVA + "IVA", sin nombrar la lista, próximo arribo = embarque con
// la ETA más cercana y las piezas de ESE embarque; nunca costos ni márgenes.
//   usePreciosLista(skus)         → { porSku: Map(sku → { lista → { precio, moneda, anio, mes } }), listas: [...], cargando }
//   itemDisponibilidad(row, precio) → item para textoDisponibilidad a partir de una fila enriquecida de la tabla
//   armarTexto(rows, porSku, lista) → string listo para compartir
//   useQuienLoCompra(sku, abierto) → sell in de los últimos 6 meses por cliente/canal (top 8 + Otros)
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { cachedQuery } from '../../../lib/queries';
import { textoDisponibilidad } from '../../../lib/whatsapp';
import { N } from './constantes';

const STALE = 5 * 60 * 1000;
const chunkBy = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, (i + 1) * n));

const hoyISO = () => {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Precios vigentes por lista (v_estrategia_precios_lista · 1 fila por sku+lista, precio más reciente). */
export function usePreciosLista(skus, enabled = true) {
  const lista = [...new Set(skus)].sort();
  const q = useQuery({
    queryKey: ['inventario', 'precios', lista], staleTime: STALE, enabled: enabled && lista.length > 0,
    queryFn: async () => {
      const porSku = new Map();
      const listas = new Set();
      for (const ch of chunkBy(lista, 200)) {
        const { data, error } = await cachedQuery(supabase.from('v_estrategia_precios_lista').select('sku,lista,moneda,precio,anio,mes').in('sku', ch));
        if (error) throw error;
        (data || []).forEach((r) => {
          if (!porSku.has(r.sku)) porSku.set(r.sku, {});
          porSku.get(r.sku)[r.lista] = { precio: N(r.precio), moneda: r.moneda || '', anio: r.anio, mes: r.mes };
          listas.add(r.lista);
        });
      }
      return { porSku, listas: [...listas].sort() };
    },
  });
  return { porSku: q.data?.porSku || new Map(), listas: q.data?.listas || [], cargando: q.isLoading, error: q.error || null };
}

/** Embarque con la ETA más cercana (≥ hoy; si no hay, el primero con fecha). */
export function proximoArriboDe(row) {
  const pos = (row?.transito?.pos || []).filter((p) => N(p.cantidad) > 0);
  const hoy = hoyISO();
  const p = pos.find((e) => e.eta && e.eta >= hoy) || pos.find((e) => e.eta) || null;
  return p ? { fecha: p.eta, piezas: N(p.cantidad), po: p.po } : null;
}

export function itemDisponibilidad(row, precio) {
  return {
    sku: row.sku, descripcion: row.descripcion || '',
    disponible: row.totalDisp, proximoArribo: proximoArriboDe(row), enCamino: row.transitoPz,
    precio: precio == null ? null : precio,
  };
}

/** Texto final para N filas con la lista elegida (obligatoria: sin lista devuelve ''). */
export function armarTexto(rows, porSku, lista) {
  if (!lista || !rows?.length) return '';
  return textoDisponibilidad(rows.map((r) => itemDisponibilidad(r, porSku.get(r.sku)?.[lista]?.precio ?? null)));
}

/** Últimos 6 meses cerrados + el actual (anio, mes) hacia atrás. */
export function mesesRecientes(n = 6, hoy = new Date()) {
  return Array.from({ length: n }, (_, i) => { const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1); return { anio: d.getFullYear(), mes: d.getMonth() + 1 }; });
}

/** Sell in por cliente/canal para un SKU (facturacion_clientes, índice por sku: ~5 ms). Carga sólo con abierto=true. */
export function useQuienLoCompra(sku, abierto = true) {
  const meses = mesesRecientes(6);
  const claves = new Set(meses.map((m) => `${m.anio}-${m.mes}`));
  const anios = [...new Set(meses.map((m) => m.anio))];
  const q = useQuery({
    queryKey: ['inventario', 'quien-compra', sku, meses[0].anio, meses[0].mes], staleTime: STALE, enabled: abierto && !!sku,
    queryFn: async () => {
      const { data, error } = await cachedQuery(supabase.from('facturacion_clientes').select('cliente_nombre,cliente_key,canal,anio,mes,piezas,monto').eq('sku', sku).in('anio', anios));
      if (error) throw error;
      const m = new Map();
      let totalPz = 0, totalMonto = 0;
      (data || []).forEach((r) => {
        if (!claves.has(`${r.anio}-${Number(r.mes)}`)) return;
        const k = r.cliente_nombre || r.cliente_key || '—';
        if (!m.has(k)) m.set(k, { cliente: k, clienteKey: r.cliente_key || '', canal: r.canal || '', piezas: 0, monto: 0, meses: new Set() });
        const it = m.get(k);
        it.piezas += N(r.piezas); it.monto += N(r.monto); it.meses.add(`${r.anio}-${r.mes}`);
        totalPz += N(r.piezas); totalMonto += N(r.monto);
      });
      const todos = [...m.values()].map((x) => ({ ...x, meses: x.meses.size })).sort((a, b) => b.piezas - a.piezas || b.monto - a.monto);
      const top = todos.slice(0, 8);
      const resto = todos.slice(8);
      if (resto.length) top.push({ cliente: `Otros (${resto.length})`, clienteKey: '', canal: '', piezas: resto.reduce((s, x) => s + x.piezas, 0), monto: resto.reduce((s, x) => s + x.monto, 0), meses: 0, otros: true });
      const porCanal = new Map();
      todos.forEach((x) => { const c = x.canal || 'Sin canal'; porCanal.set(c, (porCanal.get(c) || 0) + x.piezas); });
      return { filas: top, nClientes: todos.length, totalPz, totalMonto, porCanal: [...porCanal.entries()].map(([canal, piezas]) => ({ canal, piezas })).sort((a, b) => b.piezas - a.piezas), meses };
    },
  });
  return { datos: q.data || null, cargando: q.isLoading, error: q.error || null };
}
