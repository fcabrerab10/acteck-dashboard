// Pruebas de la lógica pura de Estado de Resultados V3 (índice, medidas Mes/YTD, serie, alertas, ficha,
// tabla formal, puente ERP vs P&L, textos).   node scripts/test-resultados-calculo.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  indexar, mesMaxDe, valorDe, ytdDe, deltaPct, margen, medidas, serieMensual, evolucion24, alertasDe, fichaMes,
  filasTabla, puente, infoGeneral, GRUPOS_TABLA, UMBRAL_PUENTE_PCT,
} from '../src/modules/general/resultados/calculo.js';
import { fraseHero, subHero, mensajeAlerta, textoAlertaPuente } from '../src/modules/general/resultados/textos.js';

// Fixture con cifras reales (redondeadas) de REVKO: 2026 ene–mar y 2025 completo para las cuentas clave.
const cta = (anio, mes, cuenta_norm, valor, extra = {}) => ({ anio, mes, cuenta_norm, cuenta: cuenta_norm.toUpperCase(), valor, orden: 1, es_subtotal: /^(venta_neta|utilidad_bruta|uafir|uaii|total_)/.test(cuenta_norm), ...extra });
const ORDEN = { ventas_y_servicios_a_tasa_general: 1, ventas_y_servicios_a_tasa_0: 2, devol_desctos_o_bonif_sobre_ingresos: 3, venta_neta: 4, costo_de_ventas: 5, total_costo_de_venta: 10, utilidad_bruta: 11, nomina: 13, total_gastos: 21, uafir_sin_proyectos: 23, alcance_gasto_vs_venta_n: 24, uaii_contable_sin_proyectos: 45, t_c_dof: 50, colaboradores: 51 };
const fila = (anio, mes, slug, valor, extra) => ({ ...cta(anio, mes, slug, valor, extra), orden: ORDEN[slug] ?? 99 });

const V26 = {
  1: { vg: 61818582, dev: -8365054, vn: 53453528, cv: 36631808, ub: 17326494, nom: 3000000, tg: 7000000, uaf: 10326494, uai: 10100000, alc: 0.13, tc: 18.2, col: 84 },
  2: { vg: 56210170, t0: 437324, dev: -5169283, vn: 51478211, cv: 37895143, ub: 13583067, nom: 3100000, tg: 6900000, uaf: 6683067, uai: 6500000, alc: 0.134, tc: 18.3, col: 84 },
  3: { vg: 53190608, t0: 455859, dev: -5935367, vn: 47711100, cv: 34302053, ub: 14857827, nom: 4200000, tg: 6793834, uaf: 8063992, uai: 7929354, alc: 0.142, tc: 18.1, col: 84, notaTg: 'Intelisis' },
};
const V25 = { 1: { vn: 43269268, ub: 9656515, tg: 6500000, uaf: 3156515, uai: 3000000, nom: 2800000, tc: 20.4, col: 80 }, 2: { vn: 42875362, ub: 9018062, tg: 6400000, uaf: 2618062, uai: 2500000, nom: 2850000, tc: 20.5, col: 80 }, 3: { vn: 39170595, ub: 9522791, tg: 6600000, uaf: 2922791, uai: 2800000, nom: 2900000, tc: 20.2, col: 81 } };

