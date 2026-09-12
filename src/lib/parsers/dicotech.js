// Dicotech · CSVs semanales del correo de Revko.
//   · dicotechSelloutSemanal: "Reporte-SellOut_Ventas Semanal Acteck_Revko.csv" → sellout_detalle
//   · dicotechInventario:      "Reporte-Inventario_Inventario Acteck Semanal.csv" → inventario_cliente
//     (agregado por SKU) + inventario_cliente_sucursal (desglose por almacén) en una sola carga.
//
// Mapeo del CSV (formato vigente desde ago-2026; entre paréntesis el nombre viejo, que
// se sigue aceptando para poder recargar archivos anteriores):
//   Fecha                     → fecha            (se lee con raw:true; con raw:false SheetJS
//                                                 reformatea la fecha en hora local y resta un día)
//   Venta                     → folio, sólo para el row_hash
//   Numero de parte           → no_parte         (SKU canónico AC-…/BR-…; la columna `Clave` ya no viene)
//   Cantidad                  → cantidad
//   precio_venta_antes_IVA    → precio           (SIN IVA)
//   total_venta_antes_IVA     → subtotal = total (SIN IVA; si no viene, cantidad × precio − descuento)
//   Marca, Descripcion        → marca, descripcion
//   Subfamilia (Familia)      → linea informativa: sellout_detalle no tiene columna, se descarta
//   (total_venta)             → ya NO se usa: todo el sell out del dashboard va SIN IVA
//
// Todo el sell-out del dashboard está en base SIN IVA (decisión 2026-09-12), por eso
// `subtotal` = `total` = total_venta_antes_IVA e `iva` = 0.
//
// row_hash DETERMINISTA: hash(REVKO|folio|sku|fecha|cantidad|precio). Sin índice de fila,
// así que recargar el mismo CSV (o un CSV mensual que traslapa a los semanales) sobrescribe
// en vez de duplicar. Es el mismo criterio que usa revkoSellout para sellout_general.
import { XLSX, objSnake, toStr, toNum, toInt, toISODate, hash, semanaDeCorte } from './_util';

/** hash estable de una venta de Revko; lo usan el parser y los scripts de recarga. */
export const hashVentaRevko = ({ folio, sku, fecha, cantidad, precio }) =>
  hash(['REVKO', folio ?? '', sku ?? '', fecha ?? '', cantidad ?? '', precio ?? ''].join('|'));

export function dicotechSelloutSemanal(wb) {
  const sh = wb.Sheets[wb.SheetNames[0]];
  // raw:true → las fechas llegan como Date en UTC (o como texto ISO) y no se desplazan un día.
  const rows = XLSX().utils.sheet_to_json(sh, { defval: null, raw: true });
  const out = rows.map((r) => {
    const fecha = toISODate(r['Fecha']);
    const noParte = (toStr(r['Numero de parte']) || '').toUpperCase() || null;
    if (!fecha || !noParte) return null;
    const cantidad = toNum(r['Cantidad']);
    const precio = toNum(r['precio_venta_antes_IVA']);
    const descuento = toNum(r['Descuento'] ?? r['descuento']) || 0;
    // El monto canónico es SIN IVA. Si la columna no viene, se reconstruye cantidad × precio − descuento.
    let neto = toNum(r['total_venta_antes_IVA']);
    if (neto == null && cantidad != null && precio != null) neto = Math.round((cantidad * precio - descuento) * 10000) / 10000;
    return {
      cliente: 'dicotech', fecha, marca: toStr(r['Marca']), no_parte: noParte, descripcion: toStr(r['Descripcion']),
      cantidad, precio, descuento: 0, iva: 0, subtotal: neto, total: neto,
      row_hash: hashVentaRevko({ folio: toStr(r['Venta']), sku: noParte, fecha, cantidad, precio }),
    };
  }).filter(Boolean);
  const fechas = out.map((r) => r.fecha).sort();
  const sinMonto = out.filter((r) => r.subtotal == null).length;
  return {
    table: 'sellout_detalle', onConflict: 'cliente,fecha,no_parte,row_hash', rows: out, recalc: ['sellout_sku'],
    resumen: `${out.length} ventas sin IVA${fechas.length ? ` · ${fechas[0]} → ${fechas[fechas.length - 1]}` : ''}${sinMonto ? ` · ${sinMonto} sin monto` : ''}`,
  };
}

// Almacenes de Dicotech; si agregan uno, basta con sumarlo aquí (y su etiqueta en MAP_SUCURSAL).
const ALMACENES = ['dc', 'arboledas', 'amazon', 'dicoags2', 'guadalajara', 'zacatecas', 'santafe', 'leon2'];
const MAP_SUCURSAL = { dc: 'DC', arboledas: 'Arboledas', amazon: 'AMAZON', dicoags2: 'dicoags2', guadalajara: 'GDL', zacatecas: 'ZACATECAS', santafe: 'santafe', leon2: 'leon2' };

export function dicotechInventario(wb, fileName, opts = {}) {
  const sh = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX().utils.sheet_to_json(sh, { defval: null, raw: true });
  const objs = rows.map(objSnake);
  // La semana sale del corte (fecha elegida en el importador / nombre / fecha del archivo),
  // nunca del día en que se sube.
  const { anio, semana } = semanaDeCorte(opts, {
    fileName,
    fechasDatos: objs.map((o) => toISODate(o.fecha_ultima_factura)).filter(Boolean),
  });
  const agregado = [], sucursales = [];
  for (const obj of objs) {
    const sku = toStr(obj.numero_de_parte ?? obj.no_de_parte ?? obj.parte ?? obj.sku);
    if (!sku) continue;
    const costo = toNum(obj.costo_compra_antes_iva ?? obj.costo);
    const marca = toStr(obj.marca), titulo = toStr(obj.descripcion ?? obj.titulo);
    const stockTotal = ALMACENES.reduce((acc, k) => acc + (toInt(obj[k]) || 0), 0);
    agregado.push({
      cliente: 'dicotech', sku, anio, semana, marca, titulo, stock: stockTotal, costo_convenio: costo, precio_venta: null,
      fecha_ultima_venta: toISODate(obj.fecha_ultima_factura ?? obj.fecha_ultima_venta), dias_sin_venta: null,
      valor: costo != null ? Math.round(stockTotal * costo * 100) / 100 : null,
    });
    for (const [alm, sucursal] of Object.entries(MAP_SUCURSAL)) {
      const stock = toInt(obj[alm]) || 0;
      if (stock <= 0) continue;
      sucursales.push({ cliente: 'dicotech', sku, sucursal, anio, semana, marca, titulo, stock, costo_convenio: costo, valor: costo != null ? Math.round(stock * costo * 100) / 100 : null });
    }
  }
  return [
    { table: 'inventario_cliente', onConflict: 'cliente,sku,anio,semana', rows: agregado, periodo: { anio, semana }, resumen: `${agregado.length} SKUs · semana ${semana}/${anio}` },
    { table: 'inventario_cliente_sucursal', onConflict: 'cliente,sku,sucursal,anio,semana', rows: sucursales, periodo: { anio, semana }, resumen: `${sucursales.length} filas por sucursal` },
  ];
}
