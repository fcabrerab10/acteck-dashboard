// Smoke SSR de "Proyectos y abasto": carga con el pipeline de Vite todos los módulos nuevos
// (web + celular) y renderiza a string las piezas que no necesitan red, para atrapar imports
// rotos, ciclos y JSX inválido antes de abrir el navegador.
//   node --test scripts/test-proyectos-ssr.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';

globalThis.window ??= globalThis;
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {}, clear() {} };
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
test.after(async () => { await vite.close(); setTimeout(() => process.exit(process.exitCode || 0), 200).unref(); });

const PANTALLAS = [
  '/src/modules/comercial/ProyectosAbasto.jsx',
  '/src/modules/comercial/proyectos/Tablero.jsx',
  '/src/modules/comercial/proyectos/TarjetaProyecto.jsx',
  '/src/modules/comercial/proyectos/HojaProyecto.jsx',
  '/src/modules/comercial/proyectos/MatrizSkuMes.jsx',
  '/src/modules/comercial/proyectos/HojaSku.jsx',
  '/src/modules/comercial/proyectos/QueFaltaComprar.jsx',
  '/src/modules/comercial/proyectos/Historial.jsx',
  '/src/movil/pestanas/Proyectos.jsx',
];

test('todos los módulos de la pantalla cargan y exportan default', async () => {
  for (const m of PANTALLAS) {
    const mod = await vite.ssrLoadModule(m);
    assert.equal(typeof mod.default, 'function', `${m} debe exportar default`);
  }
  const datos = await vite.ssrLoadModule('/src/modules/comercial/proyectos/datos.js');
  for (const h of ['useProyectos', 'useAbasto', 'useHistorialProyectos', 'crearProyecto', 'actualizarProyecto', 'eliminarProyecto', 'guardarLinea', 'eliminarLinea', 'reservarLinea', 'mandarAlSop']) {
    assert.equal(typeof datos[h], 'function', `datos.js debe exportar ${h}`);
  }
  const campos = await vite.ssrLoadModule('/src/modules/comercial/proyectos/campos.jsx');
  for (const c of ['Campo', 'Entrada', 'AreaTexto', 'Selector']) assert.equal(typeof campos[c], 'function');
});

test('la matriz y el tablero renderizan con datos de mentira, sin NaN', async () => {
  const { ThemeProvider } = await vite.ssrLoadModule('/src/lib/themeContext.jsx');
  const { calcular, matriz, tablero, mesesHorizonte } = await vite.ssrLoadModule('/src/modules/comercial/proyectos/calculo.js');
  const { default: MatrizSkuMes } = await vite.ssrLoadModule('/src/modules/comercial/proyectos/MatrizSkuMes.jsx');
  const { default: Tablero } = await vite.ssrLoadModule('/src/modules/comercial/proyectos/Tablero.jsx');

  const hoy = new Date(2026, 9, 15);
  const meses = mesesHorizonte(hoy, 6);
  const res = calcular({
    proyectos: [{ id: 'p1', nombre: 'Licitación SEP', cliente: 'digitalife', anio: 2026, mes: 11, probabilidad: 'confirmado', responsable: 'Fernando' }],
    lineas: [{ id: 'l1', proyecto_id: 'p1', sku: 'AC-123', piezas: 500, reservado: 100 }],
    inventario: [{ sku: 'AC-123', disponible: 200 }],
    transito: [{ sku: 'AC-123', cantidad: 100, embarques_detalle: [{ cantidad: 100, eta: '2026-12-10', po: 'PO9' }] }],
    leadTimes: [{ sku: 'AC-123', dias_promedio: 90, supplier_principal: 'ACME' }],
    meses, hoy,
  });

  const htmlMatriz = renderToString(React.createElement(ThemeProvider, null,
    React.createElement(MatrizSkuMes, { filas: matriz(res, { medida: 'necesidad' }), horizonte: meses, medida: 'necesidad' })));
  assert.ok(htmlMatriz.includes('AC-123'));
  assert.ok(!/NaN/.test(htmlMatriz), 'la matriz no debe traer NaN');

  const htmlTablero = renderToString(React.createElement(ThemeProvider, null,
    React.createElement(Tablero, { columnas: tablero(res), puedeEditar: true })));
  assert.ok(htmlTablero.includes('Licitación SEP'));
  assert.ok(!/NaN/.test(htmlTablero), 'el tablero no debe traer NaN');
});

