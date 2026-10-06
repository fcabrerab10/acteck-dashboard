// Propuestas en el celular (3.87.0 · 2026-10-06): cálculo puro (resumen, frase, sugeridos) + SSR de la lista y de Revisar.
//   node --test scripts/test-propuestas-movil.mjs
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
const calc = await vite.ssrLoadModule('/src/movil/pestanas/propuestas/calculo.js');
const { PropuestasVista } = await vite.ssrLoadModule('/src/movil/pestanas/Propuestas.jsx');
const { default: RevisarM } = await vite.ssrLoadModule('/src/movil/pestanas/propuestas/RevisarM.jsx');

const qc = new QueryClient();
const nav = { modo: 'barra', perfil: { user_id: 'u-f', es_super_admin: true }, push() {}, pop() {}, navegar() {}, agregarSku() {} };
const render = (C, props) => renderToString(React.createElement(QueryClientProvider, { client: qc }, React.createElement(ThemeContext.Provider, { value: { theme: getTheme('midnight'), setThemeKey() {} } }, React.createElement(NavContext.Provider, { value: nav }, React.createElement(C, props))))).replace(/<!--.*?-->/g, '');
const sano = (s, d) => assert.ok(!/NaN|undefined|\[object Object\]/.test(s), `${d}: NaN/undefined en el HTML`);

const HOY = new Date(2026, 9, 6, 12);
const lineas = [{ sku: 'AC-943154', piezas: 200, precio: 1890, lista: 'Mayoreo AAA', descripcion: 'Monitor Brite 19.5' }, { sku: 'BR-942539', piezas: 300, precio: 3120, lista: 'Mayoreo AAA', descripcion: 'Monitor Earth 27' }];
const props = [
  { id: 'p1', clienteKey: 'pcel', clienteLabel: 'PCEL', nombre: 'Cierre', estado: 'enviada', tstamp: Date.parse('2026-10-04'), anio: 2026, mes: 10, lineas, resumen: { skus: 2, piezas: 500, total: 1314000 }, enviadaAt: '2026-10-04T10:00:00Z', folio: 'PRP-2610-014' },
  { id: 'p2', clienteKey: 'digitalife', clienteLabel: 'Digitalife', nombre: 'Agotados', estado: 'borrador', tstamp: Date.parse('2026-10-05'), anio: 2026, mes: 10, lineas: [lineas[0]], resumen: { skus: 1, piezas: 200, total: 378000 }, updatedAt: '2026-10-05T10:00:00Z' },
  { id: 'p3', clienteKey: 'digitalife', clienteLabel: 'Digitalife', nombre: 'Cierre', estado: 'cerrada', tstamp: Date.parse('2026-09-02'), anio: 2026, mes: 9, lineas, resumen: { skus: 2, piezas: 500, total: 1314000 }, enviadaAt: '2026-08-20T10:00:00Z' },
];
const factMap = new Map([['digitalife|2026-09|AC-943154', { piezas: 200, monto: 378000 }], ['digitalife|2026-09|BR-942539', { piezas: 100, monto: 312000 }]]);

test('resumenPropuestas: estados del mes, conversión ponderada, serie y frase', () => {
  const r = calc.resumenPropuestas({ propuestas: props, factMap, anio: 2026, mes: 10, hoy: HOY });
  assert.equal(r.delMes.n, 2); assert.equal(r.borradores.n, 1); assert.equal(r.enviadas.n, 1); assert.equal(r.cerradas.n, 0);
  // p3: ventana sep (enviada 20 ago → sólo septiembre, completa el 1 oct): convertido = 378K + min(312K, 936K) = 690K de 1,314K → 52.5 %
  assert.equal(Math.round(r.conversion), 53); assert.equal(r.nConv, 1);
  assert.equal(r.serie.length, 12); const sep = r.serie[10]; assert.equal(sep.label, 'Sep'); assert.equal(sep.propuesto, 1314000); assert.equal(sep.facturado, 690000);
  assert.equal(r.ultima.id, 'p1');
  assert.match(calc.frasePropuestas(r, { mes: 10, hoy: HOY }), /Van 2 propuestas para octubre por \$1\.7M: 1 en borrador, 1 enviada esperando OC\. Las últimas convirtieron el 53 %\./);
  assert.equal(calc.diasDesde('2026-10-04T10:00:00Z', HOY), 2);
});

test('sugeridosArmador: agotado o < 30 días en el cliente, topado a nuestro stock', () => {
  const s = calc.sugeridosArmador({ sellout3m: new Map([['AC-1', 450], ['BR-2', 270], ['AC-3', 300], ['AC-4', 90]]), stockCliente: new Map([['AC-1', 0], ['BR-2', 20], ['AC-3', 900]]), nuestro: new Map([['AC-1', 700], ['BR-2', 1240], ['AC-4', 3]]), descripciones: new Map([['AC-1', 'Monitor']]), enLineas: new Set() });
  assert.deepEqual(s.lista.map((x) => x.sku), ['AC-1', 'BR-2', 'AC-4']); // AC-3 tiene 900 pz (muchos días); AC-4 sin stock Acteck al final
  assert.equal(s.lista[0].piezas, 150); assert.equal(s.lista[1].piezas, 70); assert.equal(s.lista[2].sinStock, true); assert.equal(s.aceptables, 2);
  assert.equal(calc.lineaSugerido(s.lista[0], 'Digitalife'), 'vende 150 pz/mes · 0 en Digitalife · tenemos 700');
});

test('SSR · lista de propuestas y Revisar', () => {
  const r = calc.resumenPropuestas({ propuestas: props, factMap, anio: 2026, mes: 10, hoy: HOY });
  const html = render(PropuestasVista, { r, propuestas: props, anio: 2026, mes: 10, hoy: HOY, onAbrir() {}, onNueva() {}, onDuplicar() {}, onEliminar() {} });
  sano(html, 'lista');
  assert.match(html, /Borradores/); assert.match(html, /Enviadas/); assert.match(html, /Cerradas/); assert.match(html, /Conversión ⌀/); assert.match(html, /53 %/); assert.match(html, /Propuesto vs facturado · 12 m/);
  assert.match(html, /PCEL · PRP-2610-014/); assert.match(html, /enviada hace 2 d/); assert.match(html, /Digitalife · Cierre/); assert.match(html, /facturó 2 SKUs/); assert.match(html, /Nueva propuesta/);
  const rev = render(RevisarM, { cli: { key: 'digitalife', label: 'Digitalife' }, nombre: 'Cierre', mes: '2026-10', vigencia: '2026-10-31', lineas: lineas.map((l) => ({ ...l, listaSel: 'Mayoreo AAA' })), precios: new Map([['AC-943154', { 'Mayoreo AAA': 1890, 'Mayoreo AA': 1950 }]]), inventario: new Map([['BR-942539', 100]]), stockCliente: new Map([['AC-943154', 0]]), texto: '*Acteck · Propuesta Digitalife*', total: 1314000, piezas: 500, onLinea() {}, onWhatsApp() {}, onExcel() {}, onEnviar() {} });
  sano(rev, 'revisar');
  assert.match(rev, /\$1,314,000/); assert.match(rev, /Líneas/); assert.match(rev, /200 pz × \$1,890\.00/); assert.match(rev, /tenemos 100 \(pides 300\)/); assert.match(rev, /falta stock/); assert.match(rev, /Texto para el cliente/); assert.match(rev, /WhatsApp/); assert.match(rev, /Excel/); assert.match(rev, /Enviar/);
  assert.match(rev, /1 con más piezas de las que tenemos/);
});
