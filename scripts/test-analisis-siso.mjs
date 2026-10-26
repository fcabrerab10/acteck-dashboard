// Página del cliente · «Sell in vs sell out del año, con la cuota» (2026-10-26). node --test scripts/test-analisis-siso.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
test.after(async () => { await vite.close(); setTimeout(() => process.exit(process.exitCode || 0), 200).unref(); });
const s = await vite.ssrLoadModule('/src/modules/comercial/analisis/siso.js');
const { idxMes } = await vite.ssrLoadModule('/src/modules/comercial/analisis/calc.js');

const mensual = new Map();
for (let m = 1; m <= 9; m += 1) mensual.set(idxMes(2026, m), { fact_neta: m >= 6 ? 16e6 : 9e6 });
for (let m = 1; m <= 12; m += 1) mensual.set(idxMes(2025, m), { fact_neta: 8e6 });
const mensualSO = [
  ...Array.from({ length: 9 }, (_, i) => ({ cuenta: 'cva', anio: 2026, mes: i + 1, importe: i === 8 ? 34.8e6 : 20e6 })),
  { cuenta: 'ct', anio: 2026, mes: 9, importe: 99e6 }, { cuenta: 'cva', anio: 2025, mes: 9, importe: 5e6 },
];
const cuotas = new Map();
for (let m = 1; m <= 12; m += 1) cuotas.set(`00417|2026|${m}`, 10e6);

test('serieSiSoAnio: 12 meses, futuro en null, cuenta y cuota', () => {
  const serie = s.serieSiSoAnio({ mensual, mensualSO, cuenta: 'cva', cuotas, cliente: '00417', anio: 2026, hastaMes: 10 });
  assert.equal(serie.length, 12);
  assert.equal(serie[8].sellIn, 16e6); assert.equal(serie[8].sellOut, 34.8e6); assert.equal(serie[8].anterior, 8e6); assert.equal(serie[8].cuota, 10e6);
  assert.equal(serie[9].sellIn, 0); assert.equal(serie[10].sellIn, null); assert.equal(serie[10].sellOut, null); assert.equal(serie[10].cuota, 10e6);
  assert.equal(serie[8].x, 'Sep');
  // sin cuenta → sellOut null; sin cuotas → cuota null
  const sin = s.serieSiSoAnio({ mensual, mensualSO, cuenta: null, cuotas: null, cliente: '00417', anio: 2026 });
  assert.equal(sin[8].sellOut, null); assert.equal(sin[8].cuota, null);
});

test('fraseSiSo: racha de cuota, sell out y SO/SI', () => {
  const serie = s.serieSiSoAnio({ mensual, mensualSO, cuenta: 'cva', cuotas, cliente: '00417', anio: 2026, hastaMes: 10 });
  const f = s.fraseSiSo(serie, { anio: 2026, hastaMes: 10 });
  assert.match(f, /^Arriba de cuota desde jun \(sep al 160 %\); en sep desplazó \$34\.8M y le vendimos \$16\.0M: SO\/SI 2\.2\.$/);
  // sin sell out → compara con el año anterior; sin cuota → sólo esa parte
  const sin = s.serieSiSoAnio({ mensual, cuenta: null, cuotas: null, cliente: '00417', anio: 2026, hastaMes: 10 });
  assert.equal(s.fraseSiSo(sin, { anio: 2026, hastaMes: 10 }), 'En sep le vendimos $16.0M (+100 % vs sep 2025).');
  // debajo de cuota en un solo mes
  const m2 = new Map(mensual); m2.set(idxMes(2026, 9), { fact_neta: 5e6 });
  const bajo = s.serieSiSoAnio({ mensual: m2, cuenta: null, cuotas, cliente: '00417', anio: 2026, hastaMes: 10 });
  assert.match(s.fraseSiSo(bajo, { anio: 2026, hastaMes: 10 }), /^Debajo de cuota en sep \(50 %\);/);
  assert.equal(s.fraseSiSo(s.serieSiSoAnio({ mensual: new Map(), cliente: 'x', anio: 2024 }), { anio: 2024 }), 'Sin facturación en 2024.');
});
