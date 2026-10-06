// S&OP y Proyectos y forecast del celular (3.83.0 · 2026-10-05): SSR de las vistas puras con datos de ejemplo (sin red)
// + rutas + cara Abasto de Producto 360. Los motores puros se prueban en scripts/test-sop-movil-calculo.mjs.
//   node --test scripts/test-sop-forecast-movil-ssr.mjs
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
const { SopEmpresaVista, SopClientesVista } = await vite.ssrLoadModule('/src/movil/pestanas/sop/SopM.jsx');
const { LoQueVieneVista } = await vite.ssrLoadModule('/src/movil/pestanas/sop/LoQueViene.jsx');
const { FichaPOVista, textoArribo } = await vite.ssrLoadModule('/src/movil/pestanas/sop/FichaPO.jsx');
const { AbastoVista, porQue, fraseAbasto } = await vite.ssrLoadModule('/src/movil/pestanas/producto/Abasto.jsx');
const { ForecastVista } = await vite.ssrLoadModule('/src/movil/pestanas/forecast/ForecastM.jsx');
const { EditorSku } = await vite.ssrLoadModule('/src/movil/pestanas/forecast/CapturaForecast.jsx');
const sop = await vite.ssrLoadModule('/src/movil/pestanas/sop/calculo.js');
const fc = await vite.ssrLoadModule('/src/movil/pestanas/forecast/calculo.js');
const { destino } = await vite.ssrLoadModule('/src/movil/rutas.js');
const { SILUETAS } = await vite.ssrLoadModule('/src/components/kit/siluetas.js');

const qc = new QueryClient();
const nav = { modo: 'barra', perfil: { user_id: 'u-f', es_super_admin: true }, push() {}, pop() {}, navegar() {}, agregarSku() {} };
const render = (C, props, themeKey = 'midnight') => renderToString(React.createElement(QueryClientProvider, { client: qc },
  React.createElement(ThemeContext.Provider, { value: { theme: getTheme(themeKey), setThemeKey() {} } },
    React.createElement(NavContext.Provider, { value: nav }, React.createElement(C, props))))).replace(/<!--.*?-->/g, '');
const sano = (s, donde) => { assert.ok(!/NaN|undefined|\[object Object\]/.test(s), `${donde}: NaN/undefined/[object Object] en el HTML`); };

const HOY = new Date(2026, 9, 5, 12);
const rows = [
  { sku: 'AC-943154', descripcion: 'Monitor Vivid 27', marca: 'Acteck', familia: 'Monitores', supplier: 'SHENZHEN ACTECK', inv: 700, demMes: 2310, ritmo3m: 2310, coberturaDiasErp: 8, brecha: 2870, sugerido: 3000, necesidadNeta: 2870, objetivo3m: 6930, mesesSeguridad: 0, ultimoCostoUsd: 82, traCant: 3360, ltDias: 105, piezasPorContenedor: 1000, contenedoresSugeridos: 3, esConsolidado: false, crecimientoPct: 0, embarques: [{ po: 'ABT338', eta: '2026-11-10', cantidad: 3360 }] },
  { sku: 'BR-942539', descripcion: 'Monitor Earth 27', marca: 'Balam Rush', familia: 'Monitores', supplier: 'SHENZHEN ACTECK', inv: 340, demMes: 480, ritmo3m: 480, coberturaDiasErp: 21, brecha: 1100, sugerido: 1200, necesidadNeta: 1100, objetivo3m: 1440, ultimoCostoUsd: 98, traCant: 0, ltDias: 113, embarques: [] },
  { sku: 'AC-945936', descripcion: 'Teclado y mouse Creator', marca: 'Acteck', familia: 'Periféricos', inv: 0, demMes: 200, ritmo3m: 200, coberturaDiasErp: 0, brecha: 600, sugerido: 800, necesidadNeta: 600, objetivo3m: 600, ultimoCostoUsd: 8.2, traCant: 0, ltDias: 98, embarques: [] },
];
const transito = [
  { sku: 'AC-943154', supplier: 'SHENZHEN ACTECK', cantidad: 3360, embarques_detalle: [{ po: 'ABT338', cantidad: 3360, eta: '2026-11-10', etd: '2026-09-20', cedis: 'ALMACENES ZAPOPAN', estatus: 'EN PRODUCCION', contenedor: 'C1' }] },
  { sku: 'AC-939409', supplier: 'SHENZHEN ACTECK', cantidad: 1200, embarques_detalle: [{ po: 'ABT280', cantidad: 1200, eta: '2026-10-09', etd: '2026-09-02', cedis: 'ALMACENES ZAPOPAN', estatus: 'TRANSITO MARITIMO', contenedor: 'CAAU5936368' }] },
];
const porSku = new Map(rows.map((r) => [r.sku, r]));
const arribos = sop.arribosPorPo({ transito, porSku, navieraPor: new Map([['CAAU5936368', 'MSK']]), hoy: HOY });
const res = sop.resumenEmpresa({ rows, arribos, hoy: HOY, sensible: true });
const serie = sop.serieDemanda({ rows, llegadas: [{ sku: 'AC-943154', eta: '2026-11-10', cantidad: 3360 }], hoy: HOY, meses: 6 });
const comprar = sop.comprarAhora(rows);
const filas = sop.filasDetalle(rows);

