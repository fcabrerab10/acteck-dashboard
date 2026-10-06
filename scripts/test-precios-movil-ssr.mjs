// Estrategia de Precios del celular (3.82.0 · 2026-10-05): SSR de las vistas puras con datos de ejemplo (sin red),
// cálculo puro del hero (margen ponderado por venta, debajo de lista, bajo el mínimo, mes sin venta → anterior),
// línea canónica de la propuesta (sin costo en el jsonb) y ruta.
//   node --test scripts/test-precios-movil-ssr.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

globalThis.window ??= globalThis;
globalThis.navigator ??= { userAgent: 'node', language: 'es-MX', onLine: true };
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {}, clear() {} };
globalThis.sessionStorage ??= globalThis.localStorage;
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.requestAnimationFrame ??= (f) => setTimeout(f, 0);
globalThis.addEventListener ??= () => {};
globalThis.removeEventListener ??= () => {};

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
test.after(async () => { await vite.close(); setTimeout(() => process.exit(process.exitCode || 0), 200).unref(); });

const { ThemeContext } = await vite.ssrLoadModule('/src/lib/themeContext.jsx');
const { getTheme } = await vite.ssrLoadModule('/src/lib/themeTokens.js');
const { NavContext } = await vite.ssrLoadModule('/src/movil/nav.jsx');
const { PreciosVista } = await vite.ssrLoadModule('/src/movil/pestanas/precios/EstrategiaPreciosM.jsx');
const { PropuestaVista } = await vite.ssrLoadModule('/src/movil/pestanas/precios/PropuestaPrecios.jsx');
const CalcMod = await vite.ssrLoadModule('/src/movil/pestanas/precios/Calculadora.jsx');
const { resumenPrecios, ventaDelMes, lineaDesdeCalculo, descuentoLinea } = await vite.ssrLoadModule('/src/movil/pestanas/precios/calculo.js');
const { construirFilas } = await vite.ssrLoadModule('/src/modules/comercial/precios/calculo.js');
const { clienteDeLista, filasExcel } = await vite.ssrLoadModule('/src/movil/pestanas/precios/propuesta.js');
const { destino } = await vite.ssrLoadModule('/src/movil/rutas.js');

const qc = new QueryClient();
const nav = { modo: 'barra', perfil: { user_id: 'u-f', es_super_admin: true }, push() {}, pop() {}, navegar() {}, agregarSku() {} };
const render = (C, props, themeKey = 'midnight') => renderToString(React.createElement(QueryClientProvider, { client: qc },
  React.createElement(ThemeContext.Provider, { value: { theme: getTheme(themeKey), setThemeKey() {} } },
    React.createElement(NavContext.Provider, { value: nav }, React.createElement(C, props))))).replace(/<!--.*?-->/g, '');
const sano = (s, donde) => { assert.ok(!/NaN|undefined|\[object Object\]/.test(s), `${donde}: NaN/undefined/[object Object] en el HTML`); };

