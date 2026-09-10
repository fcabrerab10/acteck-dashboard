// Digitalife · sell out histórico (hoja "Sellout Digitalife") → sellout_detalle y
// snapshot semanal de inventario (Hoja39) → inventario_cliente.
import { XLSX, objSnake, toStr, toNum, toInt, toISODate, hash, primeraHoja, semanaSnapshot } from './_util';

// opts.historico = true → el archivo es el histórico completo: se reemplaza todo el
// sell out del cliente (deleteCliente → import-central borra cliente=digitalife) antes de insertar.
export function digitalifeSellout(wb, fileName, opts = {}) {
  const sh = primeraHoja(wb, 'Sellout Digitalife', 'Hoja40');
  const rows = XLSX().utils.sheet_to_json(sh, { defval: null });
  const out = rows.map((r) => {
    const obj = objSnake(r);
    const o = {
      cliente: 'digitalife', fecha: toISODate(obj.fecha), marca: toStr(obj.marca),
      no_parte: toStr(obj.no_parte ?? obj.noparte ?? obj.parte),
      descripcion: toStr(obj.descripcion ?? obj.descripcion_1 ?? obj.titulo),
      cantidad: toNum(obj.cantidad), precio: toNum(obj.precio), descuento: toNum(obj.descuento), iva: toNum(obj.iva),
      subtotal: toNum(obj.subtotal), total: toNum(obj.total),
    };
    if (!o.fecha || !o.no_parte) return null;
    o.row_hash = hash([o.fecha, o.no_parte, o.cantidad, o.total].join('|'));
    return o;
  }).filter(Boolean);
  const fechas = out.map((r) => r.fecha).sort();
  return {
    table: 'sellout_detalle', onConflict: 'cliente,fecha,no_parte,row_hash', rows: out,
    deleteCliente: opts.historico ? 'digitalife' : null,
    recalc: ['sellout_sku'],
    resumen: `${out.length} ventas${fechas.length ? ` · ${fechas[0]} → ${fechas[fechas.length - 1]}` : ''}${opts.historico ? ' · reemplaza el histórico' : ''}`,
  };
}

export function digitalifeInv(wb) {
  const sh = primeraHoja(wb, 'Hoja39');
  const rows = XLSX().utils.sheet_to_json(sh, { defval: null });
  const { anio, semana } = semanaSnapshot();
  const out = rows.map((r) => {
    const obj = objSnake(r);
    return {
      cliente: 'digitalife', sku: toStr(obj.parte ?? obj.sku ?? obj.no_parte), anio, semana,
      marca: toStr(obj.marca), titulo: toStr(obj.titulo ?? obj.descripcion),
      stock: toInt(obj.stock ?? obj.inventario), costo_convenio: toNum(obj.costo_convenio), precio_venta: toNum(obj.precio_venta),
      fecha_ultima_venta: toISODate(obj.fecha_ultima_venta), dias_sin_venta: toNum(obj.dias_sin_venta), valor: toNum(obj.valor),
    };
  }).filter((r) => r.sku);
  return { table: 'inventario_cliente', onConflict: 'cliente,sku,anio,semana', rows: out, resumen: `${out.length} SKUs · semana ${semana}/${anio}` };
}
