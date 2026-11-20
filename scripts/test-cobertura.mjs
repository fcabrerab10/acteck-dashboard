// Semáforo de cobertura (src/lib/cobertura.js): una sola regla con perfiles. Cada caso compara contra la copia LITERAL
// que tenía la pantalla antes de la fusión (2026-11-20), en una rejilla de valores: ninguna cifra ni color cambia.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { estadoCobertura, PERFILES, TONOS, ETIQUETAS } from '../src/lib/cobertura.js';
import { tonoCobertura as tonoInv, etiquetaCobertura, COBERTURA_CRITICA, COBERTURA_SOBRESTOCK } from '../src/modules/comercial/inventario/constantes.js';
import { tonoCobertura as tonoSop } from '../src/modules/comercial/forecast/sopCalculo.js';

const VALORES = [null, undefined, NaN, Infinity, -5, 0, 0.5, 1, 1.9, 2, 3.9, 4, 12, 12.1, 29, 29.9, 30, 31, 59.9, 60, 61, 89, 90, 90.1, 91, 119, 120, 121, 150, 151, 400];
const STOCKS = [undefined, null, 0, -3, 1, 250, true, false];

test('estadoCobertura: orden de evaluación y perfiles', () => {
  assert.equal(estadoCobertura(10, PERFILES.inventario, { agotado: true }), 'agotado');
  assert.equal(estadoCobertura(null), 'sinDato'); assert.equal(estadoCobertura(Infinity), 'sinDato');
  assert.equal(estadoCobertura(Infinity, PERFILES.inventario, { soloNull: true }), 'sobre');
  assert.equal(estadoCobertura(29.9), 'critico'); assert.equal(estadoCobertura(30), 'sano'); assert.equal(estadoCobertura(90), 'sano'); assert.equal(estadoCobertura(90.1), 'sobre');
  assert.equal(estadoCobertura(45, PERFILES.sop), 'justo'); assert.equal(estadoCobertura(60, PERFILES.sop), 'sano'); assert.equal(estadoCobertura(500, PERFILES.sop), 'sano');
  assert.equal(COBERTURA_CRITICA, 30); assert.equal(COBERTURA_SOBRESTOCK, 90);
});

test('Inventario (tabla, drill, hero, ficha de producto, sugeridos): 30 / 90', () => {
  const tono = (dias, stock) => { if (!stock) return 'red'; if (dias == null || !isFinite(dias)) return 'gray'; if (dias < 30) return 'red'; if (dias > 90) return 'orange'; return 'green'; };
  const etiq = (dias, stock) => { if (!stock) return 'Agotado'; if (dias == null || !isFinite(dias)) return 'Sin demanda'; if (dias < 30) return 'Crítica'; if (dias > 90) return 'Sobre-stock'; return 'Sana'; };
  for (const d of VALORES) for (const s of STOCKS) { assert.equal(tonoInv(d, s), tono(d, s), `tono ${d}/${s}`); assert.equal(etiquetaCobertura(d, s), etiq(d, s), `etiqueta ${d}/${s}`); }
});

test('Inventario · banderas crítico / sobre-stock de agregarSkus y estados del S&OP', () => {
  for (const cob of VALORES) for (const tieneStock of [true, false]) {
    const e = estadoCobertura(cob, PERFILES.inventario, { agotado: !tieneStock });
    assert.equal(e === 'critico', !!(tieneStock && cob != null && cob < 30 && isFinite(cob)) || (tieneStock && cob != null && cob < 30 && !Number.isNaN(cob) && cob === -Infinity), `critico ${cob}`);
    assert.equal(e === 'sobre', !!(tieneStock && cob != null && cob > 90 && isFinite(cob)), `sobre ${cob}`);
  }
  for (const cob of VALORES) { // forecast/motorFiltros.js#estadosDe
    const e = estadoCobertura(cob, PERFILES.inventario);
    assert.equal(e === 'critico', cob != null && isFinite(cob) && cob < 30); assert.equal(e === 'sobre', cob != null && isFinite(cob) && cob > 90);
  }
  for (const cob of VALORES) { // KPIs del S&OP (ForecastClientesTab): sin demanda cuenta como sobre-stock
    const e = estadoCobertura(cob, PERFILES.inventario, { soloNull: true });
    assert.equal(['sinDato', 'sobre'].includes(e), cob == null || cob > 90, `sobre KPI ${cob}`);
    assert.equal(e === 'critico', cob != null && cob < 30, `critico KPI ${cob}`);
  }
});

