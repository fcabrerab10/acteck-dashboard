// Análisis por cliente · «Quién se mueve» y «A quién llamar hoy» (2026-10-08). node --test scripts/test-analisis-ritmo.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
test.after(async () => { await vite.close(); setTimeout(() => process.exit(process.exitCode || 0), 200).unref(); });
const r = await vite.ssrLoadModule('/src/modules/comercial/analisis/ritmo.js');
const HOY = new Date(2026, 9, 8, 12);
const f = (cliente, anio, mes, dia, fact_neta) => ({ cliente, cliente_key: 'mayoreo', anio, mes, dia, fact_neta, piezas: 1, facturas: 1 });
const filas = [
  // CT: compra cada 2 días, sube
  ...[1, 3, 5, 7].map((d) => f('CT', 2026, 9, d, 100000)), ...[2, 6, 8].map((d) => f('CT', 2026, 10, d, 400000)),
  // CVA: compraba cada 2 días, lleva 4 días, baja
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => f('CVA', 2026, 9, d, 200000)), f('CVA', 2026, 10, 2, 150000), f('CVA', 2026, 10, 4, 150000),
  // EXEL: compra cada 9 días, lleva 14 → atrasado; compró en sep y en oct no
  f('EXEL', 2026, 7, 10, 180000), f('EXEL', 2026, 7, 19, 180000), f('EXEL', 2026, 8, 28, 180000), f('EXEL', 2026, 9, 6, 180000), f('EXEL', 2026, 9, 15, 180000), f('EXEL', 2026, 9, 24, 180000),
  // LOMA: no compraba desde julio, compra en oct
  f('LOMA', 2026, 7, 3, 50000), f('LOMA', 2026, 10, 5, 200000),
  // PCH: devoluciones
  f('PCH', 2026, 9, 3, 300000), f('PCH', 2026, 10, 7, -400000),
];
const nombres = new Map([['CT', { nombre: 'CT Internacional' }], ['CVA', { nombre: 'CVA' }], ['EXEL', { nombre: 'Exel del Norte' }], ['LOMA', { nombre: 'Grupo Loma' }], ['PCH', { nombre: 'PCH' }]]);

test('quienSeMueve: suben, bajan, sin comprar y frases', () => {
  const m = r.quienSeMueve(filas, { hoy: HOY, nombres });
  assert.equal(m.mesLbl, 'oct'); assert.equal(m.mesPrevLbl, 'sep'); assert.equal(m.dia, 8);
  assert.deepEqual(m.suben.map((c) => c.cliente), ['CT', 'LOMA']);
  assert.match(m.suben[0].frase, /ya superó todo sep/);
  assert.match(m.suben[1].frase, /por primera vez desde jul/);
  assert.deepEqual(m.bajan.map((c) => c.cliente), ['CVA', 'PCH']);
  assert.match(m.bajan[1].frase, /devoluciones/);
  assert.deepEqual(m.sinComprar.map((c) => c.cliente), ['EXEL', 'PCH']); // PCH sólo tuvo devoluciones en oct
});

test('ritmoCompra: cadencia, lleva, estado y orden', () => {
  const { lista, conteo } = r.ritmoCompra(filas, { hoy: HOY, nombres });
  const by = Object.fromEntries(lista.map((c) => [c.cliente, c]));
  assert.equal(by.EXEL.cadencia, 9); assert.equal(by.EXEL.lleva, 14); assert.equal(by.EXEL.estado, 'atrasado'); assert.equal(by.EXEL.atraso, 5);
  assert.equal(by.CT.cadencia, 2); assert.equal(by.CT.lleva, 0); assert.equal(by.CT.estado, 'alRitmo');
  assert.equal(by.CVA.cadencia, 1); assert.equal(by.CVA.lleva, 4); assert.equal(by.CVA.estado, 'atrasado');
  assert.equal(by.LOMA.estado, 'ocasional'); assert.equal(by.LOMA.cadencia, null);
  assert.equal(lista[0].cliente, 'EXEL'); // el más atrasado arriba
  assert.equal(conteo.atrasado, 2); assert.ok(conteo.ocasional >= 1);
  assert.equal(r.fraseEstado(by.EXEL), 'atrasado 5 d');
  // perdido: cadencia 5 y 100 días sin comprar; solo: deja fuera a los que no estén en el set; nombres repetidos llevan código
  const viejo = [1, 6, 11, 16].map((d) => f('VIEJO', 2026, 6, d, 1000));
  const r2 = r.ritmoCompra([...filas, ...viejo], { hoy: HOY, nombres: new Map([['CT', { nombre: 'X' }], ['CVA', { nombre: 'X' }]]), solo: new Set(['CT', 'CVA', 'VIEJO']) });
  assert.deepEqual(r2.lista.map((c) => c.cliente), ['CVA', 'VIEJO', 'CT']); assert.equal(r2.lista[1].estado, 'perdido'); assert.equal(r2.lista[2].nombre, 'X · CT');
  assert.equal(by.EXEL.ultima, '2026-09-24'); assert.equal(Math.round(by.EXEL.ticket), 180000);
});
