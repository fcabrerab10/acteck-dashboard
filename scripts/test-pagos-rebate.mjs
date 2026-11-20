// Rebate: UN solo núcleo (pagosv3/motor.js#rebatePorNiveles + rebateDelPeriodo) para el cierre (cron, api/_pagos.js),
// el panel «Cálculo» (web y celular) y el «rebate en progreso» de la ficha del cliente. Falla si alguien vuelve a
// copiar la regla, y fija las diferencias que se conservaron como parámetros.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import M, { rebatePorNiveles, rebateDelPeriodo, modoRebate, minimoDeRegla, calcularPeriodo } from '../src/modules/comercial/pagosv3/motor.js';
import { REGLAS_DEFAULT } from '../src/modules/comercial/pagosv3/reglas.js';
import { rebateProgreso } from '../src/modules/comercial/pagosv3/progreso.js';
import { bloquesCalculo } from '../src/modules/comercial/pagosv3/calculoPanel.js';

const PCEL = REGLAS_DEFAULT.pcel.rebate, DCT = REGLAS_DEFAULT.dicotech.rebate, DGL = REGLAS_DEFAULT.digitalife.rebate;

test('rebatePorNiveles: nivel más alto alcanzado, mínimo y fronteras', () => {
  const t = PCEL.tiers;
  assert.equal(rebatePorNiveles({ base: 1000, cuota: 1000, tiers: t }).pct, 0.01);
  assert.equal(rebatePorNiveles({ base: 1060, cuota: 1000, tiers: t }).pct, 0.015, 'frontera exacta entra al nivel');
  assert.equal(rebatePorNiveles({ base: 1300, cuota: 1000, tiers: t }).pct, 0.02);
  const bajo = rebatePorNiveles({ base: 890, cuota: 1000, tiers: t });
  assert.equal(bajo.pct, 0); assert.equal(bajo.monto, 0); assert.equal(bajo.cumple, false); assert.equal(bajo.minimo, 0.9);
  const sinCuota = rebatePorNiveles({ base: 5000, cuota: 0, tiers: t });
  assert.equal(sinCuota.alcance, 0); assert.equal(sinCuota.monto, 0);
  // El mínimo de la regla manda aunque haya nivel.
  assert.equal(rebatePorNiveles({ base: 950, cuota: 1000, tiers: t, minimo: 1 }).pct, 0);
});

test('redondeo: centavos en las propuestas, pesos enteros en la ficha del cliente', () => {
  const a = { base: 123456.78, cuota: 100000, tiers: PCEL.tiers };
  assert.equal(rebatePorNiveles(a).monto, 2469.14);
  assert.equal(rebatePorNiveles({ ...a, decimales: 0 }).monto, 2469);
});

test('modoRebate y mínimo por frecuencia', () => {
  assert.equal(modoRebate(DCT), 'mensual'); assert.equal(modoRebate(PCEL), 'niveles'); assert.equal(modoRebate(DGL), 'por_categoria');
  assert.equal(modoRebate(null), null); assert.equal(modoRebate({ frecuencia: 'anual' }), null);
  // Diferencia conservada: una regla trimestral SIN modo → niveles en el cierre, por categoría en el panel.
  assert.equal(modoRebate({ frecuencia: 'trimestral' }), 'niveles');
  assert.equal(modoRebate({ frecuencia: 'trimestral' }, { trimestralSinModo: 'por_categoria' }), 'por_categoria');
  assert.equal(minimoDeRegla({ frecuencia: 'mensual', alcance_minimo_pago: 0.95, requiere_alcance_minimo: 0.8 }), 0.95);
  assert.equal(minimoDeRegla({ frecuencia: 'trimestral', alcance_minimo_pago: 0.95, requiere_alcance_minimo: 0.8 }), 0.8);
});

const datos = {
  sellInMes: { pcel: { '2026-07': 1000000, '2026-08': 1100000, '2026-09': 1200000 }, dicotech: { '2026-09': 500000 }, digitalife: {} },
  cuotaMes: { pcel: { '2026-07': 1000000, '2026-08': 1000000, '2026-09': 1000000 }, dicotech: { '2026-09': 400000 }, digitalife: {} },
  sellInQCategorias: { digitalife: { '2026-Q3': { monitores: 100000, sillas: 50000, accesorios: 10000 } } },
};