const rows2026 = [];
for (const [m, v] of Object.entries(V26)) {
  const mes = Number(m);
  rows2026.push(fila(2026, mes, 'ventas_y_servicios_a_tasa_general', v.vg));
  if (v.t0) rows2026.push(fila(2026, mes, 'ventas_y_servicios_a_tasa_0', v.t0));
  rows2026.push(fila(2026, mes, 'devol_desctos_o_bonif_sobre_ingresos', v.dev), fila(2026, mes, 'venta_neta', v.vn), fila(2026, mes, 'total_costo_de_venta', v.cv),
    fila(2026, mes, 'utilidad_bruta', v.ub), fila(2026, mes, 'nomina', v.nom), fila(2026, mes, 'total_gastos', v.tg, v.notaTg ? { nota: v.notaTg } : {}),
    fila(2026, mes, 'uafir_sin_proyectos', v.uaf), fila(2026, mes, 'uaii_contable_sin_proyectos', v.uai), fila(2026, mes, 'alcance_gasto_vs_venta_n', v.alc),
    fila(2026, mes, 't_c_dof', v.tc), fila(2026, mes, 'colaboradores', v.col));
}
const rows2025 = [];
for (let mes = 1; mes <= 12; mes++) {
  const v = V25[mes] || { vn: 50000000, ub: 12000000, tg: 6700000, uaf: 5300000, uai: 5000000, nom: 3000000, tc: 19, col: 82 };
  rows2025.push(fila(2025, mes, 'venta_neta', v.vn), fila(2025, mes, 'utilidad_bruta', v.ub), fila(2025, mes, 'total_gastos', v.tg), fila(2025, mes, 'nomina', v.nom),
    fila(2025, mes, 'uafir_sin_proyectos', v.uaf), fila(2025, mes, 'uaii_contable_sin_proyectos', v.uai), fila(2025, mes, 't_c_dof', v.tc), fila(2025, mes, 'colaboradores', v.col));
}
const idx = indexar(rows2026), idxPrev = indexar(rows2025);

test('indexar / mesMaxDe / valorDe / ytdDe', () => {
  assert.equal(mesMaxDe(rows2026), 3);
  assert.equal(mesMaxDe(rows2025), 12);
  assert.equal(valorDe(idx, 'venta_neta', 3), 47711100);
  assert.equal(valorDe(idx, 'venta_neta', 4), null);
  assert.equal(valorDe(idx, 'no_existe', 1), null);
  assert.equal(ytdDe(idx, 'venta_neta', 3), 53453528 + 51478211 + 47711100);
  assert.equal(ytdDe(idx, 'venta_neta', 12), ytdDe(idx, 'venta_neta', 3), 'meses sin cargar no suman');
  assert.equal(ytdDe(idx, 'no_existe', 3), null);
  assert.equal(idx.get('total_gastos').notas[3], 'Intelisis');
  assert.equal(idx.get('total_gastos').notaGeneral, null, 'nota general sólo si ≥3 meses con la misma nota');
});

test('deltaPct y margen', () => {
  assert.equal(deltaPct(110, 100), 10);
  assert.equal(deltaPct(-50, -100), 50, 'base |previo| para cuentas negativas');
  assert.equal(deltaPct(10, 0), null);
  assert.equal(deltaPct(null, 10), null);
  assert.equal(margen(25, 100), 25);
  assert.equal(margen(25, 0), null);
});

test('medidas Mes: marzo 2026 vs marzo 2025 (valores, márgenes y pp)', () => {
  const m = medidas(idx, idxPrev, 3, 'mes');
  assert.equal(m.ventaNeta, 47711100);
  assert.equal(m.prev.ventaNeta, 39170595);
  assert.ok(Math.abs(m.delta.ventaNeta - 21.8) < 0.1);
  assert.ok(Math.abs(m.pct.bruta - 31.14) < 0.05);
  assert.ok(Math.abs(m.prev.pct.bruta - 24.31) < 0.05);
  assert.ok(Math.abs(m.delta.brutaPp - 6.83) < 0.05, 'margen en puntos porcentuales');
  assert.equal(m.uafir, 8063992);
  assert.equal(m.uaii, 7929354);
});

test('medidas YTD: ene–mar acumulado y comparativo YTD anterior', () => {
  const y = medidas(idx, idxPrev, 3, 'ytd');
  assert.equal(y.ventaNeta, 53453528 + 51478211 + 47711100);
  assert.equal(y.prev.ventaNeta, 43269268 + 42875362 + 39170595);
  assert.equal(y.utilBruta, 17326494 + 13583067 + 14857827);
  assert.ok(y.delta.ventaNeta > 21 && y.delta.ventaNeta < 23);
});

test('serieMensual: 12 puntos, nulos después del último mes cargado, previo completo', () => {
  const s = serieMensual(idx, idxPrev, 3);
  assert.equal(s.length, 12);
  assert.equal(s[2].ventaNeta, 47711100);
  assert.equal(s[3].ventaNeta, null);
  assert.equal(s[11].ventaNetaPrev, 50000000);
  assert.ok(Math.abs(s[0].margenBrutoPct - 32.41) < 0.05);
});

