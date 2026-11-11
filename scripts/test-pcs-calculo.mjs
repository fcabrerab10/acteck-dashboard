import test from 'node:test';
import assert from 'node:assert/strict';
import { entregaEstimada, avisosTarima, costoVigente, historialCostos, pedidos, resumen, filasModelos, capacidad, etapaDe, frase } from '../src/modules/comercial/pcs/calculo.js';

test('entrega estimada: 120 equipos aceptados el lunes se producen martes y miércoles y llegan 3 hábiles después', () => {
  const e = entregaEstimada('2026-11-09', 120); // lunes
  assert.equal(e.diasProduccion, 2);
  assert.equal(e.finProduccion, '2026-11-11');
  assert.equal(e.entrega, '2026-11-16'); // jue, vie, lun
});

test('avisos de tarima', () => {
  assert.deepEqual(avisosTarima([{ sku_modelo: 'A', equipos: 60 }]), []);
  assert.equal(avisosTarima([{ sku_modelo: 'A', equipos: 50 }]).length, 1);
  assert.ok(avisosTarima([{ sku_modelo: 'A', equipos: 30 }, { sku_modelo: 'B', equipos: 30 }]).some((t) => t.includes('2 tarimas')));
  assert.deepEqual(avisosTarima([{ sku_modelo: 'A', equipos: 60 }, { sku_modelo: 'B', equipos: 60 }]), []);
});

const costos = [
  { sku_modelo: 'A', vigente_desde: '2026-10-01', costo: 4000, created_at: '1', desglose: [{ descripcion: 'Procesador', costo: 1500 }, { descripcion: 'Memoria', costo: 500 }] },
  { sku_modelo: 'A', vigente_desde: '2026-11-01', costo: 4200, created_at: '2', desglose: [{ descripcion: 'Procesador', costo: 1500 }, { descripcion: 'Memoria', costo: 700 }] },
];

test('costo vigente e historial con cambio por componente', () => {
  assert.equal(costoVigente(costos, 'A', '2026-10-15').costo, 4000);
  assert.equal(costoVigente(costos, 'A', '2026-11-11').costo, 4200);
  assert.equal(costoVigente(costos, 'A', '2026-09-01'), null);
  const h = historialCostos(costos, 'A');
  assert.equal(h[0].delta, 200);
  assert.equal(h[0].deltaPct, 5);
  assert.equal(h[0].desglose.find((d) => d.descripcion === 'Memoria').delta, 200);
  assert.equal(h[0].desglose.find((d) => d.descripcion === 'Procesador').delta, 0);
  assert.equal(h[1].delta, null);
});

const ordenes = [
  { id: 'o1', fecha: '2026-10-05', cliente: 'CVA', estado: 'entregada', factura_cliente: 'F1', factura_cliente_vence: '2026-11-01', factura_decme: 'D1', factura_decme_monto: 240000 },
  { id: 'o2', fecha: '2026-11-09', cliente: 'CT', estado: 'produccion' },
  { id: 'o3', fecha: '2026-10-01', cliente: 'CVA', estado: 'entregada', factura_cliente: 'F0', cobrado_at: '2026-11-02', pagado_decme_at: '2026-10-20' },
  { id: 'o4', fecha: '2026-10-02', cliente: 'X', estado: 'cancelada' },
];
const lineas = [
  { orden_id: 'o1', sku_modelo: 'A', equipos: 60, precio: 5000 },
  { orden_id: 'o2', sku_modelo: 'A', equipos: 120, precio: 5000 },
  { orden_id: 'o3', sku_modelo: 'A', equipos: 60, precio: 5000, costo: 3900 },
  { orden_id: 'o4', sku_modelo: 'A', equipos: 60, precio: 5000 },
];

test('pedidos y resumen: etapas, cobranza vencida, por pagar y margen recalculado sobre totales', () => {
  const p = pedidos({ ordenes, lineas, costos }, '2026-11-11');
  const o1 = p.find((x) => x.id === 'o1');
  assert.equal(o1.etapa, 'facturada');
  assert.equal(o1.cobroVencido, 10);
  assert.equal(o1.costo, 240000); // costo vigente al 5-oct = 4000
  assert.equal(etapaDe(ordenes[2]), 'cobrada');
  const r = resumen(p, '2026-11-11');
  assert.equal(r.pedidos, 3);
  assert.equal(r.equipos, 240);
  assert.equal(r.venta, 1200000);
  assert.equal(r.porCobrar, 300000);
  assert.equal(r.vencido, 300000);
  assert.equal(r.cobrado, 300000);
  assert.equal(r.porPagar, 240000); // o1 facturada por DECME; o2 aún sin factura
  assert.equal(r.enProduccion, 120);
  // utilidad: o1 60k, o2 120×(5000−4200)=96k, o3 66k
  assert.equal(r.utilidad, 222000);
  assert.equal(Math.round(r.margen * 10) / 10, 18.5);
  assert.equal(r.etapas.produccion, 1);
  assert.equal(r.siguiente.id, 'o2');
  assert.match(frase(r), /240 equipos vendidos en 3 pedidos/);
});

test('modelos y capacidad de componentes propios', () => {
  const p = pedidos({ ordenes, lineas, costos }, '2026-11-11');
  const m = filasModelos({ modelos: [{ sku: 'A', procesador: 'Ryzen 5', memoria: '8 GB', orden: 1 }, { sku: 'B', orden: 2 }], costos, precios: { A: 5250 }, ventas: [{ sku: 'A', piezas: 60, monto: 300000 }] }, p, '2026-11-11');
  assert.equal(m[0].config, 'Ryzen 5 · 8 GB');
  assert.equal(m[0].pedidos, 240);
  assert.equal(m[0].facturados, 60);
  assert.equal(m[0].margen, 20);
  assert.equal(m[0].deltaCosto, 200);
  assert.equal(m[1].margen, null);
  const c = capacidad({ componentes: [{ sku_modelo: 'A', sku_propio: 'AC-1', tipo: 'gabinete', descripcion: 'Gabinete', cantidad: 1 }], inventario: { 'AC-1': 310 }, transito: { 'AC-1': { eta: '2026-11-21', cantidad: 600 } } }, p);
  assert.equal(c[0].usados, 240);
  assert.equal(c[0].tarimas, 5);
  assert.equal(c[0].tono, 'orange');
  assert.equal(c[0].llega, '2026-11-21');
});
