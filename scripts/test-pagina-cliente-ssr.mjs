// Página del cliente · bloques 3.96.0 (2026-10-26): SSR de las tres vistas puras con datos de ejemplo (sin red).
//   node --test scripts/test-pagina-cliente-ssr.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';

globalThis.window ??= globalThis;
globalThis.navigator ??= { userAgent: 'node', language: 'es-MX', onLine: true };
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {}, clear() {} };
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.requestAnimationFrame ??= (f) => setTimeout(f, 0);
globalThis.addEventListener ??= () => {};
globalThis.removeEventListener ??= () => {};

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
test.after(async () => { await vite.close(); setTimeout(() => process.exit(process.exitCode || 0), 200).unref(); });

const { ThemeProvider } = await vite.ssrLoadModule('/src/lib/themeContext.jsx');
const { SiSoAnioVista } = await vite.ssrLoadModule('/src/modules/comercial/analisis/SiSoAnio.jsx');
const { RitmoClienteVista } = await vite.ssrLoadModule('/src/modules/comercial/analisis/RitmoCliente.jsx');
const { SucursalesMovimientoVista } = await vite.ssrLoadModule('/src/modules/comercial/sellout/SucursalesMovimientoPanel.jsx');
const { serieSiSoAnio, fraseSiSo } = await vite.ssrLoadModule('/src/modules/comercial/analisis/siso.js');
const { ritmoDeUnCliente } = await vite.ssrLoadModule('/src/modules/comercial/analisis/ritmo.js');
const { movimientoSucursales } = await vite.ssrLoadModule('/src/modules/comercial/sellout/sucursales.js');
const { idxMes } = await vite.ssrLoadModule('/src/modules/comercial/analisis/calc.js');

const pintar = (el) => renderToString(React.createElement(ThemeProvider, null, el));
const HOY = new Date(2026, 9, 8, 12);

test('SiSoAnioVista pinta la gráfica, la frase y el meta', () => {
  const mensual = new Map(); for (let m = 1; m <= 9; m += 1) mensual.set(idxMes(2026, m), { fact_neta: 12e6 });
  const cuotas = new Map(); for (let m = 1; m <= 12; m += 1) cuotas.set(`00417|2026|${m}`, 10e6);
  const serie = serieSiSoAnio({ mensual, mensualSO: [{ cuenta: 'cva', anio: 2026, mes: 9, importe: 30e6 }], cuenta: 'cva', cuotas, cliente: '00417', anio: 2026, hastaMes: 10 });
  const html = pintar(React.createElement(SiSoAnioVista, { serie, frase: fraseSiSo(serie, { anio: 2026, hastaMes: 10 }), anio: 2026, tieneSellOut: true }));
  assert.match(html, /Sell in vs sell out del año, con la cuota/);
  assert.match(html, /Arriba de cuota desde ene/); assert.match(html, /SO\/SI 2\.5/);
  assert.match(html, /punteado verde = cuota/);
  assert.ok(!/NaN|undefined/.test(html));
  const sin = pintar(React.createElement(SiSoAnioVista, { serie: serieSiSoAnio({ mensual, cliente: 'x', anio: 2026 }), frase: 'F.', anio: 2026, tieneSellOut: false }));
  assert.match(sin, /no reporta sell out/); assert.match(sin, /sin cuota cargada/);
});

test('RitmoClienteVista: 4 tarjetas con estado, ocasional y sin compras', () => {
  const f = (mes, dia, fact_neta) => ({ anio: 2026, mes, dia, fact_neta, piezas: 1, facturas: 1 });
  const diario = [f(7, 10, 180000), f(7, 19, 180000), f(8, 28, 180000), f(9, 6, 180000), f(9, 15, 180000), f(9, 24, 180000)];
  const r = ritmoDeUnCliente(diario, { cliente: '00676', hoy: HOY, nombre: 'Exel' });
  const html = pintar(React.createElement(RitmoClienteVista, { r, meta: 'meta de prueba' }));
  assert.match(html, /Ritmo de compra de este cliente/); assert.match(html, /meta de prueba/);
  assert.match(html, /9 d/); assert.match(html, /14 d/); assert.match(html, /atrasado · llamar/); assert.match(html, /3 días con compra en sep/);
  assert.match(html, /última: 24 sep, \$180K/); assert.match(html, /ticket de sep: \$180K/); assert.match(html, /en sep llevaba \$180K al día 8/);
  assert.ok(!/NaN|undefined/.test(html));
  const oc = ritmoDeUnCliente([f(7, 3, 50000), f(10, 5, 200000)], { cliente: 'L', hoy: HOY });
  const h2 = pintar(React.createElement(RitmoClienteVista, { r: oc, meta: '' }));
  assert.match(h2, /ocasional/); assert.match(h2, /2 compras en 6 meses/);
  const h3 = pintar(React.createElement(RitmoClienteVista, { r: ritmoDeUnCliente([], { cliente: 'N', hoy: HOY }), meta: '' }));
  assert.match(h3, /Sin compras en los últimos 6 meses/);
  assert.match(pintar(React.createElement(RitmoClienteVista, { r: null, meta: '', cargando: true })), /Ritmo de compra/);
});

test('SucursalesMovimientoVista: tres listas con frases y vacíos', () => {
  const s = (sucursal, mes, importe) => ({ anio: 2026, mes, sucursal, importe });
  const m = movimientoSucursales([s('GDL', 8, 0.9e6), s('GDL', 9, 2.1e6), s('MTY', 8, 1.5e6), s('MTY', 9, 1.0e6), s('PUE', 7, 300e3), s('PUE', 8, 300e3)], { anio: 2026, mes: 9 });
  const html = pintar(React.createElement(SucursalesMovimientoVista, { m }));
  assert.match(html, /Sucursales que suben, bajan y dejaron de vender/);
  assert.match(html, /GDL/); assert.match(html, /\$2\.1M en sep · \$900K en ago/); assert.match(html, /\+\$1\.2M/);
  assert.match(html, /MTY/); assert.match(html, /−\$500K/);
  assert.match(html, /PUE/); assert.match(html, /vendía \$200K\/mes/); assert.match(html, /dejó de vender/);
  assert.ok(!/NaN|undefined/.test(html));
  const vacio = pintar(React.createElement(SucursalesMovimientoVista, { m: movimientoSucursales([], { anio: 2026, mes: 1 }) }));
  assert.match(vacio, /Ninguna sucursal sube/); assert.match(vacio, /siguen vendiendo/);
});