test('evolucion24: 24 puntos, año anterior primero', () => {
  const e = evolucion24(idx, idxPrev, 'venta_neta', 2026);
  assert.equal(e.length, 24);
  assert.equal(e[0].k, 'Ene 25');
  assert.equal(e[0].valor, 43269268);
  assert.equal(e[14].k, 'Mar 26');
  assert.equal(e[14].valor, 47711100);
  assert.equal(e[15].valor, null);
});

test('alertas: nómina +35 % MoM en marzo y UAFIR +176 % YoY', () => {
  const a = alertasDe(idx, idxPrev, 3, 2026);
  const nomMom = a.find((x) => x.slug === 'nomina' && x.type === 'mom');
  assert.ok(nomMom, 'alerta MoM de nómina');
  assert.ok(Math.abs(nomMom.delta - 35.48) < 0.1);
  assert.equal(nomMom.mes, 3);
  const uafYoy = a.find((x) => x.slug === 'uafir_sin_proyectos' && x.type === 'yoy');
  assert.ok(uafYoy && uafYoy.delta > 170);
  assert.ok(!a.find((x) => x.slug === 'venta_neta' && x.type === 'mom'), 'venta −7 % MoM no alerta');
  assert.equal(alertasDe(idx, idxPrev, 0, 2026).length, 0);
  assert.match(mensajeAlerta(nomMom, 2026), /NOMINA subió 35\.5 % en Marzo vs Febrero/);
  assert.match(mensajeAlerta(uafYoy, 2026), /Marzo 2026: \+\d+\.\d % vs 2025/);
});

test('fichaMes: cifras del mes, top variaciones MoM/YoY sin subtotales, notas', () => {
  const f = fichaMes(idx, idxPrev, 3);
  assert.equal(f.ventaNeta, 47711100);
  assert.ok(Math.abs(f.pctBruta - 31.14) < 0.05);
  assert.ok(f.varsMoM.every((v) => !['venta_neta', 'utilidad_bruta', 'uafir_sin_proyectos'].includes(v.slug)), 'sin subtotales');
  assert.equal(f.varsMoM[0].slug, 'ventas_y_servicios_a_tasa_general', 'mayor variación absoluta primero');
  assert.ok(f.varsYoY.find((v) => v.slug === 'nomina'));
  assert.deepEqual(f.notas, [{ cuenta: 'TOTAL_GASTOS', nota: 'Intelisis' }]);
  assert.equal(fichaMes(idx, idxPrev, 1).varsMoM.length, 0, 'enero no tiene mes anterior');
  assert.equal(fichaMes(idx, idxPrev, null), null);
});

test('filasTabla: grupos, cuentas ordenadas, subtotal, Mes/YTD y Δ; cuentas en % con pp', () => {
  const filas = filasTabla(GRUPOS_TABLA, idx, idxPrev, 3, 3);
  const grupos = filas.filter((r) => r.tipo === 'grupo').map((r) => r.grupoId);
  assert.deepEqual(grupos, ['ingresos', 'costos', 'gastos', 'indicadores_gasto', 'utilidad']);
  const ing = filas.filter((r) => r.grupoId === 'ingresos');
  assert.deepEqual(ing.map((r) => r.tipo), ['grupo', 'cuenta', 'cuenta', 'cuenta', 'subtotal']);
  const vn = filas.find((r) => r.id === 'venta_neta');
  assert.equal(vn.tipo, 'subtotal');
  assert.equal(vn.mesVal, 47711100);
  assert.equal(vn.mesPrev, 39170595);
  assert.ok(Math.abs(vn.deltaMes - 21.8) < 0.1);
  assert.equal(vn.ytd, 53453528 + 51478211 + 47711100);
  assert.equal(vn.ytdPrev, 43269268 + 42875362 + 39170595);
  assert.equal(vn.valores[4], null);
  const alc = filas.find((r) => r.id === 'alcance_gasto_vs_venta_n');
  assert.equal(alc.formato, 'pct');
  assert.equal(alc.ytd, null);
  assert.equal(alc.deltaMes, null, 'sin año anterior → null');
  const tg = filas.find((r) => r.id === 'total_gastos');
  assert.equal(tg.notas[3], 'Intelisis');
  assert.equal(filas.find((r) => r.grupoId === 'gastos' && r.tipo === 'grupo').n, 3);
});

