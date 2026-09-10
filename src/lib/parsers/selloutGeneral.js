// Sell out de mayoristas → sellout_general.
//   · selloutGeneral: "Sellout General.xlsx" (Hoja1) — upsert por id de transacción.
//   · revkoSellout: "Reporte-SellOut_Ventas … Acteck_Revko.csv" (ERP Revko). Semanal o
//     mensual; todo mapea a mayorista DICOTECH (idcliente 708). IDs = hash determinista
//     negativo de (Venta+SKU+Fecha+Cantidad): recargar no duplica ni borra otras semanas.
import { XLSX, objSnake, toStr, toNum, toInt, toISODate, primeraHoja } from './_util';

export const MAYORISTAS = {
  183: 'CT INTERNACIONAL', 417: 'CVA', 335: 'GRUPO UNIDADES DE COMPUTO', 683: 'INGRAM MICRO',
  1145: 'ARROBA COMPUTERS', 514: 'TECHS MART', 708: 'DICOTECH', 226: 'EXEL DEL NORTE',
  662: 'DC MAYORISTA', 870: 'GROUP NSSTORE', 676: 'GRUPO LOMA DEL NORTE', 106: 'PCH MAYOREO', 7424: 'INTEGRADORA KABIK',
};

export function selloutGeneral(wb) {
  const sh = primeraHoja(wb, 'Hoja1');
  if (!sh) return { table: 'sellout_general', onConflict: 'id', rows: [] };
  const rows = XLSX().utils.sheet_to_json(sh, { defval: null, raw: false });
  const out = [];
  let sinId = 0;
  for (const r of rows) {
    const obj = objSnake(r);
    const id = toInt(obj.id);
    if (!id) { sinId++; continue; }
    const idcli = toInt(obj.idcliente);
    const fecha = toISODate(obj.fecha);
    let anio = null, mes = null;
    if (fecha) { const [y, m] = fecha.split('-'); anio = parseInt(y, 10); mes = parseInt(m, 10); }
    out.push({
      id, idcliente: idcli, mayorista: MAYORISTAS[idcli] || `MAYORISTA ${idcli}`, fecha, anio, mes,
      sku: toStr(obj.sku), sku_cliente: toStr(obj.sku_cliente), descripcion: toStr(obj.descripcion),
      cliente_codigo: toStr(obj.cliente), cliente_nombre: toStr(obj.clientenombre), cliente_rfc: toStr(obj.clienterfc),
      vendedor: toStr(obj.vendedor), vendedor_nombre: toStr(obj.vendedornombre), almacen: toStr(obj.almacen), sucursal: toStr(obj.sucursal),
      cantidad: toNum(obj.cantidad), precio_unitario: toNum(obj.preciounitario), importe: toNum(obj.importe), factura: toStr(obj.factura),
      marca: toStr(obj.marca), estado: toStr(obj.estado), linea: toStr(obj.linea), moneda: toStr(obj.moneda),
      importe_usd: toNum(obj.importeusd), tipocambio: toNum(obj.tipocambio),
    });
  }
  return { table: 'sellout_general', onConflict: 'id', rows: out, resumen: `${out.length} transacciones${sinId ? ` · ${sinId} sin id descartadas` : ''}` };
}

const hashRevko = (s) => {
  let h1 = 5381, h2 = 52711;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = ((h1 * 31) ^ c) | 0; h2 = ((h2 * 37) ^ c) | 0; }
  return -((Math.abs(h1) * 4194304) + (Math.abs(h2) & 0x3FFFFF)) - 1;
};
const normalizarSucursal = (s) => { if (!s) return s; const u = s.toUpperCase(); return (u === 'AMAZON' || u === 'GDL' || u === 'ZACATECAS') ? u : s; };

export function revkoSellout(wb) {
  const sh = wb.Sheets[wb.SheetNames[0]];
  if (!sh) return { table: 'sellout_general', onConflict: 'id', rows: [] };
  const rows = XLSX().utils.sheet_to_json(sh, { defval: null, raw: false });
  const out = [], idsVistos = new Set(), meses = new Set();
  for (const r of rows) {
    const fecha = toISODate(r['Fecha']);
    if (!fecha) continue;
    const [y, m] = fecha.split('-');
    const anio = parseInt(y, 10), mes = parseInt(m, 10);
    if (!anio || !mes) continue;
    meses.add(`${anio}-${String(mes).padStart(2, '0')}`);
    const venta = toStr(r['Venta']) || '';
    // El SKU canónico es "Numero de parte" (AC-…/BR-…), no la Clave interna del ERP.
    const numParte = (toStr(r['Numero de parte']) || '').toUpperCase();
    const claveInterna = toStr(r['Clave']) || '';
    const cantidad = toNum(r['Cantidad']);
    let id = hashRevko(`REVKO|${venta}|${numParte}|${fecha}|${cantidad ?? ''}`);
    let bump = 0;
    while (idsVistos.has(id)) { bump++; id = hashRevko(`REVKO|${venta}|${numParte}|${fecha}|${cantidad ?? ''}|${bump}`); }
    idsVistos.add(id);
    out.push({
      id, idcliente: 708, mayorista: 'DICOTECH', fecha, anio, mes,
      sku: numParte, sku_cliente: claveInterna, descripcion: toStr(r['Descripcion']),
      cliente_codigo: null, cliente_nombre: toStr(r['Cliente']), cliente_rfc: null,
      vendedor: null, vendedor_nombre: toStr(r['Vendedor']),
      almacen: normalizarSucursal(toStr(r['Sucursal que despacha el inventario'])),
      sucursal: normalizarSucursal(toStr(r['Sucursal que genera venta'])),
      cantidad, precio_unitario: toNum(r['precio_venta_antes_IVA']) || toNum(r['precio_venta']),
      importe: toNum(r['total_venta_antes_IVA']) || toNum(r['total_venta']),
      factura: venta, marca: toStr(r['Marca']), estado: null, linea: toStr(r['Familia']), moneda: toStr(r['Moneda']),
      importe_usd: null, tipocambio: null,
    });
  }
  return { table: 'sellout_general', onConflict: 'id', rows: out, resumen: `${out.length} filas · meses ${[...meses].sort().join(', ')}` };
}
