// Inventario comprometido (apartado) e inventario fuera de venta · lógica pura + hook.
//
// APARTADO = inventario − disponible dentro del universo de la medida [Inv Actual]
// (`en_inv_actual`). Es producto que está en el almacén pero ya está comprometido a una
// orden en curso: no se puede volver a vender. Se calcula sobre las filas que la pantalla
// YA tiene en memoria (v_inventario_almacen_medida), así que no cuesta una consulta más.
// Su equivalente en SQL es `v_inventario_apartado_sku` / `v_inventario_apartado_total`
// (migración 20260912_inventario_apartado_fuera.sql): misma definición, mismas cifras.
//
// FUERA DE VENTA = lo que [Inv Actual] deja fuera por estar en un almacén exclusivo de
// "Inventario" (destrucción, paqueterías, reparaciones, producción…). El resumen por
// almacén se lee de `v_inventario_fuera_venta` (16 filas) y el detalle por SKU se arma
// con las filas en memoria.
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { N } from './constantes';

// Mismo mapeo que el CASE de v_inventario_fuera_venta (si cambia uno, cambiar el otro).
export function motivoDeAlmacen(nombre) {
  const n = String(nombre || '').toUpperCase();
  if (n.includes('DESTRUCCION')) return 'Destrucción';
  if (n.includes('PAQUETERIA')) return 'Paqueterías';
  if (n.includes('REPARACION')) return 'Reparaciones';
  if (n.includes('CENTRO DE SERVICIO')) return 'Centro de servicio';
  if (n.includes('PRODUCCION')) return 'Producción';
  if (n.includes('DIFERENCIA')) return 'Diferencias de inventario';
  if (n.includes('REFACTURACION')) return 'Refacturación';
  if (n.includes('ROBO')) return 'Robo';
  if (n.includes('REMISION')) return 'Remisiones';
  if (n.includes('MUESTRA')) return 'Muestras';
  if (n.includes('DEVOLUCION')) return 'Devoluciones';
  if (n.includes('STOCK ROTATION')) return 'Stock rotation';
  return 'Otro';
}

/** Totales de una lista de almacenes fuera de venta. */
export function totalFuera(rows) {
  return (rows || []).reduce((t, r) => ({
    piezas: t.piezas + N(r.piezas),
    valor: t.valor + N(r.valor),
    almacenes: t.almacenes + 1,
  }), { piezas: 0, valor: 0, almacenes: 0 });
}

/** Top SKUs de un almacén fuera de venta, desde las filas SKU × almacén en memoria. */
export function topSkusDeAlmacen(filas, almacen, descripciones, limite = 12) {
  const m = new Map();
  (filas || []).forEach((r) => {
    if (Number(r.no_almacen) !== Number(almacen) || !r.articulo) return;
    const it = m.get(r.articulo) || { sku: r.articulo, piezas: 0, valor: 0 };
    it.piezas += N(r.inventario);
    it.valor += N(r.costoinventario);
    m.set(r.articulo, it);
  });
  return Array.from(m.values())
    .filter((r) => r.piezas !== 0 || r.valor !== 0)
    .map((r) => ({ ...r, descripcion: descripciones?.get(r.sku)?.descripcion || '', marca: descripciones?.get(r.sku)?.marca || '' }))
    .sort((a, b) => b.valor - a.valor || b.piezas - a.piezas)
    .slice(0, limite);
}

/** Top SKUs con inventario apartado, a partir de las filas ya agregadas por SKU. */
export function topApartado(skuRows, limite = 50) {
  return (skuRows || [])
    .filter((r) => r.totalRes > 0)
    .map((r) => ({
      sku: r.sku, descripcion: r.descripcion, marca: r.marca,
      apartado: r.totalRes, disponible: r.totalDisp, total: r.totalPz,
      valor: N(r.valorRes),
      pct: r.totalPz > 0 ? (r.totalRes / r.totalPz) * 100 : 0,
    }))
    .sort((a, b) => b.valor - a.valor || b.apartado - a.apartado)
    .slice(0, limite);
}

/** Resumen por almacén del inventario fuera de venta (v_inventario_fuera_venta, 16 filas). */
export function useFueraDeVenta() {
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const { cachedQuery } = await import('../../../lib/queries');
        const { data } = await cachedQuery(
          supabase.from('v_inventario_fuera_venta').select('almacen, nombre, motivo, piezas, valor, skus'),
        );
        if (!cancel) setFilas((data || []).map((r) => ({ ...r, piezas: N(r.piezas), valor: N(r.valor), skus: N(r.skus) })).sort((a, b) => b.valor - a.valor));
      } catch (e) {
        console.warn('[InventarioGlobal] v_inventario_fuera_venta', e);
        if (!cancel) setFilas([]);
      } finally {
        if (!cancel) setCargando(false);
      }
    })();
    return () => { cancel = true; };
  }, []);
  return { filas, cargando };
}
