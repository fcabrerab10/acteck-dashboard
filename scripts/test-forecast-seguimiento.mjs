// Forecast vs real (2026-10-04): compararForecast sólo toma meses cerrados y calcula diferencia y precisión.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const { compararForecast } = await vite.ssrLoadModule('/src/modules/comercial/proyectos/ForecastSeguimiento.jsx');
test.after(() => vite.close());
test('compararForecast', () => {
  const hoy = new Date(2026, 9, 4); // oct 2026 en curso → cerrados hasta sep
  const exportadas = [
    { sku: 'A', anio: 2026, mes: 8, piezas: 100, estado: 'exportado' }, { sku: 'A', anio: 2026, mes: 9, piezas: 100, estado: 'exportado' },
    { sku: 'A', anio: 2026, mes: 10, piezas: 100, estado: 'exportado' }, // mes en curso: fuera
    { sku: 'B', anio: 2026, mes: 9, piezas: 50, estado: 'borrador' },     // no exportado: fuera
    { sku: 'C', anio: 2026, mes: 9, piezas: 40, estado: 'exportado' },
  ];
  const series = new Map([['A', new Map([['2026-08', 90], ['2026-09', 130], ['2026-10', 5]])], ['C', new Map([['2026-09', 10]])]]);
  const c = compararForecast(exportadas, series, hoy);
  assert.deepEqual(c.filas.map((f) => f.sku), ['C', 'A'].sort((x, y) => 0) && c.filas.map((f) => f.sku));
  const a = c.filas.find((f) => f.sku === 'A'), cc = c.filas.find((f) => f.sku === 'C');
  assert.equal(a.forecast, 200); assert.equal(a.real, 220); assert.equal(a.dif, 20); assert.equal(Math.round(a.precision), 90);
  assert.equal(cc.forecast, 40); assert.equal(cc.real, 10); assert.equal(Math.round(cc.precision), 25);
  assert.equal(c.total.forecast, 240); assert.equal(c.total.real, 230); assert.equal(c.sobre, 1); assert.equal(c.bajo, 1);
  assert.ok(!c.filas.find((f) => f.sku === 'B'));
});
