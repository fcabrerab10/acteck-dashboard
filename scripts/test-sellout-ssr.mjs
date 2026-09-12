// Smoke SSR de Sell Out consolidado: carga los módulos de la pantalla con el pipeline de
// Vite y renderiza a string lo que no necesita red (el mapa y el kit), para atrapar errores
// de import, ciclos y JSX roto antes de abrir el navegador.
//   node scripts/test-sellout-ssr.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });

test.after(() => vite.close());

test('los módulos de la pantalla cargan', async () => {
  for (const m of [
    '/src/modules/comercial/SellOutGlobal.jsx',
    '/src/modules/comercial/sellout/DrillCuenta.jsx',
    '/src/modules/comercial/sellout/ResumenSellOut.jsx',
    '/src/modules/comercial/sellout/MapaMexico.jsx',
    '/src/modules/comercial/analisis/DrillCliente.jsx',
  ]) {
    const mod = await vite.ssrLoadModule(m);
    assert.equal(typeof mod.default, 'function', `${m} debe exportar default`);
  }
  const datos = await vite.ssrLoadModule('/src/modules/comercial/sellout/datos.js');
  for (const h of ['useCuentas', 'useDias', 'useMensual', 'useSkuMes', 'useEstadoMes', 'useDrillSkus', 'useDrillInventario']) {
    assert.equal(typeof datos[h], 'function', `datos.js debe exportar ${h}`);
  }
});

test('el mapa de México renderiza los 32 estados', async () => {
  const { default: MapaMexico } = await vite.ssrLoadModule('/src/modules/comercial/sellout/MapaMexico.jsx');
  const { ThemeProvider } = await vite.ssrLoadModule('/src/lib/themeContext.jsx');
  const datos = [
    { estado: 'JALISCO', importe: 600, importePrev: 300, yoy: 100, pct: 60, clientes: 30, vendedores: 8 },
    { estado: 'PUEBLA', importe: 100, importePrev: 120, yoy: -16.7, pct: 10, clientes: 5, vendedores: 2 },
    { estado: 'SIN ESTADO', importe: 300, importePrev: 0, yoy: null, pct: 30, clientes: 0, vendedores: 0 },
  ];
  const html = renderToString(React.createElement(ThemeProvider, null, React.createElement(MapaMexico, { datos })));
  const paths = html.match(/<path /g) || [];
  assert.equal(paths.length, 32, 'deben pintarse los 32 estados');
  assert.ok(html.includes('Jalisco'), 'el tooltip nativo trae el nombre con acentos');
  assert.ok(html.includes('Sin estado en la fuente'), '"Sin estado" va como fila aparte');
  assert.ok(!/NaN/.test(html), 'ningún NaN en el SVG');
});

test('la geometría del mapa está sana', async () => {
  const geo = (await vite.ssrLoadModule('/src/modules/comercial/sellout/mexico-estados.json')).default;
  assert.equal(geo.estados.length, 32);
  const vb = geo.viewBox.split(' ').map(Number);
  assert.equal(vb.length, 4);
  for (const e of geo.estados) {
    assert.match(e.d, /^M/);
    assert.match(e.d, /Z$/);
    assert.ok(!/NaN/.test(e.d), `${e.nombre} trae NaN`);
    assert.ok(Number.isFinite(e.cx) && Number.isFinite(e.cy), `${e.nombre} sin centroide`);
    assert.ok(e.cx >= vb[0] && e.cx <= vb[0] + vb[2] && e.cy >= vb[1] && e.cy <= vb[1] + vb[3], `${e.nombre} fuera del viewBox`);
    assert.equal(e.nombre, e.nombre.toUpperCase());
    assert.ok(!/[ÁÉÍÓÚÜÑ]/.test(e.nombre), `${e.nombre} con acentos`);
  }
});
