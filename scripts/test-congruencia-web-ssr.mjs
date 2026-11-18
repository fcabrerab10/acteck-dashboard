// Congruencia web ↔ celular (2026-11-18): bloques del celular llevados a la web. SSR de las vistas puras con datos de
// ejemplo (sin red) + los motores compartidos que se movieron de src/movil a src/modules.
//   1. S&OP · «Demanda vs stock · 6 meses» y «Comprar ahora»      (forecast/DemandaComprar.jsx)
//   2. S&OP · arribos por PO y ficha de PO con «Compartir arribo»  (forecast/FichaPOWeb.jsx)
//   3. Proyectos y forecast · «Los tres» con reparto por cliente   (proyectos/ForecastLosTres.jsx)
//   4. Producto 360 en la web                                      (producto360/Producto360Web.jsx)
//   node --test scripts/test-congruencia-web-ssr.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
const sop = await vite.ssrLoadModule('/src/modules/comercial/forecast/sopCalculo.js');
const sopMovil = await vite.ssrLoadModule('/src/movil/pestanas/sop/calculo.js');
const { DemandaStockVista, ComprarAhoraVista, mesesCortos } = await vite.ssrLoadModule('/src/modules/comercial/forecast/DemandaComprar.jsx');
const { ArribosVista, FichaPOVistaWeb } = await vite.ssrLoadModule('/src/modules/comercial/forecast/FichaPOWeb.jsx');
const fe = await vite.ssrLoadModule('/src/modules/comercial/proyectos/forecastEstado.js');
const { ForecastLosTresVista, filasLosTres } = await vite.ssrLoadModule('/src/modules/comercial/proyectos/ForecastLosTres.jsx');
const p360 = await vite.ssrLoadModule('/src/modules/comercial/producto360/calculo.js');
const { Producto360Vista } = await vite.ssrLoadModule('/src/modules/comercial/producto360/Producto360Web.jsx');

const qc = new QueryClient();
const render = (C, props, themeKey = 'midnight') => renderToString(React.createElement(QueryClientProvider, { client: qc },
  React.createElement(ThemeContext.Provider, { value: { theme: getTheme(themeKey), setThemeKey() {} } }, React.createElement(C, props))));
const texto = (html) => html.replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/\s+/g, ' ');

const HOY = new Date(2026, 10, 18); // 18 nov 2026
// Filas del motor del S&OP (forma de forecast/calculo.js#calcularForecast).
const ROWS = [
  { sku: 'AC-935777', descripcion: 'Mouse inalámbrico', marca: 'Acteck', supplier: 'SHENZHEN MOUSE CO', inv: 0, demMes: 400, sugerido: 1200, traCant: 600, coberturaDiasErp: 0, ltDias: 100, ultimoCostoUsd: 5, piezasPorContenedor: 1200, contenedoresSugeridos: 1, embarques: [{ po: 'ABT300', eta: '2026-12-05', cantidad: 600 }] },
  { sku: 'BR-940010', descripcion: 'Gabinete Batauro', marca: 'Balam Rush', supplier: 'DONGGUAN CASE', inv: 300, demMes: 300, sugerido: 500, traCant: 0, coberturaDiasErp: 30, ltDias: 90, ultimoCostoUsd: 20, embarques: [] },
  { sku: 'AC-900001', descripcion: 'Teclado', marca: 'Acteck', inv: 5000, demMes: 100, sugerido: 0, traCant: 0, coberturaDiasErp: 1500, embarques: [] },
];
const TRANSITO = [
  { sku: 'AC-935777', cantidad: 600, embarques_detalle: [{ po: 'ABT300', cantidad: 600, eta: '2026-12-05', etd: '2026-10-20', estatus: 'TRANSITO MARITIMO', contenedor: 'MSKU1234567', cedis: 'CEDIS GUADALAJARA' }] },
  { sku: 'AC-900001', cantidad: 200, embarques_detalle: [{ po: 'ABT290', cantidad: 200, eta: '2026-11-02', estatus: 'EN PUERTO', contenedor: 'TGHU7654321', cedis: 'CEDIS GUADALAJARA' }] },
];

