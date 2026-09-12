// node scripts/test-medidas.mjs — pruebas de src/lib/medidas.js (sin dependencias).
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  N, Nn, divide, aPct, sumar, derivadas, agregar,
  diasInventario, vueltasInventario, invTotal, inventarioDesdeVista,
  cuotas, mesesCerrados, tooltip, etiqueta, ETIQUETA, FORMULA,
} from '../src/lib/medidas.js';

// Agosto 2026 real (v_medidas_ventas_mes, validado contra Supabase 2026-09-12).
const AGO = {
  anio: 2026, mes: 8,
  fact_bruta: 42624033, devoluciones: -3537867, rmas: -443542, bonificaciones: -5353435,
  fact_neta: 39086166, venta_neta: 33289189,
  costo_fact_bruta: 27824552, costo_devoluciones: -1908133, costo_rmas: -278466,
  costo_fact_neta: 25919286, costo_venta_neta: 25640820,
  contribucion: 13166880, contribucion_bruta: 14799481, utilidad_comercial: 7648369,
  perdida_devoluciones: -1629734, perdida_rmas: -165076,
  piezas_venta_neta: 107854,
  cuota_venta: 59214812, cuota_minima: 55000000, cuota_piezas: null, cuota_costo: null, cuota_contribucion: null,
};

test('N / Nn / divide', () => {
  assert.equal(N(null), 0); assert.equal(N('12.5'), 12.5); assert.equal(N('x'), 0);
  assert.equal(Nn(null), null); assert.equal(Nn(''), null); assert.equal(Nn('x'), null); assert.equal(Nn(0), 0);
  assert.equal(divide(10, 0), null, 'DIVIDE con denominador 0 → null, nunca Infinity');
  assert.equal(divide(10, null), null);
  assert.equal(divide(null, 10), null);
  assert.equal(divide(10, 4), 2.5);
  assert.equal(divide(10, 0, 0), 0, 'alt explícito');
  assert.equal(aPct(0.3369), 33.69);
  assert.equal(aPct(null), null);
});

test('derivadas reproducen las medidas del director de agosto 2026', () => {
  const d = derivadas(AGO);
  assert.equal(Math.round(d.pct_mc * 100) / 100, 33.69, '% MC = Contribucion / Fact Neta');
  assert.equal(Math.round(d.pct_muc * 100) / 100, 22.98, '% MUC = Utilidad Comercial / Venta Neta');
  assert.equal(Math.round(d.pct_mc_bruta * 100) / 100, 34.72, '% MC Bruta');
  assert.equal(Math.round(d.ticket_promedio * 100) / 100, 308.65, 'Ticket Promedio');
  assert.equal(Math.round(d.pct_alcance_venta * 10) / 10, 66.0, '% Alcance Venta');
  assert.equal(d.diferencia_cuota, AGO.fact_neta - AGO.cuota_venta, '+/- $ Venta');
  assert.equal(d.pct_alcance_piezas, null, 'sin Cuota Piezas cargada → null, no 0');
  assert.equal(d.deficit_contribucion, null, 'sin Cuota Contribucion → null');
});

test('los % NUNCA se promedian: se recalculan al agregar', () => {
  const jul = { ...AGO, fact_neta: 54217113, contribucion: 17293141, fact_bruta: 56435883, venta_neta: 49134300, utilidad_comercial: 12420526, piezas_venta_neta: 187388, cuota_venta: 50000000 };
  const t = agregar([AGO, jul]);
  const mcCorrecto = ((AGO.contribucion + jul.contribucion) / (AGO.fact_neta + jul.fact_neta)) * 100;
  const mcPromedioMalo = (derivadas(AGO).pct_mc + derivadas(jul).pct_mc) / 2;
  assert.equal(t.pct_mc, mcCorrecto);
  assert.notEqual(Math.round(t.pct_mc * 1000), Math.round(mcPromedioMalo * 1000), 'ratio de sumas ≠ promedio de ratios');
  assert.equal(t.fact_neta, AGO.fact_neta + jul.fact_neta);
});