test('panel «Cálculo» ≡ cierre cuando el mes cierra el trimestre', () => {
  const lista = calcularPeriodo({ anio: 2026, mes: 9, datos }).propuestas.filter((p) => p.tipo === 'rebate');
  assert.equal(lista.length, 3);
  const panel = bloquesCalculo({ clientes: ['digitalife', 'pcel', 'dicotech'], reglas: [], datosMotor: datos, anio: 2026, mes: 9 });
  for (const b of panel) {
    const delCierre = rebateDelPeriodo({ cliente: b.cliente, regla: b.rReb, anio: 2026, mes: 9, datos, soloQCerrado: true });
    assert.deepEqual(b.rebate, delCierre, `${b.cliente}: misma propuesta en el panel y en el cierre`);
    assert.deepEqual(lista.find((p) => p.cliente === b.cliente), delCierre);
  }
  const pcel = panel.find((b) => b.cliente === 'pcel').rebate;
  assert.equal(pcel.detalle.alcance, 1.1); assert.equal(pcel.detalle.pct, 0.015); assert.equal(pcel.monto, 49500);
  assert.equal(panel.find((b) => b.cliente === 'dicotech').rebate.monto, 10000);
  assert.equal(panel.find((b) => b.cliente === 'digitalife').rebate.monto, 3300);
});

test('diferencia conservada: con el Q en curso el panel calcula y el cierre no', () => {
  assert.equal(rebateDelPeriodo({ cliente: 'pcel', regla: PCEL, anio: 2026, mes: 8, datos, soloQCerrado: true }), null);
  const enCurso = rebateDelPeriodo({ cliente: 'pcel', regla: PCEL, anio: 2026, mes: 8, datos, soloQCerrado: false });
  assert.equal(enCurso.periodo, '2026-Q3'); assert.equal(enCurso.detalle.cuota, 3000000, 'cuota del Q completo');
  // La mensual no depende de eso.
  assert.ok(rebateDelPeriodo({ cliente: 'dicotech', regla: DCT, anio: 2026, mes: 9, datos, soloQCerrado: true }));
});

test('rebate en progreso (ficha del cliente) = mismo núcleo, en pesos enteros', () => {
  const fact = [{ anio: 2026, mes: 7, monto: 1000000 }, { anio: 2026, mes: 8, monto: 1100000 }, { anio: 2026, mes: 9, monto: 1200000.4 }];
  const cuotas = [7, 8, 9].map((mes) => ({ anio: 2026, mes, cuota_min: 1000000 }));
  const p = rebateProgreso({ fact, cuotas, regla: PCEL, anio: 2026, mes: 9 });
  const m = M.rebateTrimestralNiveles({ cliente: 'pcel', anio: 2026, q: 3, sellInQ: 3300000.4, cuotaQ: 3000000, regla: PCEL });
  assert.equal(p.alcance, m.detalle.alcance); assert.equal(p.pct, m.detalle.pct); assert.equal(p.nivel, m.detalle.nivel);
  assert.equal(p.monto, Math.round(3300000.4 * 0.015)); assert.equal(m.monto, 49500.01);
  const d = rebateProgreso({ fact: [{ anio: 2026, mes: 9, monto: 500000 }], cuotas: [{ anio: 2026, mes: 9, cuota_min: 400000 }], regla: DCT, anio: 2026, mes: 9 });
  assert.equal(d.modo, 'mensual'); assert.equal(d.monto, M.rebateMensual({ anio: 2026, mes: 9, sellIn: 500000, cuota: 400000, regla: DCT }).monto);
  const g = rebateProgreso({ fact, cuotas: [], regla: DGL, anio: 2026, mes: 9 });
  assert.equal(g.modo, 'por_categoria'); assert.equal(g.monto, null); assert.equal(g.alcance, null);
  assert.equal(rebateProgreso({ regla: null }), null);
});

test('nadie más reescribe la regla: el API y el celular importan el motor', () => {
  const leer = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  const api = leer('api/_pagos.js');
  assert.match(api, /pagosv3\/motor\.js/, 'api/_pagos.js usa el motor de src (no es espejo)');
  assert.doesNotMatch(api, /min_alcance/, 'api/_pagos.js no elige niveles por su cuenta');
  const movil = leer('src/movil/pestanas/cliente/pagosCalc.js');
  assert.match(movil, /export \{ rebateProgreso \} from '..\/..\/..\/modules\/comercial\/pagosv3\/progreso'/);
  assert.doesNotMatch(movil, /nivelDe|alcance_minimo_pago|requiere_alcance_minimo/);
  const panel = leer('src/modules/comercial/pagosv3/calculoPanel.js');
  assert.match(panel, /M\.rebateDelPeriodo\(/); assert.doesNotMatch(panel, /rebateTrimestralNiveles|rebateMensual\(/);
});