test('motores movidos a modules: el archivo del celular sólo reexporta', () => {
  assert.equal(sopMovil.serieDemanda, sop.serieDemanda);
  assert.equal(sopMovil.textoArribo, sop.textoArribo);
  for (const f of ['src/movil/pestanas/sop/calculo.js', 'src/movil/pestanas/sop/datos.js', 'src/movil/pestanas/forecast/calculo.js', 'src/movil/pestanas/forecast/datos.js', 'src/movil/pestanas/producto/datos.js']) {
    const src = fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    assert.match(src, /^export \* from '\.\.\/\.\.\/\.\.\/modules\/comercial\//m, f);
    assert.ok(src.split('\n').filter((l) => l.trim() && !l.startsWith('//')).length === 1, `${f} debe ser sólo un reexport`);
  }
  // Las piezas web nuevas no importan nada de src/movil.
  for (const f of ['forecast/DemandaComprar.jsx', 'forecast/FichaPOWeb.jsx', 'forecast/MisClientesPanel.jsx', 'forecast/porQue.js', 'proyectos/ForecastLosTres.jsx', 'producto360/Producto360Web.jsx', 'producto360/abasto.js']) {
    assert.doesNotMatch(fs.readFileSync(new URL(`../src/modules/comercial/${f}`, import.meta.url), 'utf8'), /from '[^']*movil\//, f);
  }
});

test('1 · demanda vs stock: meses en que se queda corto y llegadas desde el tránsito de la pantalla', () => {
  const llegadas = sop.llegadasDe(TRANSITO);
  assert.equal(llegadas.length, 2);
  const serie = sop.serieDemanda({ rows: ROWS, llegadas, hoy: HOY, meses: 6 });
  assert.equal(serie.length, 6);
  assert.equal(serie[0].demanda, 800);
  // Noviembre: el mouse está agotado (faltan 400); el gabinete alcanza justo.
  assert.equal(serie[0].falta, 400);
  // Diciembre: llegan 600 mouse (cubre 400), el gabinete ya no tiene (faltan 300).
  assert.equal(serie[1].llega, 600);
  assert.equal(serie[1].falta, 300);
  const cortos = mesesCortos(serie);
  assert.equal(cortos[0].label, 'Nov');
  assert.equal(cortos[0].pct, 50);
  const html = texto(render(DemandaStockVista, { serie }));
  assert.match(html, /Demanda vs stock · 6 meses/);
  assert.match(html, /Se queda corto en/);
  assert.match(html, /Nov · 400 pz/);
  const sinHueco = texto(render(DemandaStockVista, { serie: serie.map((m) => ({ ...m, falta: 0 })) }));
  assert.match(sinHueco, /cubierto los 6 meses/);
});

test('1 · comprar ahora: agotado primero, «+ Solicitud» por SKU, «Agregar todos» y USD sólo con permiso', () => {
  const comprar = sop.comprarAhora(ROWS);
  assert.deepEqual(comprar.todos.map((c) => c.sku), ['AC-935777', 'BR-940010']);
  const html = texto(render(ComprarAhoraVista, { comprar, sensible: true, puedeEditar: true, enSolicitud: new Set(['BR-940010']) }));
  assert.match(html, /Comprar ahora/);
  assert.match(html, /2 SKUs · 1,700 pz · \$16K USD/);
  assert.match(html, /agotado/);
  assert.match(html, /Agregar todos/);
  assert.match(html, /en solicitud/);
  assert.match(html, /Solicitud/);
  const sinPermiso = texto(render(ComprarAhoraVista, { comprar, sensible: false, puedeEditar: false }));
  assert.doesNotMatch(sinPermiso, /USD/);
  assert.doesNotMatch(sinPermiso, /Agregar todos/);
  assert.match(texto(render(ComprarAhoraVista, { comprar: sop.comprarAhora([]) })), /Ningún SKU del universo/);
});

test('2 · arribos por PO y ficha de PO: contenedor, naviera, urge/justo/holgado y texto para compartir', () => {
  const porSku = new Map(ROWS.map((r) => [r.sku, r]));
  const arribos = sop.arribosPorPo({ transito: TRANSITO, porSku, navieraPor: new Map([['MSKU1234567', 'MAERSK']]), hoy: HOY });
  assert.equal(arribos.length, 2);
  const po = arribos.find((p) => p.po === 'ABT300');
  assert.equal(po.naviera, 'MAERSK');
  assert.equal(po.supplier, 'SHENZHEN MOUSE CO'); // v_transito_sku de la web no trae supplier: sale de la fila del motor
  assert.equal(po.urgen, 1);
  assert.equal(arribos.find((p) => p.po === 'ABT290').vencida, true);

  const tabla = texto(render(ArribosVista, { arribos, sensible: true }));
  assert.match(tabla, /ABT300/);
  assert.match(tabla, /ETA vencida 16 d/);
  assert.match(tabla, /1 que urge/);
  assert.ok(tabla.indexOf('ABT290') < tabla.indexOf('ABT300'), 'las vencidas van arriba');
  assert.doesNotMatch(texto(render(ArribosVista, { arribos, sensible: false })), /USD/);

  const ficha = texto(render(FichaPOVistaWeb, { po, sensible: true }));
  for (const t of ['MSKU1234567', 'MAERSK', 'en el mar', 'ETD', '20 oct', '5 dic', 'Guadalajara', 'AC-935777', '600', 'urge', 'Compartir arribo', '$3K USD']) assert.ok(ficha.includes(t), `la ficha debe traer «${t}»`);
  assert.doesNotMatch(texto(render(FichaPOVistaWeb, { po, sensible: false })), /USD/);
  const holgada = texto(render(FichaPOVistaWeb, { po: arribos.find((p) => p.po === 'ABT290') }));
  assert.match(holgada, /holgado/);
  assert.match(holgada, /Arribo vencido/);

  const txt = sop.textoArribo(po);
  assert.match(txt, /^PO ABT300 · SHENZHEN MOUSE CO\nLlega el 5 de diciembre a Guadalajara\n1 SKU · 600 pz · en el mar/);
  assert.match(txt, /• AC-935777 Mouse inalámbrico · 600 pz/);
  assert.match(sop.frasePo(po).frase, /resuelve 1 SKU que urge/);
});

test('3 · «Los tres»: suma por SKU × mes con el reparto por cliente, sólo lectura', () => {
  const ventana = [{ anio: 2026, mes: 12, key: '2026-12', label: 'Dic 26' }, { anio: 2027, mes: 1, key: '2027-01', label: 'Ene 27' }];
  const base = { ventana, hoy: HOY };
  const dl = fe.estadoCliente({ ...base, key: 'digitalife', label: 'Digitalife', existente: [{ sku: 'AC-935777', mes: '2026-12-01', piezas: 100 }], sugerido: [{ sku: 'BR-940010', descripcion: 'Gabinete Batauro', meses: { '2027-01': 40 } }] });
  const pc = fe.estadoCliente({ ...base, key: 'pcel', label: 'PCEL', crm: [{ sku: 'AC-935777', anio: 2026, mes: 12, piezas: 50, estado: 'borrador' }, { sku: 'AC-935777', anio: 2027, mes: 1, piezas: 30, estado: 'borrador' }] });
  const dc = fe.estadoCliente({ ...base, key: 'dicotech', label: 'Dicotech' });
  const estado = fe.sumarClientes([dl, pc, dc]);
  const filas = filasLosTres(estado, { filtro: 'todo' });
  const mouse = filas.find((f) => f.sku === 'AC-935777');
  assert.equal(mouse.total, 180);
  assert.equal(mouse.meses['2026-12'], 150);
  assert.equal(mouse.reparto.digitalife.pz, 100);
  assert.equal(mouse.reparto.pcel.pz, 80);
  assert.equal(mouse.reparto.dicotech, undefined);
  assert.deepEqual(filasLosTres(estado, { filtro: 'capturado' }).map((f) => f.sku), ['AC-935777']);
  assert.deepEqual(filasLosTres(estado, { filtro: 'sugerido' }).map((f) => f.sku), ['BR-940010']);
  assert.deepEqual(filasLosTres(estado, { filtro: 'todo', q: 'batauro' }).map((f) => f.sku), ['BR-940010']);

  const html = texto(render(ForecastLosTresVista, { estado, ventana, filtro: 'todo' }));
  for (const t of ['Los tres clientes tienen 2 SKUs con forecast por 180 pz', 'Digitalife', 'PCEL', 'Dicotech', 'AC-935777', 'BR-940010', 'reparto por cliente', 'sólo lectura', 'borrador', 'sugerido', '2 SKUs', '220']) assert.ok(html.includes(t), `«Los tres» debe traer «${t}»`);
  // Sólo lectura: ni campos de piezas ni exportar.
  const crudo = render(ForecastLosTresVista, { estado, ventana, filtro: 'todo' });
  assert.equal((crudo.match(/<input/g) || []).length, 1, 'el único campo es el buscador');
  assert.doesNotMatch(html, /Exportar plantilla/);
  // El selector de la vista Forecast ofrece «Los tres».
  const src = fs.readFileSync(new URL('../src/modules/comercial/proyectos/Forecast.jsx', import.meta.url), 'utf8');
  assert.match(src, /id: 'todos', label: 'Los tres'/);
  assert.match(src, /esTodos && <ForecastLosTres/);
});

// Datos de ejemplo con la forma de producto360/datos.js#useProducto360.
const D = {
  sku: 'AC-935777',
  roadmap: { sku: 'AC-935777', descripcion: 'Mouse inalámbrico', marca: 'ACTECK', categoria: 'Accesorios' },
  sellin: [
    { cliente: '00002', cliente_nombre: 'GRUPO CVA', anio: 2026, mes: 11, piezas_venta_neta: 500, fact_neta: 100000 },
    { cliente: '00002', cliente_nombre: 'GRUPO CVA', anio: 2026, mes: 10, piezas_venta_neta: 400, fact_neta: 80000 },
    { cliente: '00002', cliente_nombre: 'GRUPO CVA', anio: 2026, mes: 9, piezas_venta_neta: 300, fact_neta: 60000 },
    { cliente: '00002', cliente_nombre: 'GRUPO CVA', anio: 2026, mes: 8, piezas_venta_neta: 200, fact_neta: 40000 },
    { cliente: '00015', cliente_nombre: 'EXEL DEL NORTE', anio: 2026, mes: 2, piezas_venta_neta: 180, fact_neta: 36000 },
  ],
  sellout: [
    { cuenta: 'cva', anio: 2026, mes: 11, cantidad: 800, importe: 200000 },
    { cuenta: 'cva', anio: 2026, mes: 10, cantidad: 600, importe: 150000 },
    { cuenta: 'digitalife', anio: 2026, mes: 10, cantidad: 90, importe: 30000 },
  ],
  cuentas: [{ cuenta: 'cva', nombre: 'Grupo CVA', erp_cliente: '00002' }, { cuenta: 'digitalife', nombre: 'Digitalife', erp_cliente: '00183', propio: true }],
  invCuentas: [{ cuenta: 'cva', piezas: 1200, valor: 240000, semana: 46, anio: 2026 }, { cuenta: 'digitalife', piezas: 0, valor: 0, semana: 46, anio: 2026 }],
  inv: { inv_actual: 77777, inv_actual_piezas: 700, inv_actual_disponible: 650, costo_promedio: 111.11 },
  almacenes: [{ no_almacen: 1, almacen_nombre: 'CEDIS GDL', inventario: 600, disponible: 560, en_inv_actual: true }, { no_almacen: 30, almacen_nombre: 'GARANTIAS', inventario: 100, disponible: 90, en_inv_actual: false }],
  transito: { cantidad: 600, eta_mas_cercana: '2026-12-05', embarques_detalle: [{ po: 'ABT300', cantidad: 600, eta: '2026-12-05', estatus: 'TRANSITO MARITIMO' }] },
  precios: [{ lista: 'Mayoreo AAA', precio: 200 }, { lista: 'Distribuidor', precio: 220 }],
  stockAnio: [{ anio: 2026, piezas: [0, 0, 0, 0, 0, 0, 0, 0, 900, 800, 700, 0], valor: [0, 0, 0, 0, 0, 0, 0, 0, 99999, 88888, 77777, 0] }],
};

test('4 · Producto 360: resumen compartido y listas de precio con margen', () => {
  const r = p360.resumenProducto(D, { hoy: HOY });
  assert.equal(r.anio, 2026); assert.equal(r.mes, 11);
  assert.equal(r.piezasSi, 500); assert.equal(r.piezasSo, 800);
  assert.equal(r.ritmoSi, 300); // ago + sep + oct ÷ 3
  assert.equal(r.invPz, 700);
  assert.equal(r.proximo.po, 'ABT300');
  assert.equal(r.compra.compran[0].nombre, 'GRUPO CVA');
  assert.deepEqual(r.compra.dejaron.map((x) => x.nombre), ['EXEL DEL NORTE']);
  assert.match(r.frase, /Se desplazaron 800 pz en 1 cuenta, 1\.6 veces lo que facturamos; Grupo CVA concentra el 100 %/);
  assert.equal(r.serie.length, 12);
  // Antes del día 10 se lee el último mes cerrado.
  assert.deepEqual([p360.mesDeLectura(new Date(2026, 10, 5)).mes, p360.mesDeLectura(new Date(2026, 0, 3)).anio], [10, 2025]);
  const pr = p360.preciosDeLista(D.precios, 110);
  assert.deepEqual(pr.map((p) => p.lista), ['Distribuidor', 'Mayoreo AAA']);
  assert.equal(pr[0].margenPct, 50); assert.equal(pr[1].utilidad, 90);
  assert.equal(p360.preciosDeLista(D.precios, null)[0].margenPct, null);
});

test('4 · Producto 360 web: las cuatro caras; costo, margen y USD sólo con permiso sensible', () => {
  const base = { sku: 'AC-935777', d: D, hoy: HOY };
  const resumen = texto(render(Producto360Vista, { ...base, cara: 'resumen', sensible: true }));
  for (const t of ['Se desplazaron 800 pz', 'Sell out · nov', 'Sell in · nov', 'Inventario Acteck', 'En cuentas', 'Resumen', 'Inventario', 'Abasto', 'Precio', 'Preparar propuesta', 'Quién lo compra', 'GRUPO CVA', 'Quién lo desplaza', 'Grupo CVA', 'Dejaron de comprarlo', 'EXEL DEL NORTE', 'Proponer']) assert.ok(resumen.includes(t), `Resumen debe traer «${t}»`);

  const inv = texto(render(Producto360Vista, { ...base, cara: 'inventario', sensible: true }));
  for (const t of ['Nuestro inventario', 'Disponible', '650 pz', 'Valor a costo promedio', '$111.11 por pieza', 'Por almacén', 'CEDIS GDL', 'fuera de venta', 'En cuentas', 'PO ABT300']) assert.ok(inv.includes(t), `Inventario debe traer «${t}»`);
  const invSin = texto(render(Producto360Vista, { ...base, cara: 'inventario', sensible: false }));
  assert.doesNotMatch(invSin, /costo promedio|111\.11/i);

  const row = { ...ROWS[0], ritmo3m: 400, objetivo3m: 1600, necesidadNeta: 1000, mesesSeguridad: 1 };
  const porSku = new Map([[row.sku, row]]);
  const arribos = sop.arribosPorPo({ transito: [TRANSITO[0]], porSku, hoy: HOY });
  const abasto = { row, arribos, puedeEditar: true, cantidad: 1200, enSolicitud: false };
  const ab = texto(render(Producto360Vista, { ...base, cara: 'abasto', sensible: true, abasto }));
  for (const t of ['Está agotado con demanda', 'la PO ABT300 llega el 5 de diciembre', 'Cobertura', 'Agotado', 'Sugerido', '1,200 pz', '$6K USD', 'Lo que llega', 'Por qué 1,200 pz', 'Venta real de 400 pz/mes', 'Agregar a solicitud']) assert.ok(ab.includes(t), `Abasto debe traer «${t}»`);
  assert.doesNotMatch(texto(render(Producto360Vista, { ...base, cara: 'abasto', sensible: false, abasto })), /USD/);
  assert.match(texto(render(Producto360Vista, { ...base, cara: 'abasto', abasto: { row: null, arribos: [] } })), /Sin datos de abasto/);

  const precio = texto(render(Producto360Vista, { ...base, cara: 'precio', sensible: true }));
  for (const t of ['Listas de precio vigentes', 'Mayoreo AAA', '$200.00', 'Distribuidor', 'costo promedio $111.11', 'Margen', '44.4 %', 'Utilidad / pz', 'Calcular precio']) assert.ok(precio.includes(t), `Precio debe traer «${t}»`);
  const precioSin = texto(render(Producto360Vista, { ...base, cara: 'precio', sensible: false }));
  assert.match(precioSin, /Mayoreo AAA/);
  assert.doesNotMatch(precioSin, /Margen|Utilidad|costo|111\.11|44\.4/i);
  // Tema claro también renderiza.
  assert.match(render(Producto360Vista, { ...base, cara: 'resumen' }, 'light'), /AC-935777|GRUPO CVA/);
});

test('4 · Producto 360 se abre desde ⌘K y con acteck:navegar, sin entrar al arranque', () => {
  const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(app, /const Producto360Hoja = lazy\(\(\) => import\('\.\/modules\/comercial\/producto360\/Producto360Web'\)\)/);
  assert.match(app, /paginaId === 'producto360'/);
  const paleta = fs.readFileSync(new URL('../src/components/nav/Paleta.jsx', import.meta.url), 'utf8');
  assert.match(paleta, /onNavegar\?\.\(null, 'producto360', \{ sku: it\.sku\.sku \}\)/);
});