test('S&OP · Empresa: hero, 4 tarjetas, gráfica, comprar ahora y tabla', () => {
  for (const sensible of [true, false]) {
    const html = render(SopEmpresaVista, { res: sop.resumenEmpresa({ rows, arribos, hoy: HOY, sensible }), serie, comprar, filas, categorias: ['Monitores', 'Periféricos'], sensible, puedeEditar: true, enSolicitud: new Set(['BR-942539']), hoy: HOY });
    sano(html, `empresa sensible=${sensible}`);
    assert.match(html, /Lo que viene/); assert.match(html, /Llega en octubre/); assert.match(html, /Llega en noviembre/); assert.match(html, /Siguiente arribo/); assert.match(html, /En camino total/);
    assert.match(html, /Demanda vs lo que tendremos/); assert.match(html, /Comprar ahora/); assert.match(html, /\+ Solicitud/); assert.match(html, /En solicitud/); assert.match(html, /Agregar todos a la solicitud/);
    assert.match(html, /Detalle por SKU/); assert.match(html, /Críticos/); assert.match(html, /Sin PO/); assert.match(html, /AC-943154/);
    if (sensible) assert.match(html, /USD/); else assert.doesNotMatch(html, /USD/);
  }
});

test('S&OP · Mis clientes: tarjetas por cliente, comprar para mis clientes, enlace a Proyectos y forecast', () => {
  const ventana = sop.mesesDesde(HOY, 6, 1);
  const r = sop.calcularMisClientes({ clientes: [
    { key: 'digitalife', label: 'Digitalife', forecast: [{ sku: 'AC-943154', key: '2026-11', piezas: 150 }, { sku: 'AC-943154', key: '2026-12', piezas: 2000 }], stock: new Map([['AC-943154', 100]]) },
    { key: 'pcel', label: 'PCEL', forecast: [{ sku: 'BR-942539', key: '2026-11', piezas: 1200 }], stock: new Map() },
    { key: 'dicotech', label: 'Dicotech', forecast: [], stock: new Map() },
  ], inventario: new Map([['AC-943154', 700], ['BR-942539', 340]]), llegadas: [{ sku: 'AC-943154', eta: '2026-11-10', cantidad: 3360 }], ventana, costos: new Map([['AC-943154', 82], ['BR-942539', 98]]), descripciones: new Map([['BR-942539', 'Monitor Earth 27']]), hoy: HOY });
  const html = render(SopClientesVista, { res: r, sensible: true, puedeEditar: true });
  sano(html, 'mis clientes');
  assert.match(html, /Forecast − inventario − tránsito/); assert.match(html, /Digitalife/); assert.match(html, /PCEL/); assert.match(html, /Dicotech/);
  assert.match(html, /Comprar para mis clientes/); assert.match(html, /BR-942539 Monitor Earth 27/); assert.match(html, /falta desde noviembre/); assert.match(html, /sin PO/);
  assert.match(html, /Capturar forecast en Proyectos y forecast/); assert.match(html, /sin forecast capturado/);
  assert.equal(r.comprar.length, 1); assert.equal(r.comprar[0].piezas, 860); // PCEL 1200 − 340 nuestras
});