// ── Datos de ejemplo ──
const ROADMAP = [
  { sku: 'AC-943154', descripcion: 'Monitor Plano 27 VA Captive Vivid SP270 II / 100 Hz', marca: 'Acteck', categoria: 'Monitores', familia: 'Monitor', rdmp: 'Core' },
  { sku: 'BR-937658', descripcion: 'Fuente de Poder GR Burst 650W', marca: 'Balam Rush', categoria: 'Fuentes de poder', familia: 'Fuentes', rdmp: 'Core' },
  { sku: 'AC-929042', descripcion: 'Gabinete Atom Slim', marca: 'Acteck', categoria: 'Gabinetes', familia: 'Gabinetes', rdmp: 'Core' },
  { sku: 'AC-900001', descripcion: 'Teclado sin precio', marca: 'Acteck', categoria: 'Periféricos', familia: 'Teclados', rdmp: 'Core' },
];
const PRECIOS = [
  { sku: 'AC-943154', lista: 'Mayoreo AAA', precio: 1300 }, { sku: 'AC-943154', lista: 'PCEL PROVISIONAL', precio: 1235 }, { sku: 'AC-943154', lista: 'API PROVISIONAL', precio: 1250 },
  { sku: 'BR-937658', lista: 'Mayoreo AAA', precio: 900 }, { sku: 'BR-937658', lista: 'API PROVISIONAL', precio: 887 },
  { sku: 'AC-929042', lista: 'Mayoreo AAA', precio: 680 }, { sku: 'AC-929042', lista: 'DICOTECH', precio: 640 },
];
const COSTOS = [{ articulo: 'AC-943154', costo_promedio: 1002 }, { articulo: 'BR-937658', costo_promedio: 700 }, { articulo: 'AC-929042', costo_promedio: 620 }];
const BAJOS = [{ sku: 'AC-943154', cliente_bajo: 'PC ONLINE', precio_bajo: 1150, piezas_bajo: 400 }, { sku: 'AC-929042', cliente_bajo: 'GRUPO CVA', precio_bajo: 600, piezas_bajo: 1000 }];
const CAMBIOS = [{ sku: 'AC-943154', lista: 'Mayoreo AAA', anio: 2026, mes: 10, precio_actual: 1300, precio_anterior: 1250, delta_pct: 4, tipo: 'subio' }, { sku: 'BR-937658', lista: 'Mayoreo AAA', anio: 2026, mes: 10, precio_actual: 900, precio_anterior: 950, delta_pct: -5.3, tipo: 'bajo' }];
const arr = (f) => Array.from({ length: 12 }, (_, i) => f(i + 1));
const SKU_ANIO = [
  { sku: 'AC-943154', anio: 2026, monto: arr((m) => (m <= 9 ? 400000 : null)) },
  { sku: 'BR-937658', anio: 2026, monto: arr((m) => (m <= 9 ? 100000 : null)) },
  { sku: 'AC-929042', anio: 2026, monto: arr((m) => (m <= 9 ? 50000 : null)) },
];
const filas = construirFilas({ roadmap: ROADMAP, precios: PRECIOS, bajos: BAJOS, promos: [], costos: COSTOS, cambios: CAMBIOS });
const filasPorSku = new Map(filas.map((f) => [f.sku, f]));
const costoDe = (sku) => filasPorSku.get(sku)?.costo || 0;

test('hero · octubre sin venta → pondera con septiembre; margen = Σ margen × venta / Σ venta; bajo el mínimo y debajo de lista', () => {
  const r = resumenPrecios({ filas, skuAnio: SKU_ANIO, anio: 2026, mes: 10, margenMinimo: 15, sensible: true });
  assert.equal(r.mesUsado.mes, 9); assert.equal(r.mesUsado.esOtroMes, true); assert.equal(r.mesUsado.label, 'Septiembre 2026');
  // márgenes AAA: monitor (1300−1002)/1300 = 22.92 · fuente (900−700)/900 = 22.22 · gabinete (680−620)/680 = 8.82
  const esperado = (22.923 * 400000 + 22.222 * 100000 + 8.824 * 50000) / 550000;
  assert.ok(Math.abs(r.margen.pct - esperado) < 0.05, `margen ponderado ${r.margen.pct} ≈ ${esperado}`);
  assert.equal(r.margen.bajoMinimo, 1, 'sólo el gabinete queda bajo 15 %');
  assert.equal(r.margen.vendidosConMargen, 3);
  assert.equal(r.bajo.skus, 2); assert.equal(r.bajo.dejado, (1235 - 1150) * 400 + (680 - 600) * 1000);
  assert.equal(r.bajo.top[0].sku, 'AC-929042', 'el que más dejó en la mesa primero');
  assert.equal(r.cambios.subieron, 1); assert.equal(r.cambios.bajaron, 1);
  assert.match(r.frase, /^Septiembre cerró con 2\d\.\d % de margen en Mayoreo AAA ponderado por venta; 2 SKUs se facturaron debajo de su lista en el año \(\$114K dejados en la mesa\) y 1 de los 3 vendidos quedan bajo tu mínimo de 15 %\.$/);
});