test('puente ERP vs P&L: Venta neta ERP cuadra (<2 %), Fact. neta queda arriba por bonificaciones, alerta por mes', () => {
  const erp = [
    { mes: 1, fact_bruta: 61567682, fact_neta: 57534140, venta_neta: 53304253, contribucion: 20650014 },
    { mes: 2, fact_bruta: 56328953, fact_neta: 55156014, venta_neta: 51430696, contribucion: 20635866 },
    { mes: 3, fact_bruta: 53368775, fact_neta: 51598853, venta_neta: 47720878, contribucion: 19157824 },
    { mes: 4, fact_bruta: 39052307, fact_neta: 37977027, venta_neta: 33908459, contribucion: 14014987 },
  ];
  const p = puente(idx, erp, 3);
  assert.equal(p.filas.length, 4, 'incluye meses del ERP sin P&L');
  const ene = p.filas[0];
  assert.equal(ene.difVentaNeta, 53304253 - 53453528);
  assert.ok(Math.abs(ene.difVentaNetaPct) < 0.5);
  assert.ok(ene.difFactNetaPct > 7 && ene.difFactNetaPct < 8, 'Fact. neta ≈ +7.6 % (bonificaciones)');
  assert.equal(ene.alerta, false);
  assert.ok(ene.difContribPct > 15, 'contribución ERP > utilidad bruta P&L');
  assert.equal(ene.plVentasBrutas, 61818582);
  assert.equal(p.filas[1].plVentasBrutas, 56210170 + 437324);
  assert.equal(p.filas[3].soloErp, true);
  assert.equal(p.filas[3].plVentaNeta, null);
  assert.equal(p.filas[3].alerta, false);
  assert.equal(p.totales.meses, 3);
  assert.ok(Math.abs(p.totales.difVentaNetaPct) < 0.5);
  assert.deepEqual(p.mesesAlerta, []);
  assert.equal(textoAlertaPuente(p, 2026), null);
  // Fuerza una diferencia grande en marzo
  const p2 = puente(idx, erp.map((r) => (r.mes === 3 ? { ...r, venta_neta: 44000000 } : r)), 3);
  assert.equal(p2.filas[2].alerta, true);
  assert.deepEqual(p2.mesesAlerta, [3]);
  assert.equal(textoAlertaPuente(p2, 2026), 'Diferencia > 2 % ERP vs P&L en Mar 2026');
  assert.equal(UMBRAL_PUENTE_PCT, 2);
  assert.equal(puente(idx, [], 3).filas.length, 3);
  assert.equal(puente(idx, [], 3).filas[0].erpFactNeta, null);
  assert.equal(puente(idx, [], 3).totales, null);
});

test('infoGeneral: T.C. y colaboradores del mes con YoY', () => {
  const i = infoGeneral(idx, idxPrev, 3);
  assert.deepEqual(i.map((x) => x.slug), ['t_c_dof', 'colaboradores']);
  assert.equal(i[0].valor, 18.1);
  assert.equal(i[0].valorPrev, 20.2);
  assert.ok(i[0].delta < 0);
  assert.equal(i[1].entero, true);
});

test('textos del Hero', () => {
  const f = fraseHero(medidas(idx, idxPrev, 3, 'mes'), 2026);
  assert.match(f, /^Marzo 2026 cerró con \$47\.7M de venta neta \(\+22 % vs 2025\), margen bruto 31\.1% \(\+6\.8 pp\), UAII \$8\.1M \(\+176 %\) y UAI \$7\.9M \(\+183 %\)\.$/);
  const s = subHero(medidas(idx, idxPrev, 3, 'ytd'), 2026, 3);
  assert.match(s, /^Acumulado ene–mar 2026: venta \$152\.6M \(\+22 %\), UAI \$24\.5M/);
  assert.equal(fraseHero(medidas(indexar([]), idxPrev, 3, 'mes'), 2026), 'Sin cierre cargado para 2026.');
});