test('"Qué falta comprar" pinta el SKU con su fecha límite', async () => {
  const { ThemeProvider } = await vite.ssrLoadModule('/src/lib/themeContext.jsx');
  const { default: QueFaltaComprar } = await vite.ssrLoadModule('/src/modules/comercial/proyectos/QueFaltaComprar.jsx');
  const compras = [{ sku: 'AC-123', descripcion: 'Teclado', falta: 300, mesLabel: 'Nov 26', proveedor: 'ACME', leadTime: 90, limite: '2026-08-03', diasAlLimite: -73, llegaTarde: true }];
  const html = renderToString(React.createElement(ThemeProvider, null,
    React.createElement(QueFaltaComprar, { compras, puedeEditar: true })));
  assert.ok(html.includes('AC-123'));
  assert.ok(html.includes('Vencido'));
  assert.ok(!/NaN/.test(html));
});

test('las siluetas de carga existen para la web y el celular', async () => {
  const { SILUETAS } = await vite.ssrLoadModule('/src/components/kit/siluetas.js');
  assert.ok(Array.isArray(SILUETAS.proyectos), 'falta la silueta web `proyectos`');
  assert.ok(Array.isArray(SILUETAS.movilProyectos), 'falta la silueta móvil `movilProyectos`');
});

test('la alerta de proyectos sabe a dónde llevar', async () => {
  const { areaAlerta, accionAlerta } = await vite.ssrLoadModule('/src/lib/alertas.js');
  for (const tipo of ['proyecto_sin_cobertura', 'arribo_tarde_proyecto']) {
    assert.equal(areaAlerta({ tipo }), 'forecast');
    assert.deepEqual(accionAlerta({ tipo }), { tipo: 'navegar', clienteKey: null, pagina: 'forecastReservas', label: 'Ver', sku: null });
  }
});

test('la ruta móvil de forecastReservas apunta a la pantalla nueva', async () => {
  const { destino } = await vite.ssrLoadModule('/src/movil/rutas.js');
  const d = destino({ pagina: 'forecastReservas', clienteKey: null });
  assert.equal(d.tipo, 'push');
  assert.equal(d.key, 'proyectos');
});

test('la pantalla completa renderiza con datos sembrados (hero, KPIs, tablero y compras)', async () => {
  const { ThemeProvider } = await vite.ssrLoadModule('/src/lib/themeContext.jsx');
  const { QueryClient, QueryClientProvider } = await vite.ssrLoadModule('/scripts/fixture-react-query.js');
  const { default: ProyectosAbasto } = await vite.ssrLoadModule('/src/modules/comercial/ProyectosAbasto.jsx');

  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  const anio = new Date().getFullYear();
  const mes = new Date().getMonth() + 1;
  client.setQueryData(['proyectos'], {
    proyectos: [{ id: 'p1', nombre: 'Licitación SEP', cliente: 'digitalife', anio, mes, probabilidad: 'confirmado', responsable: 'Fernando' }],
    lineas: [{ id: 'l1', proyecto_id: 'p1', sku: 'AC-123', piezas: 500, reservado: 0 }],
  });
  client.setQueryData(['proyectos', 'abasto'], {
    inventario: [{ sku: 'AC-123', disponible: 200 }],
    transito: [], leadTimes: [{ sku: 'AC-123', dias_promedio: 90, supplier_principal: 'ACME' }],
    leadProveedor: [], descripciones: new Map([['AC-123', 'Teclado']]), catalogoSkus: [],
  });

  const html = renderToString(React.createElement(QueryClientProvider, { client },
    React.createElement(ThemeProvider, null, React.createElement(ProyectosAbasto))));
  assert.ok(html.includes('Licitación SEP'), 'la tarjeta del proyecto se pinta');
  assert.ok(html.includes('Qué falta comprar'), 'el panel lateral está montado');
  assert.ok(html.includes('AC-123'), 'el SKU faltante aparece en el panel');
  assert.ok(/1 proyecto por 500 pz/.test(html), 'la frase del hero se arma');
  assert.ok(/falta 1 SKU por comprar/.test(html), 'la frase dice qué falta comprar, en singular');
  assert.ok(!/NaN/.test(html), 'ningún NaN en la pantalla');
  assert.ok(!/undefined/.test(html), 'ningún "undefined" impreso');
});
