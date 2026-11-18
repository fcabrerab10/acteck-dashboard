// Libro de Excel de la página de UN cliente del ERP (2026-11-18): salió de PaginaCliente.jsx para que la web (ExportMenu)
// y la ficha del celular (AnalisisFicha · «Exportar Excel») armen exactamente el mismo archivo. Puro, sin React ni red.
// Hojas: Resumen · Sell In por SKU (12 m, fact. neta y piezas; MC % sólo con `verSensible`) · Sell Out por SKU (12 m,
// importe sin IVA y piezas; sólo si el código tiene cuenta de sell out en CUENTA_POR_ERP).
//   cliente      = fila de agregarClientes() (calc.js): { cliente, nombre, mensual: Map, ytd, ytdPrev, ultimaCompra, mesesCompra12 }
//   cuotas       = mapaCuotas() · detalleSku = useDetalleCliente · skuSellOut = useDrillSkus(cuenta) · roadmap = useRoadmap
// Devuelve { titulo, archivo, hojas } para lib/exportar.js (exportarExcel / exportarExcelBlob).
import { CUENTA_POR_ERP } from '../sellout/datos';
import { ultimosMeses, skusDeCuenta } from '../sellout/calculo';
import { MESES, N, idxMes, mcDe, cuotaPeriodo, alcanceCuota } from './calc';
import { moneyFull, int, pct } from './formato';