test('hero sin permiso sensible habla de cambios de precio, nunca de margen', () => {
  const r = resumenPrecios({ filas, skuAnio: SKU_ANIO, anio: 2026, mes: 10, sensible: false });
  assert.match(r.frase, /^En septiembre cambiaron de precio 2 SKUs \(1 subieron, 1 bajaron\); 2 SKUs se facturaron debajo de su lista/);
  assert.ok(!/margen/.test(r.frase));
});

test('ventaDelMes · enero sin venta cae a diciembre del año anterior', () => {
  const v = ventaDelMes([{ sku: 'X', anio: 2025, monto: arr(() => 10) }], 2026, 1);
  assert.equal(v.anio, 2025); assert.equal(v.mes, 12); assert.equal(v.esOtroMes, true); assert.equal(v.venta.get('X'), 10);
});

test('línea canónica: con descuento va custom (lista null) y guarda lista base y %; sin descuento lleva la lista; nunca costo', () => {
  const l = lineaDesdeCalculo({ sku: 'AC-943154', descripcion: 'Monitor', marca: 'Acteck', familia: 'Monitor', lista: 'PCEL PROVISIONAL', precioLista: 1235, piezas: 150, precioNeto: 1136.2, descuentoPct: 8 });
  assert.equal(l.custom, true); assert.equal(l.lista, null); assert.equal(l.listaBase, 'PCEL PROVISIONAL'); assert.equal(l.precio, 1136.2); assert.equal(l.descuentoPct, 8);
  assert.ok(!('costo' in l));
  const s = lineaDesdeCalculo({ sku: 'BR-937658', lista: 'API PROVISIONAL', precioLista: 887, piezas: 200, precioNeto: 887, descuentoPct: 0 });
  assert.equal(s.custom, undefined); assert.equal(s.lista, 'API PROVISIONAL');
  assert.equal(descuentoLinea({ precio: 90, precioLista: 100 }), 10);
  assert.equal(filasExcel([l])[0].listaSel, '__custom'); assert.equal(filasExcel([s])[0].listaSel, 'API PROVISIONAL');
  assert.equal(clienteDeLista('PCEL PROVISIONAL'), 'pcel'); assert.equal(clienteDeLista('Mayoreo AAA'), null);
});

const LINEAS = [
  lineaDesdeCalculo({ sku: 'AC-943154', descripcion: 'Monitor Plano 27 VA Captive Vivid SP270 II / 100 Hz', marca: 'Acteck', familia: 'Monitor', lista: 'PCEL PROVISIONAL', precioLista: 1235, piezas: 150, precioNeto: 1136.2, descuentoPct: 8 }),
  lineaDesdeCalculo({ sku: 'BR-937658', descripcion: 'Fuente de Poder GR Burst 650W', marca: 'Balam Rush', familia: 'Fuentes', lista: 'API PROVISIONAL', precioLista: 887, piezas: 200, precioNeto: 887, descuentoPct: 0 }),
];
const r = resumenPrecios({ filas, skuAnio: SKU_ANIO, anio: 2026, mes: 10, margenMinimo: 15, sensible: true });

test('SSR · PreciosVista con permiso sensible: hero, margen, calculadora, propuesta en curso con margen total', () => {
  const html = render(PreciosVista, { r, sensible: true, catalogo: ROADMAP, filasPorSku, costoDe, clienteKey: 'pcel', margenMinimo: 15, lineas: LINEAS, folio: null });
  sano(html, 'PreciosVista');
  assert.ok(html.includes('Septiembre cerró con'), 'frase del hero');
  assert.ok(html.includes('Margen Mayoreo AAA'), 'KPI de margen');
  assert.ok(html.includes('Debajo de lista') && html.includes('$114K'), 'KPI debajo de lista');
  assert.ok(html.includes('Calculadora') && html.includes('mínimo 15 %'), 'tarjeta de la calculadora con ⚙︎');
  assert.ok(html.includes('Propuesta en curso') && html.includes('AC-943154') && html.includes('(−8 %)'), 'línea con su descuento');
  assert.ok(/margen 1\d\.\d %/.test(html), 'margen total de la propuesta');
  assert.ok(html.includes('$347,830') || html.includes('$347,830'), 'total');
});