test('Lo que viene y ficha de PO', () => {
  const html = render(LoQueVieneVista, { arribos, sensible: true, vista: 'fecha', tiempos: { anio: 2026, proveedores: [{ supplier: 'SHENZHEN ACTECK', embarques: 12, dias_produccion_med: 40, dias_transito_med: 55, dias_total_med: 106 }], navieras: [{ naviera: 'MSK', contenedores: 8, cbm: 400, dias_transito_med: 50, usd_por_cbm: 56 }], tot: { totalMed: 106, transitoMed: 55, usdPorCbm: 56 } } });
  sano(html, 'lo que viene');
  assert.match(html, /Lo que viene/); assert.match(html, /2 PO/); assert.match(html, /octubre 2026/); assert.match(html, /noviembre 2026/); assert.match(html, /PO ABT280/); assert.match(html, /MSK/); assert.match(html, /Tiempos reales/);
  const porProv = render(LoQueVieneVista, { arribos, vista: 'proveedor' });
  assert.match(porProv, /Shenzhen Acteck|SHENZHEN ACTECK/i);
  const po = arribos.find((p) => p.po === 'ABT280');
  const ficha = render(FichaPOVista, { po, sensible: true, onSku() {} });
  sano(ficha, 'ficha po');
  assert.match(ficha, /PO ABT280/); assert.match(ficha, /CAAU5936368/); assert.match(ficha, /9 de octubre/); assert.match(ficha, /Zapopan/); assert.match(ficha, /SKUs en la PO/); assert.match(ficha, /Compartir arribo/);
  assert.match(textoArribo(po), /PO ABT280/); assert.match(textoArribo(po), /AC-939409/);
});

test('Producto 360 · cara Abasto: hero, cobertura, sugerido, lo que llega, por qué', () => {
  const r = rows[0];
  const html = render(AbastoVista, { row: r, arribos: arribos.filter((p) => p.po === 'ABT338'), sensible: true, puedeEditar: true, cantidad: 3000, onCantidad() {} });
  sano(html, 'abasto');
  assert.match(html, /Abasto/); assert.match(html, /Se agota en 8 días/); assert.match(html, /ABT338/); assert.match(html, /10 de noviembre/); assert.match(html, /Cobertura/); assert.match(html, /Sugerido/); assert.match(html, /3 cnt × 1,000/);
  assert.match(html, /Por qué 3,000 pz/); assert.match(html, /Agregar a solicitud/);
  assert.match(porQue(r, { hoy: HOY }), /2,310 pz\/mes/); assert.match(porQue(r, { hoy: HOY }), /ya va tarde/);
  assert.match(fraseAbasto(rows[2], []), /Está agotado con demanda; no hay nada en camino/);
  const vacio = render(AbastoVista, { row: null, arribos: [] });
  assert.match(vacio, /Sin datos de abasto/);
});

