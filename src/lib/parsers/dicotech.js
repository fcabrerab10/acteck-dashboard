// Dicotech · CSVs semanales del correo de Revko.
//   · dicotechSelloutSemanal: "Reporte-SellOut_Ventas Semanal Acteck_Revko.csv" → sellout_detalle
//   · dicotechInventario:      "Reporte-Inventario_Inventario Acteck Semanal.csv" → inventario_cliente
//     (agregado por SKU) + inventario_cliente_sucursal (desglose por almacén) en una sola carga.
import { XLSX, objSnake, toStr, toNum, toInt, toISODate, hash, semanaSnapshot } from './_util';

export function dicotechSelloutSemanal(wb) {
  const sh = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX().utils.sheet_to_json(sh, { defval: null, raw: false });
  const out = rows.map((r, i) => {
    const fecha = toISODate(r['Fecha']);
    const noParte = toStr(r['Numero de parte']);
    if (!fecha || !noParte) return null;
    const cantidad = toNum(r['Cantidad']);
    const totalSinIVA = toNum(r['total_venta_antes_IVA']);
    const totalConIVA = toNum(r['total_venta']);
    return {
      cliente: 'dicotech', fecha, marca: toStr(r['Marca']), no_parte: noParte, descripcion: toStr(r['Descripcion']),
      cantidad, precio: toNum(r['precio_venta_antes_IVA']), descuento: 0, iva: Math.max(0, totalConIVA - totalSinIVA),
      subtotal: totalSinIVA, total: totalConIVA,
      row_hash: hash([r['Venta'], r['Clave'], cantidad, totalSinIVA, i].join('|')),
    };
  }).filter(Boolean);
  const fechas = out.map((r) => r.fecha).sort();
  return {
    table: 'sellout_detalle', onConflict: 'cliente,fecha,no_parte,row_hash', rows: out, recalc: ['sellout_sku'],
    resumen: `${out.length} ventas${fechas.length ? ` · ${fechas[0]} → ${fechas[fechas.length - 1]}` : ''}`,
  };
}

// Almacenes de Dicotech; si agregan uno, basta con sumarlo aquí (y su etiqueta en MAP_SUCURSAL).
const ALMACENES = ['dc', 'arboledas', 'amazon', 'dicoags2', 'guadalajara', 'zacatecas', 'santafe', 'leon2'];
const MAP_SUCURSAL = { dc: 'DC', arboledas: 'Arboledas', amazon: 'AMAZON', dicoags2: 'dicoags2', guadalajara: 'GDL', zacatecas: 'ZACATECAS', santafe: 'santafe', leon2: 'leon2' };

export function dicotechInventario(wb) {
  const sh = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX().utils.sheet_to_json(sh, { defval: null });
  const { anio, semana } = semanaSnapshot();
  const agregado = [], sucursales = [];
  for (const r of rows) {
    const obj = objSnake(r);
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
    { table: 'inventario_cliente', onConflict: 'cliente,sku,anio,semana', rows: agregado, resumen: `${agregado.length} SKUs · semana ${semana}/${anio}` },
    { table: 'inventario_cliente_sucursal', onConflict: 'cliente,sku,sucursal,anio,semana', rows: sucursales, resumen: `${sucursales.length} filas por sucursal` },
  ];
}
