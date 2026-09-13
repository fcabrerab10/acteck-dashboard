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
    '/src/modules/comercial/sellout/PanelMapa.jsx',
    '/src/movil/pestanas/selloutGlobal/SellOutGlobal.jsx',
    '/src/movil/pestanas/selloutGlobal/Cuenta.jsx',
    '/src/modules/comercial/analisis/DrillCliente.jsx',
  ]) {
    const mod = await vite.ssrLoadModule(m);
    assert.equal(typeof mod.default, 'function', `${m} debe exportar default`);
  }
  const datos = await vite.ssrLoadModule('/src/modules/comercial/sellout/datos.js');
  for (const h of ['useCuentas', 'useDias', 'useMensual', 'useSkuMes', 'useEstadoMes', 'useEstadosHistoria', 'useDrillSkus', 'useDrillInventario']) {
    assert.equal(typeof datos[h], 'function', `datos.js debe exportar ${h}`);
  }
  const piezas = await vite.ssrLoadModule('/src/movil/pestanas/selloutGlobal/piezas.jsx');
  for (const c of ['ListaEstados', 'HojaEstado']) {
    assert.equal(typeof piezas[c], 'function', `piezas.jsx del celular debe exportar ${c}`);
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

test('los mini mapas del modo Cuentas también pintan los 32 estados, con sus huecos', async () => {
  const { default: MapaMexico, ESTADOS_MX } = await vite.ssrLoadModule('/src/modules/comercial/sellout/MapaMexico.jsx');
  const { ThemeProvider } = await vite.ssrLoadModule('/src/lib/themeContext.jsx');
  assert.equal(ESTADOS_MX.length, 32);
  const datos = [{ estado: 'JALISCO', importe: 600, importePrev: 0, yoy: null, pct: 100, clientes: 30, vendedores: 8, cuentas: [{ cuenta: 'cva', importe: 600, pct: 100 }], cuentasActivas: 1, ticketCf: 20 }];
  const huecosSet = new Set(ESTADOS_MX.filter((e) => e !== 'JALISCO'));
  const html = renderToString(React.createElement(ThemeProvider, null,
    React.createElement(MapaMexico, { datos, mini: true, escala: { max: 600, min: 0 }, huecosSet, alto: 150 })));
  assert.equal((html.match(/<path /g) || []).length, 32, 'cada mini mapa pinta los 32 estados');
  assert.ok(!/Sin estado en la fuente/.test(html), 'el mini mapa no repite la fila de "sin estado"');
  assert.ok(!/NaN/.test(html));
});

test('la leyenda del modo Medir sale con sus tres marcas', async () => {
  const { default: MapaMexico } = await vite.ssrLoadModule('/src/modules/comercial/sellout/MapaMexico.jsx');
  const { ThemeProvider } = await vite.ssrLoadModule('/src/lib/themeContext.jsx');
  const datos = [
    { estado: 'JALISCO', importe: 600, importePrev: 300, yoy: 100, pct: 60, clientes: 30, vendedores: 8, cuentas: [], cuentasActivas: 1, ticketCf: 20 },
    { estado: 'PUEBLA', importe: 100, importePrev: 400, yoy: -75, pct: 10, clientes: 5, vendedores: 2, cuentas: [], cuentasActivas: 1, ticketCf: 20 },
  ];
  const html = renderToString(React.createElement(ThemeProvider, null, React.createElement(MapaMexico, { datos, medida: 'yoy', compacto: true })));
  assert.ok(/linear-gradient/.test(html), 'la leyenda pinta la barra de color');
  assert.ok(!/NaN/.test(html));
});

test('el panel del mapa renderiza sus tres vistas (Medir · Cuentas · Tiempo)', async () => {
  const { default: PanelMapa } = await vite.ssrLoadModule('/src/modules/comercial/sellout/PanelMapa.jsx');
  const { ThemeProvider } = await vite.ssrLoadModule('/src/lib/themeContext.jsx');
  const { QueryClient, QueryClientProvider } = await vite.ssrLoadModule('/scripts/fixture-react-query.js');
  const { setPreferencia } = await vite.ssrLoadModule('/src/lib/preferencias.js');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const estadoMes = [
    { cuenta: 'cva', anio: 2026, mes: 8, estado: 'JALISCO',    importe: 600, cantidad: 60, clientes_finales: 30, vendedores: 8, facturas: 12 },
    { cuenta: 'guc', anio: 2026, mes: 8, estado: 'NUEVO LEON', importe: 300, cantidad: 30, clientes_finales: 10, vendedores: 3, facturas: 5 },
    { cuenta: 'cva', anio: 2025, mes: 8, estado: 'JALISCO',    importe: 900, cantidad: 90, clientes_finales: 40, vendedores: 9, facturas: 20 },
  ];
  // Un mini mapa por cuenta y los 32 estados en cada uno: la escala se comparte, la geometría no se recorta.
  const esperados = { medir: 32, cuentas: 64, tiempo: 32 };
  for (const [vista, paths] of Object.entries(esperados)) {
    setPreferencia('sellOut.mapaModo', vista);
    const html = renderToString(React.createElement(QueryClientProvider, { client },
      React.createElement(ThemeProvider, null,
        React.createElement(PanelMapa, { anio: 2026, mes: 8, estadoMes, estadoSel: null, onEstado: () => {}, nombres: { cva: 'CVA', guc: 'GUC' } }))));
    assert.equal((html.match(/<path /g) || []).length, paths, `la vista ${vista} debe pintar ${paths} estados`);
    assert.ok(!/NaN/.test(html), `la vista ${vista} no debe traer NaN`);
    assert.ok(html.includes('Jalisco'), `la vista ${vista} debe nombrar el estado`);
  }
  setPreferencia('sellOut.mapaModo', 'medir');
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
