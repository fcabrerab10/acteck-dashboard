// «<Cuenta> frente al resto» · pruebas del cálculo puro.
//   node --test scripts/test-sellout-oportunidades.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { paresDe, oportunidades, ranking, pesoEnCanal, clientesNuevosPerdidos } from '../src/modules/comercial/sellout/oportunidades.js';

const CUENTAS = [
  { cuenta: 'cva', canal_sellout: 'mayoreo', tiene_sellout: true },
  { cuenta: 'ct', canal_sellout: 'mayoreo', tiene_sellout: true },
  { cuenta: 'ingram', canal_sellout: 'mayoreo', tiene_sellout: true },
  { cuenta: 'ingram_retail', canal_sellout: 'mayoreo', tiene_sellout: false },
  { cuenta: 'guc', canal_sellout: 'mayoreo', tiene_sellout: true },
  { cuenta: 'digitalife', canal_sellout: 'distribuidor', tiene_sellout: true },
  { cuenta: 'directo', canal_sellout: 'directo', tiene_sellout: true },
];
const MESES = [{ anio: 2026, mes: 7 }, { anio: 2026, mes: 8 }, { anio: 2026, mes: 9 }];
const fila = (cuenta, mes, sku, cantidad, importe = cantidad * 1000) => ({ cuenta, anio: 2026, mes, sku, marca: 'ACTECK', categoria: 'Monitores', cantidad, importe });
const SKU = [
  // BR-942539: lo mueven ct, ingram y guc; cva no → oportunidad grande
  fila('ct', 7, 'BR-942539', 300), fila('ct', 8, 'BR-942539', 300), fila('ct', 9, 'BR-942539', 336),
  fila('ingram', 8, 'BR-942539', 0, 0), fila('ingram', 9, 'BR-942539', 100),
  fila('guc', 7, 'BR-942539', 50),
  // AC-945936: sólo ct → no llega a 2 pares
  fila('ct', 9, 'AC-945936', 280),
  // BR-943857: ct + guc, pero cva SÍ lo vende → fuera
  fila('ct', 9, 'BR-943857', 90), fila('guc', 9, 'BR-943857', 60), fila('cva', 9, 'BR-943857', 10),
  // AC-936378: ct + ingram, cva no lo vende pero lo tiene en inventario → fuera
  fila('ct', 9, 'AC-936378', 70), fila('ingram', 9, 'AC-936378', 80),
  // fuera de la ventana (junio) no cuenta
  fila('ct', 6, 'AC-999999', 500), fila('guc', 6, 'AC-999999', 500),
  // digitalife no es par de cva (otro canal)
  fila('digitalife', 9, 'AC-888888', 400), fila('directo', 9, 'AC-888888', 400),
];
const INV = [{ sku: 'AC-936378', stock: 12 }, { sku: 'BR-942539', stock: 0 }];

test('paresDe · mismo canal, con fuente, sin la propia ni directo', () => {
  assert.deepEqual(paresDe(CUENTAS, 'cva'), ['ct', 'ingram', 'guc']);
  assert.deepEqual(paresDe(CUENTAS, 'digitalife'), []);
  assert.deepEqual(paresDe(CUENTAS, 'nadie'), []);
});

test('oportunidades · SKUs que mueven ≥ 2 pares y la cuenta no vende ni tiene', () => {
  const r = oportunidades({ skuMes: SKU, cuenta: 'cva', pares: paresDe(CUENTAS, 'cva'), meses: MESES, inventario: INV });
  assert.equal(r.total, 1);
  assert.equal(r.lista[0].sku, 'BR-942539');
  assert.equal(Math.round(r.lista[0].pzMes), 362, '(300+300+336+100+50)/3');
  assert.equal(r.lista[0].nPares, 3); assert.equal(r.lista[0].dePares, 3);
  assert.equal(Math.round(r.importeMes), 362000);
  // Sin inventario, AC-936378 entra (ct + ingram) y queda detrás por piezas.
  const r2 = oportunidades({ skuMes: SKU, cuenta: 'cva', pares: paresDe(CUENTAS, 'cva'), meses: MESES });
  assert.deepEqual(r2.lista.map((f) => f.sku), ['BR-942539', 'AC-936378']);
  assert.equal(r2.lista[1].nPares, 2);
  // top recorta y el total no
  const r3 = oportunidades({ skuMes: SKU, cuenta: 'cva', pares: paresDe(CUENTAS, 'cva'), meses: MESES, top: 1 });
  assert.equal(r3.lista.length, 1); assert.equal(r3.total, 2);
  assert.deepEqual(oportunidades({ skuMes: [], cuenta: 'cva', pares: [], meses: MESES }).lista, []);
});

