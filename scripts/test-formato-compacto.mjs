// Formato compacto de un decimal (src/lib/format.js#moneyCompact1): sustituye 7 copias idénticas (2026-11-20).
// Compara contra las dos variantes literales que había y fija que NO es moneyCompact (esa recorta «.0»).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { moneyCompact1, moneyCompact } from '../src/lib/format.js';

const N = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v));
const compactViejo = (n) => { const v = N(n); const a = Math.abs(v); if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`; if (a >= 1e3) return `$${Math.round(v / 1e3)}K`; return `$${Math.round(v)}`; };
const fmtMViejo = (n) => { const a = Math.abs(n); const s = a >= 1e6 ? `$${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `$${Math.round(a / 1e3)}K` : `$${Math.round(a)}`; return (n < 0 ? '−' : '') + s; };
const VALORES = [0, 1, 499.4, 999.5, 1000, 1499, 1500, 2500, 999499, 999500, 1e6, 1.04e6, 1.05e6, 2.5e6, 34.8e6, 1.2e9, -1, -1500, -2500, -999500, -1.5e6, -34.8e6];

test('mismo texto que las copias que sustituye', () => {
  for (const v of VALORES) {
    assert.equal(moneyCompact1(v), compactViejo(v), `interno ${v}`);
    assert.equal(moneyCompact1(v, { signo: '−' }), fmtMViejo(v), `tipográfico ${v}`);
  }
  for (const v of [null, undefined, '', 'abc', '2500000']) assert.equal(moneyCompact1(v), compactViejo(v));
  assert.equal(moneyCompact1(1e6), '$1.0M'); assert.equal(moneyCompact(1e6), '$1M', 'moneyCompact recorta el .0: son dos formatos distintos');
  assert.equal(moneyCompact1(-1.5e6), '$-1.5M'); assert.equal(moneyCompact1(-1.5e6, { signo: '−' }), '−$1.5M');
});

test('las siete copias ya llaman a la de src/lib/format.js', () => {
  const leer = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
  for (const p of ['movil/pestanas/cliente/pagosCalc.js', 'movil/pestanas/cliente/calculo.js', 'modules/comercial/propuestas/resumen.js', 'modules/comercial/forecast/sopCalculo.js',
    'modules/comercial/analisis/siso.js', 'modules/comercial/analisis/ritmo.js', 'modules/comercial/sellout/sucursales.js']) {
    const s = leer(p);
    assert.match(s, /moneyCompact1\(n/, p); assert.doesNotMatch(s, /1e6\)\.toFixed\(1\)\}M/, `${p} no formatea a mano`);
  }
});