test('Proyectos y forecast: vista por cliente y «Los tres», editor de captura', () => {
  const ventana = sop.mesesDesde(HOY, 6, 1);
  const roadmap = new Map([['AC-943154', { descripcion: 'Monitor Vivid 27', marca: 'Acteck' }]]);
  const a = fc.estadoCliente({ key: 'digitalife', label: 'Digitalife', ventana, roadmap, hoy: HOY, crm: [{ sku: 'AC-943154', anio: 2026, mes: 11, piezas: 150, estado: 'borrador', justificacion: 'Temporada Buen Fin y reposición de sucursales' }], sugerido: [{ sku: 'BR-942539', descripcion: 'Monitor Earth 27', meses: { '2026-11': 70 }, justificacion: 'Ritmo de sell out de 60 pz/mes' }], proyectos: [{ sku: 'AC-943154', key: '2026-11', piezas: 1000, nombre: 'Bocinas', probabilidad: 'confirmado' }], lotes: [{ id: 'l1', clientes: ['digitalife'], filas: 31, archivo_nombre: 'Plantilla_Forecast_2026-10.xlsx', created_at: '2026-10-01T10:00:00Z', cargado_crm_at: null }] });
  const b = fc.estadoCliente({ key: 'pcel', label: 'PCEL', ventana, hoy: HOY, existente: [{ sku: 'AC-943154', mes: '2026-12-01', piezas: 300 }] });
  const c = fc.estadoCliente({ key: 'dicotech', label: 'Dicotech', ventana, hoy: HOY });
  const proyectos = [{ id: 'p1', nombre: 'Bocinas Dynamic', cliente: 'digitalife', anio: 2026, mes: 11, probabilidad: 'confirmado', pz: 1000, skus: 2 }];
  const html = render(ForecastVista, { estado: { ...a, lotesLista: a.resumen.lotes.n ? [{ id: 'l1', clientes: ['digitalife'], filas: 31, archivo_nombre: 'Plantilla_Forecast_2026-10.xlsx', created_at: '2026-10-01T10:00:00Z', cargado_crm_at: null }] : [] }, clienteSel: 'digitalife', ventana, proyectos, puedeEditar: true, sugeridoTotal: { skus: 1, pz: 70 } });
  sano(html, 'forecast digitalife');
  assert.match(html, /Digitalife · forecast a 6 meses/); assert.match(html, /En el CRM/); assert.match(html, /Por capturar/); assert.match(html, /Borrador/); assert.match(html, /Proyectos/);
  assert.match(html, /Capturar forecast/); assert.match(html, /AC-943154 Monitor Vivid 27/); assert.match(html, /nov 150/); assert.match(html, /borrador/); assert.match(html, /Bocinas Dynamic/);
  assert.match(html, /Lotes exportados al CRM/); assert.match(html, /Ya lo cargué/); assert.match(html, /Qué hay que comprar/); assert.match(html, /Exportar plantilla del CRM · 1/);
  const todos = fc.sumarClientes([a, b, c]);
  const h2 = render(ForecastVista, { estado: { ...todos, lotesLista: [] }, clienteSel: 'todos', ventana, proyectos, filtro: 'todo', puedeEditar: false });
  sano(h2, 'forecast todos');
  assert.match(h2, /Los tres clientes · forecast a 6 meses/); assert.match(h2, /Digitalife 150 · PCEL 300/); assert.doesNotMatch(h2, /Capturar forecast/);
  const ed = render(EditorSku, { sku: 'AC-943154', descripcion: 'Monitor Vivid 27', ventana, meses: { '2026-11': 150, '2026-12': 200 }, onMeses() {}, justificacion: 'Temporada', onJustificacion() {}, sugerido: { meses: { '2026-11': 150 }, base: 150, stock: 100 }, origen: 'borrador' });
  sano(ed, 'editor');
  assert.match(ed, /Usar sugerido/); assert.match(ed, /Total 350 pz en 2 meses/); assert.match(ed, /Justificación · mínimo 15 caracteres/); assert.match(ed, /Nov/); assert.match(ed, /Abr/);
});

test('rutas y siluetas', () => {
  assert.equal(destino({ pagina: 'forecastClientes', extra: { vista: 'clientes' } }).tipo, 'push');
  assert.equal(destino({ pagina: 'forecastClientes' }).key, 'sop');
  assert.equal(destino({ pagina: 'forecastReservas' }).key, 'forecast');
  assert.equal(destino({ pagina: 'forecastReservas', extra: { proyectoId: 'p1' } }).key, 'proyectos-p1');
  assert.ok(Array.isArray(SILUETAS.movilProyectos));
});