const FILAS = [
  { cuenta: 'ct', canal: 'mayoreo', importe: 900, importePrev: 800, sellIn: 1000, soSi: 90 },
  { cuenta: 'cva', canal: 'mayoreo', importe: 620, importePrev: 500, sellIn: 480, soSi: 129 },
  { cuenta: 'ingram', canal: 'mayoreo', importe: 400, importePrev: 450, sellIn: 500, soSi: 80 },
  { cuenta: 'ingram_retail', canal: 'mayoreo', importe: 0, importePrev: 0, sellIn: 700, soSi: null, sinFuente: true },
  { cuenta: 'guc', canal: 'mayoreo', importe: 300, importePrev: 350, sellIn: 300, soSi: 100 },
  { cuenta: 'digitalife', canal: 'distribuidor', importe: 1500, importePrev: 1400, sellIn: 1000, soSi: 150 },
];

test('ranking · posición entre las cuentas con fuente', () => {
  assert.deepEqual(ranking(FILAS, 'cva'), { pos: 3, de: 5 });
  assert.deepEqual(ranking(FILAS, 'digitalife'), { pos: 1, de: 5 });
  assert.equal(ranking(FILAS, 'ingram_retail').pos, null, 'sin fuente no se rankea');
});

test('pesoEnCanal · % del canal, Δ pp y SO/SI del resto del canal', () => {
  const p = pesoEnCanal(FILAS, 'cva');
  assert.equal(p.canal, 'mayoreo');
  assert.equal(Math.round(p.pct * 10) / 10, 27.9, '620 / 2220');
  assert.equal(Math.round(p.pctPrev * 10) / 10, 23.8, '500 / 2100');
  assert.equal(Math.round(p.deltaPp * 10) / 10, 4.1);
  assert.equal(Math.round(p.soSiCanal), 89, '(900+400+300)/(1000+500+300) sin la cuenta ni la que no reporta');
  assert.equal(p.soSi, 129);
  assert.equal(p.cuentasCanal, 4);
  assert.equal(pesoEnCanal(FILAS, 'nadie').pct, null);
});

test('clientesNuevosPerdidos · nuevo = sin compra en la ventana; perdido = compró el mes anterior y no éste', () => {
  const cf = [
    { anio: 2026, mes: 10, cliente_final: 'Soluciones Tec', importe: 41000 },
    { anio: 2026, mes: 10, cliente_final: 'PC Mart', importe: 29000 }, { anio: 2026, mes: 9, cliente_final: 'PC Mart', importe: 20000 },
    { anio: 2026, mes: 10, cliente_final: 'Compu GDL', importe: 18000 }, { anio: 2026, mes: 6, cliente_final: 'Compu GDL', importe: 9000 },
    { anio: 2026, mes: 9, cliente_final: 'Perdido SA', importe: 12000 },
    { anio: 2026, mes: 10, cliente_final: 'Volvio', importe: 5000 }, { anio: 2025, mes: 10, cliente_final: 'Volvio', importe: 5000 },
  ];
  const r = clientesNuevosPerdidos(cf, 2026, 10, 6);
  assert.deepEqual(r.nuevos.map((x) => x.cliente), ['Soluciones Tec', 'Volvio'], 'Volvió compró hace 12 meses: fuera de la ventana de 6, cuenta como nuevo');
  assert.equal(r.nuevosImporte, 46000);
  assert.deepEqual(r.perdidos.map((x) => x.cliente), ['Perdido SA']);
  assert.equal(r.perdidosImporte, 12000);
  assert.ok(!r.nuevos.some((x) => x.cliente === 'Compu GDL'), 'compró en junio: no es nuevo');
});