test('SSR · PreciosVista sin permiso sensible: ni costo ni margen', () => {
  const rs = resumenPrecios({ filas, skuAnio: SKU_ANIO, anio: 2026, mes: 10, sensible: false });
  const html = render(PreciosVista, { r: rs, sensible: false, catalogo: ROADMAP, filasPorSku, costoDe, clienteKey: 'pcel', margenMinimo: 15, lineas: LINEAS }, 'light');
  sano(html, 'PreciosVista sin sensible');
  assert.ok(html.includes('Cambios de precio'), 'KPI de cambios');
  assert.ok(!/margen/i.test(html.replace(/Margen mínimo/g, '')), 'sin la palabra margen');
  assert.ok(!html.includes('1,002'), 'sin costo promedio');
});

test('SSR · Calculadora con SKU inicial: lista natural del cliente, precio de lista, costo, resultado y botones', () => {
  const html = render(CalcMod.default, { catalogo: ROADMAP, filasPorSku, sensible: true, clienteKey: 'pcel', margenMinimo: 15, skuInicial: 'AC-943154' });
  sano(html, 'Calculadora');
  assert.ok(html.includes('Lista PCEL'), 'lista natural de PCEL');
  assert.ok(html.includes('$1,235.00'), 'precio de lista');
  assert.ok(html.includes('$1,002.00'), 'costo promedio');
  assert.ok(html.includes('Margen de lista') && html.includes('18.9 %'), 'margen de lista');
  assert.ok(html.includes('precios-range') && html.includes('type="range"'), 'barra de descuento');
  assert.ok(html.includes('Agregar a propuesta') && html.includes('Compartir'), 'botones');
  const vacio = render(CalcMod.default, { catalogo: ROADMAP, filasPorSku, sensible: false, clienteKey: 'digitalife', margenMinimo: 15 });
  sano(vacio, 'Calculadora vacía');
  assert.ok(vacio.includes('SKU, modelo, categoría'), 'buscador');
  assert.ok(!vacio.includes('mínimo 15 %'), 'sin ⚙︎ de margen mínimo sin permiso sensible');
});

test('SSR · PropuestaVista: hero con total/piezas/margen, líneas, texto de WhatsApp sin costo ni lista, 3 botones', () => {
  const m = { id: 'prp_x', clienteKey: 'pcel', clienteLabel: 'PCEL', nombre: 'Cierre', estado: 'borrador', anio: 2026, mes: 10, vigencia: '2026-10-31', lineas: LINEAS, folio: null };
  const html = render(PropuestaVista, { m, sensible: true, costoDe });
  sano(html, 'PropuestaVista');
  assert.ok(html.includes('$347,830'), 'total');
  assert.ok(html.includes('350') && html.includes('sólo tú lo ves'), 'piezas y margen privado');
  assert.ok(html.includes('*Acteck · Propuesta PCEL*') && html.includes('vigencia al 31 oct 2026'), 'texto de WhatsApp');
  assert.ok(!html.includes('1,002') && !/PCEL PROVISIONAL\b[^·]*\+ IVA/.test(html), 'el texto no lleva costo');
  assert.ok(html.includes('>WhatsApp<') && html.includes('>Excel<') && html.includes('>Enviar<'), 'tres botones');
  const env = render(PropuestaVista, { m: { ...m, estado: 'enviada', folio: 'PRP-2610-004' }, sensible: false, costoDe });
  sano(env, 'PropuestaVista enviada');
  assert.ok(env.includes('PRP-2610-004') && env.includes('>Enviada<'), 'enviada con folio');
  assert.ok(!env.includes('sólo tú lo ves'), 'sin margen sin permiso');
});

test('ruta · estrategiaPrecios abre la pantalla nueva (push) y acepta extra.sku', () => {
  const d = destino({ pagina: 'estrategiaPrecios', extra: { sku: 'AC-943154' } });
  assert.equal(d.tipo, 'push'); assert.equal(d.key, 'precios');
  assert.equal(d.el.props.inicial.sku, 'AC-943154');
});