export function libroCliente({ cliente, anio, mesMax, verSensible = false, cuotas = null, detalleSku = [], skuSellOut = [], roadmap = [] }) {
  const mesLbl = MESES[mesMax - 1];
  const cuentaSellOut = CUENTA_POR_ERP[cliente.cliente] || null;
  const mes = cliente.mensual.get(idxMes(anio, mesMax)) || {}, mesPrev = cliente.mensual.get(idxMes(anio - 1, mesMax)) || {};
  const cuotaYtd = cuotas ? cuotaPeriodo(cuotas, cliente.cliente, anio, mesMax, 'ytd') : null;
  const pctYtd = cuotaYtd == null ? null : alcanceCuota(cliente.ytd.fact_neta, cuotaYtd);
  const rd = new Map((roadmap || []).map((r) => [r.sku, r]));
  const kFin = idxMes(anio, mesMax);
  const meses12 = ultimosMeses(anio, mesMax, 12);
  const colMes = (pref) => meses12.map((m, i) => ({ label: `${MESES[m.mes - 1]} ${String(m.anio).slice(2)}`, key: `${pref}${i}`, tipo: pref === 'p' ? 'numero' : 'moneda', ancho: 11 }));
  // Sell In por SKU: fact. neta y piezas por mes (v_analisis_cliente_sku_mes)
  const si = new Map();
  for (const r of detalleSku || []) {
    const i = idxMes(r.anio, r.mes) - (kFin - 11); if (i < 0 || i > 11) continue;
    const o = si.get(r.articulo) || { sku: r.articulo, descripcion: rd.get(r.articulo)?.descripcion || '', marca: r.marca || '', categoria: rd.get(r.articulo)?.categoria || r.categoria || '', total: 0, piezas: 0, contribucion: 0 };
    o[`m${i}`] = (o[`m${i}`] || 0) + N(r.fact_neta); o[`p${i}`] = (o[`p${i}`] || 0) + N(r.piezas_venta_neta);
    o.total += N(r.fact_neta); o.piezas += N(r.piezas_venta_neta); o.contribucion += N(r.contribucion); si.set(r.articulo, o);
  }
  // La contribución sólo viaja en las filas con permiso sensible (el libro se comparte fuera del dashboard).
  const filasSi = [...si.values()].map(({ contribucion, ...o }) => (verSensible ? { ...o, contribucion, mc: o.total ? (contribucion / o.total) * 100 : null } : o)).sort((a, b) => b.total - a.total);
  const hojas = [{
    nombre: 'Resumen', subtitulo: `${cliente.nombre} · Nº ${cliente.cliente} · ${anio} vs ${anio - 1}`,
    columnas: [{ label: 'Concepto', key: 'k', tipo: 'texto', ancho: 32 }, { label: 'Valor', key: 'v', tipo: 'texto', ancho: 22 }],
    filas: [
      { k: `Fact. neta ${mesLbl} ${anio}`, v: moneyFull(N(mes.fact_neta)) }, { k: `Fact. neta ${mesLbl} ${anio - 1}`, v: moneyFull(N(mesPrev.fact_neta)) },
      { k: `YTD ${anio}`, v: moneyFull(cliente.ytd.fact_neta) }, { k: `YTD ${anio - 1}`, v: moneyFull(cliente.ytdPrev.fact_neta) },
      { k: 'Piezas YTD', v: int(cliente.ytd.piezas_venta_neta) }, { k: 'Cuota YTD', v: cuotaYtd == null ? '—' : `${moneyFull(cuotaYtd)} · ${pct(pctYtd, 0)}` },
      ...(verSensible ? [{ k: '% MC YTD', v: pct(mcDe(cliente.ytd)) }, { k: 'Contribución YTD', v: moneyFull(cliente.ytd.contribucion) }] : []),
      { k: 'Última compra', v: cliente.ultimaCompra ? `${MESES[cliente.ultimaCompra.mes - 1]} ${cliente.ultimaCompra.anio}` : '—' }, { k: 'Meses con compra (12)', v: String(cliente.mesesCompra12) },
      { k: 'Sell out', v: cuentaSellOut ? 'reporta' : 'no reporta' },
    ],
  }, {
    nombre: 'Sell In por SKU', subtitulo: `${filasSi.length} SKUs · últimos 12 meses · fact. neta y piezas`,
    columnas: [
      { label: 'SKU', key: 'sku', tipo: 'texto', ancho: 12 }, { label: 'Descripción', key: 'descripcion', tipo: 'texto', ancho: 40 }, { label: 'Marca', key: 'marca', tipo: 'texto', ancho: 12 }, { label: 'Categoría', key: 'categoria', tipo: 'texto', ancho: 16 },
      ...colMes('m'), { label: 'Total 12 m', key: 'total', tipo: 'moneda', ancho: 14 }, ...colMes('p'), { label: 'Piezas 12 m', key: 'piezas', tipo: 'numero', ancho: 11 },
      ...(verSensible ? [{ label: 'MC %', key: 'mc', tipo: 'pct', ancho: 8 }] : []),
    ],
    filas: filasSi,
  }];
  if (cuentaSellOut) {
    const mesSo = (() => { const con = (skuSellOut || []).filter((r) => N(r.anio) === anio && N(r.importe) > 0).map((r) => N(r.mes)); return con.length ? Math.max(...con) : mesMax; })();
    const m12 = ultimosMeses(anio, mesSo, 12);
    const imp = skusDeCuenta(skuSellOut || [], [], anio, mesSo, 'importe'), pz = new Map(skusDeCuenta(skuSellOut || [], [], anio, mesSo, 'piezas').map((f) => [f.sku, f]));
    const filasSo = imp.map((f) => { const p = pz.get(f.sku); const o = { sku: f.sku, descripcion: rd.get(f.sku)?.descripcion || '', marca: f.marca || '', total: f.total, piezas: p?.total || 0 }; f.meses.forEach((v, i) => { o[`m${i}`] = v; o[`p${i}`] = p?.meses[i] || 0; }); return o; });
    hojas.push({
      nombre: 'Sell Out por SKU', subtitulo: `${filasSo.length} SKUs · últimos 12 meses a ${MESES[mesSo - 1]} ${anio} · importe sin IVA y piezas`,
      columnas: [
        { label: 'SKU', key: 'sku', tipo: 'texto', ancho: 12 }, { label: 'Descripción', key: 'descripcion', tipo: 'texto', ancho: 40 }, { label: 'Marca', key: 'marca', tipo: 'texto', ancho: 12 },
        ...m12.map((m, i) => ({ label: `${MESES[m.mes - 1]} ${String(m.anio).slice(2)}`, key: `m${i}`, tipo: 'moneda', ancho: 11 })), { label: 'Total 12 m', key: 'total', tipo: 'moneda', ancho: 14 },
        ...m12.map((m, i) => ({ label: `${MESES[m.mes - 1]} ${String(m.anio).slice(2)} pz`, key: `p${i}`, tipo: 'numero', ancho: 10 })), { label: 'Piezas 12 m', key: 'piezas', tipo: 'numero', ancho: 11 },
      ],
      filas: filasSo,
    });
  }
  return { titulo: `${cliente.nombre} · ${anio}`, archivo: `Cliente ${cliente.cliente} ${cliente.nombre.slice(0, 30)} ${anio}`, hojas };
}