test('sumar: cuota sin ningún dato queda null (nunca 0)', () => {
  const t = sumar([AGO, { ...AGO, cuota_venta: null }]);
  assert.equal(t.cuota_piezas, null, 'ninguna fila trae cuota_piezas → null');
  assert.equal(t.cuota_venta, AGO.cuota_venta, 'al menos una fila con dato → suma');
  const vacio = sumar([{ fact_neta: 1 }, { fact_neta: 2 }]);
  assert.equal(vacio.cuota_venta, null);
  assert.equal(vacio.fact_neta, 3);
});

test('sumar con filtro (YTD vs mes)', () => {
  const filas = [{ mes: 7, fact_neta: 10 }, { mes: 8, fact_neta: 20 }, { mes: 9, fact_neta: 5 }];
  assert.equal(sumar(filas, (r) => r.mes <= 8).fact_neta, 30);
  assert.equal(sumar(filas, (r) => r.mes === 8).fact_neta, 20);
});

test('Dias de Inv = Inv Actual / CV 3 meses × 90', () => {
  const inv = 143334891, cv3 = 91374985;
  assert.equal(Math.round(diasInventario(inv, cv3) * 10) / 10, 141.2);
  assert.equal(diasInventario(inv, 0), null, 'sin ritmo → null, no Infinity');
  assert.equal(diasInventario(null, cv3), null);
  assert.equal(Math.round(diasInventario(inv, cv3, 30) * 10) / 10, 47.1, 'base parametrizable');
});

test('Inv Total y Vueltas', () => {
  assert.equal(invTotal(100, 50), 150);
  assert.equal(invTotal(null, null), null);
  assert.equal(invTotal(100, null), 100);
  assert.equal(vueltasInventario(253922203, 144939254.785), 253922203 / 144939254.785);
  assert.equal(vueltasInventario(100, 0), null);
});

test('inventarioDesdeVista normaliza strings de PostgREST', () => {
  const o = inventarioDesdeVista({ inv_actual: '143334891', dias_inv: '141.18', skus_con_stock: 1021, actualizado: '2026-09-12T01:29:16Z' });
  assert.equal(o.inv_actual, 143334891);
  assert.equal(Math.round(o.dias_inv), 141);
  assert.equal(o.inv_total, null, 'columna ausente → null, no 0');
  assert.equal(inventarioDesdeVista(null), null);
});

test('cuotas: cuotas_canales TOTAL manda sobre cuotas_mensuales', () => {
  const canales = [{ dimension_tipo: 'TOTAL', meta_facturacion: 1200 }];
  const mensuales = [{ mes: 1, cuota_ideal: 500 }, { mes: 2, cuota_ideal: 700 }];
  const c = cuotas(canales, mensuales);
  assert.equal(c.mes(1), 100);
  assert.equal(c.hasta(3), 300);
  assert.equal(c.fuente, 'cuotas_canales');
  const s = cuotas([], mensuales);
  assert.equal(s.mes(2), 700);
  assert.equal(s.hasta(2), 1200);
  assert.equal(s.mes(5), null, 'mes sin cuota → null, no 0');
  assert.equal(s.fuente, 'cuotas_mensuales');
  assert.equal(cuotas([], [{ mes: 3, cuota_min: 90 }]).mes(3), 90, 'cae a cuota_min si no hay ideal');
});

test('mesesCerrados nunca incluye el mes en curso y cruza el año', () => {
  assert.deepEqual(mesesCerrados(2026, 9), [{ anio: 2026, mes: 6 }, { anio: 2026, mes: 7 }, { anio: 2026, mes: 8 }]);
  assert.deepEqual(mesesCerrados(2026, 2), [{ anio: 2025, mes: 11 }, { anio: 2025, mes: 12 }, { anio: 2026, mes: 1 }]);
  assert.equal(mesesCerrados(2026, 9).some((x) => x.mes === 9), false);
});

test('etiquetas y tooltips oficiales', () => {
  assert.equal(etiqueta('pct_mc'), '% MC');
  assert.equal(etiqueta('inv_actual'), 'Inv Actual');
  assert.equal(tooltip('dias_inv'), 'Medida: Dias de Inv · Inv Actual / CV Ultimos 3 Meses × 90');
  assert.equal(tooltip('fact_neta', 'YTD 2026'), 'Medida: Fact Neta · Fact Bruta + Devoluciones · YTD 2026');
  assert.equal(etiqueta('no_existe'), 'no_existe');
  for (const k of Object.keys(FORMULA)) assert.ok(ETIQUETA[k], `falta ETIQUETA para ${k}`);
});