test('S&OP (lo que llega, Abasto, tabla del celular, drill, Resumen de clientes): 30 / 60', () => {
  const viejo = (dias, inv = 0) => (inv <= 0 || dias === 0 ? 'red' : dias == null ? 'gray' : dias < 30 ? 'red' : dias < 60 ? 'orange' : 'green');
  for (const d of VALORES) for (const inv of [undefined, 0, -1, 5]) assert.equal(tonoSop(d, inv), viejo(d, inv), `sop ${d}/${inv}`);
  const T = { red: 'R', orange: 'O', text: 'T', textMuted: 'M', green: 'G' };
  const colorDias = (dias) => (dias == null ? T.textMuted : dias <= 0 ? T.red : dias < 30 ? T.red : dias < 60 ? T.orange : T.text);
  const COLOR = { sinDato: T.textMuted, agotado: T.red, critico: T.red, justo: T.orange, sano: T.text, sobre: T.text };
  const drill = (cob) => (cob == null ? null : cob < 30 ? T.red : cob < 60 ? T.orange : T.green);
  const drillTxt = (cob) => (cob == null ? 'sin demanda' : cob < 30 ? 'crítica' : cob < 60 ? 'tensa' : 'holgura sana');
  const tarjeta = (c) => (c == null ? T.text : c < 30 ? T.red : c < 60 ? T.orange : T.text);
  for (const d of VALORES) {
    assert.equal(COLOR[estadoCobertura(d, PERFILES.sop, { agotado: d != null && d <= 0, soloNull: true })], colorDias(d), `TablaSop ${d}`);
    const e = estadoCobertura(d, PERFILES.sop, { soloNull: true });
    assert.equal({ sinDato: null, critico: T.red, justo: T.orange, sano: T.green }[e], drill(d), `DrillSku ${d}`);
    assert.equal(ETIQUETAS.sopDrill[e], drillTxt(d));
    assert.equal({ critico: T.red, justo: T.orange }[e] || T.text, tarjeta(d), `TarjetaCliente ${d}`);
  }
  // «Comprar ahora» (web): agotado rojo · <30 naranja · lo demás gris.
  for (const d of VALORES) for (const inv of [0, 4]) {
    const viejoTono = inv <= 0 ? 'red' : d != null && d < 30 ? 'orange' : 'gray';
    assert.equal({ agotado: 'red', critico: 'orange' }[estadoCobertura(d, { critico: PERFILES.sop.critico }, { agotado: inv <= 0, soloNull: true })] || 'gray', viejoTono);
  }
});

test('Dirección: Inicio 30 / 120 y Visión General 60 / 120', () => {
  const inicio = (c) => (c == null ? 'gray' : c > 120 ? 'orange' : c < 30 ? 'red' : 'green');
  const vg = (d) => (d == null ? { l: '—', tone: 'gray' } : d < 60 ? { l: 'Bajo', tone: 'red' } : d > 120 ? { l: 'Alto', tone: 'orange' } : { l: 'Sano', tone: 'green' });
  for (const d of VALORES) {
    assert.equal(TONOS.direccion[estadoCobertura(d, PERFILES.direccion, { soloNull: true })], inicio(d), `Inicio ${d}`);
    const e = estadoCobertura(d, PERFILES.visionGeneral, { soloNull: true });
    assert.deepEqual({ l: ETIQUETAS.visionGeneral[e], tone: TONOS.direccion[e] }, vg(d), `Visión General ${d}`);
  }
});

test('Semanas en la cuenta: Producto 360 (2 / 12) y Cuenta frente al resto (4)', () => {
  const ESTADO_CUENTA = { agotado: 'agotado', critico: 'riesgo', sobre: 'sobre', sano: 'sano', justo: 'sano', sinDato: 'sano' };
  const p360 = (pz, semanas) => (pz <= 0 ? 'agotado' : semanas != null && semanas < 2 ? 'riesgo' : semanas != null && semanas > 12 ? 'sobre' : 'sano');
  const frente = (s) => (s == null ? 'gray' : s <= 0 ? 'red' : s < 4 ? 'orange' : 'green');
  for (const s of VALORES.filter((v) => !Number.isNaN(v))) {
    for (const pz of [0, 10]) assert.equal(ESTADO_CUENTA[estadoCobertura(s ?? null, PERFILES.cuentaSemanas, { agotado: pz <= 0, soloNull: true })], p360(pz, s ?? null), `P360 ${s}/${pz}`);
    assert.equal({ sinDato: 'gray', agotado: 'red', justo: 'orange', sano: 'green' }[estadoCobertura(s, PERFILES.frenteSemanas, { agotado: s != null && s <= 0, soloNull: true })], frente(s), `frente ${s}`);
  }
});

test('las pantallas migradas ya no comparan umbrales a mano', () => {
  const leer = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
  for (const p of ['modules/comercial/inventario/constantes.js', 'modules/comercial/inventario/agregar.js', 'modules/comercial/forecast/motorFiltros.js',
    'modules/comercial/forecast/sopCalculo.js', 'movil/pestanas/sop/TablaSop.jsx', 'modules/comercial/forecast/DrillSku.jsx', 'modules/comercial/producto360/calculo.js',
    'movil/pestanas/analisis/CuentaFrenteAlResto.jsx', 'modules/general/Inicio.jsx', 'modules/comercial/VisionGeneral.jsx', 'modules/comercial/resumen/TarjetaCliente.jsx',
    'modules/comercial/ForecastClientesTab.jsx', 'modules/comercial/forecast/DemandaComprar.jsx']) {
    assert.match(leer(p), /lib\/cobertura\.js'/, `${p} usa src/lib/cobertura.js`);
  }
  assert.doesNotMatch(leer('modules/comercial/forecast/sopCalculo.js'), /dias < 30 \? 'red' : dias < 60/);
  assert.doesNotMatch(leer('modules/comercial/inventario/agregar.js'), /coberturaDias < COBERTURA_CRITICA;/);
});
