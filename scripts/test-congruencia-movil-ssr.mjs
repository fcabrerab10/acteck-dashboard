// Congruencia web ↔ celular (2026-11-18): cuatro bloques de la web llevados al celular.
//   1) Comparador de periodos (motor compartido modules/comercial/comparador/calculo.js + vista móvil ComparadorVista)
//   2) Página del cliente: libro de Excel compartido (analisis/excelCliente.js) y exportarExcelBlob
//   3) Proyectos y forecast: TableroVista y MatrizVista con el motor proyectos/calculo.js
//   4) Color de sección en la cabecera del celular (SeccionContext + TituloGrande + rutas.js#seccionDeId)
// Puro + SSR, sin red.   node --test scripts/test-congruencia-movil-ssr.mjs
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
const { NavContext, SeccionContext } = await vite.ssrLoadModule('/src/movil/nav.jsx');
const cmp = await vite.ssrLoadModule('/src/modules/comercial/comparador/calculo.js');
const { ComparadorVista } = await vite.ssrLoadModule('/src/movil/pestanas/comparador/ComparadorM.jsx');
const { libroCliente } = await vite.ssrLoadModule('/src/modules/comercial/analisis/excelCliente.js');
const { agregarClientes, mapaCuotas } = await vite.ssrLoadModule('/src/modules/comercial/analisis/calc.js');
const { exportarExcelBlob } = await vite.ssrLoadModule('/src/lib/exportar.js');
const pr = await vite.ssrLoadModule('/src/modules/comercial/proyectos/calculo.js');
const { TableroVista, MatrizVista, TarjetaProyectoM } = await vite.ssrLoadModule('/src/movil/pestanas/forecast/TableroMatrizM.jsx');
const { ForecastVista } = await vite.ssrLoadModule('/src/movil/pestanas/forecast/ForecastM.jsx');
const fc = await vite.ssrLoadModule('/src/movil/pestanas/forecast/calculo.js');
const sop = await vite.ssrLoadModule('/src/movil/pestanas/sop/calculo.js');
const { default: TituloGrande } = await vite.ssrLoadModule('/src/movil/piezas/TituloGrande.jsx');
const { default: PlegadoM } = await vite.ssrLoadModule('/src/movil/piezas/PlegadoM.jsx');
const { seccionDeId } = await vite.ssrLoadModule('/src/movil/rutas.js');
const { seccionDe } = await vite.ssrLoadModule('/src/components/nav/arbol.js');

const qc = new QueryClient();
const nav = { modo: 'barra', perfil: { user_id: 'u-f', es_super_admin: true }, push() {}, pop() {}, navegar() {}, agregarSku() {} };
const render = (el, themeKey = 'midnight') => renderToString(React.createElement(QueryClientProvider, { client: qc },
  React.createElement(ThemeContext.Provider, { value: { theme: getTheme(themeKey), setThemeKey() {} } },
    React.createElement(NavContext.Provider, { value: nav }, el)))).replace(/<!--.*?-->/g, '');
const h = React.createElement;
const sano = (s, donde) => assert.ok(!/NaN|undefined|\[object Object\]/.test(s), `${donde}: NaN/undefined/[object Object] en el HTML`);

// ───────────────────────── 1 · Comparador de periodos ─────────────────────────
// 2025 completo a $100/mes (10 pz) y 2026 ene–sep a $150/mes (12 pz); medidas con contribución al 20 % y 30 %.
const fact = [], med = [];
for (let m = 1; m <= 12; m++) { fact.push({ anio: 2025, mes: m, monto: 100, piezas: 10 }); med.push({ anio: 2025, mes: m, fact_neta: 100, contribucion: 20 }); }
for (let m = 1; m <= 9; m++) { fact.push({ anio: 2026, mes: m, monto: 150, piezas: 12 }); med.push({ anio: 2026, mes: m, fact_neta: 150, contribucion: 45 }); }
const HOY = new Date(2026, 10, 18);

test('comparador · presets anclados al último mes con datos y totales recalculados', () => {
  const c = cmp.comparar({ fact, med, preset: 'ytd', hoy: HOY });
  assert.deepEqual(c.ultimo, { anio: 2026, mes: 9 });
  assert.deepEqual(c.periodos.map(cmp.labelPeriodo), ['Ene–Sep 2026', 'Ene–Sep 2025']);
  const [A, B] = c.totales;
  assert.equal(A.monto, 1350); assert.equal(B.monto, 900);
  assert.equal(A.piezas, 108); assert.equal(B.piezas, 90);
  assert.equal(Math.round(A.ticket * 100) / 100, 12.5);
  assert.equal(A.mc, 30); assert.equal(B.mc, 20);           // % recalculado sobre totales, no promediado
  assert.equal(cmp.deltaPct(A.monto, B.monto), 50);
  assert.equal(c.mesParcial, false);                        // sep 2026 ya cerró en nov
  assert.deepEqual(c.anios, [2026, 2025]);

  const q = cmp.comparar({ fact, med, preset: 'qvq', hoy: HOY });
  assert.deepEqual(q.periodos.map(cmp.labelPeriodo), ['Jul–Sep 2026', 'Abr–Jun 2026']);
  const y = cmp.comparar({ fact, med, preset: 'qyoy', hoy: HOY });
  assert.deepEqual(y.periodos.map(cmp.labelPeriodo), ['Jul–Sep 2026', 'Jul–Sep 2025']);
  const m3 = cmp.comparar({ fact, med, preset: 'm3', hoy: HOY });
  assert.equal(m3.periodos.length, 3);
  // Trimestre vs anterior cuando el último mes cae en Q1: B es el Q4 del año previo, con el mismo largo.
  assert.deepEqual(cmp.periodosPreset('qvq', 2026, 2, null).map(cmp.labelPeriodo), ['Ene–Feb 2026', 'Oct–Nov 2025']);
});

test('comparador · libre, ajuste de extremos, movers, serie y texto', () => {
  let libre = cmp.libreInicial({ anio: 2026, mes: 9 });
  libre = cmp.ajustarLibre(libre, 'A', { desde: 11 });        // desde > hasta → hasta se recorre
  assert.deepEqual(libre.A, { anio: 2026, desde: 11, hasta: 11 });
  libre = cmp.ajustarLibre(libre, 'A', { hasta: 3 });         // hasta < desde → desde se recorre
  assert.deepEqual(libre.A, { anio: 2026, desde: 3, hasta: 3 });
  const c = cmp.comparar({ fact, med, preset: 'libre', libre: { A: { anio: 2026, desde: 1, hasta: 3 }, B: { anio: 2025, desde: 10, hasta: 12 } }, hoy: HOY });
  assert.equal(c.totales[0].monto, 450); assert.equal(c.totales[1].monto, 300);

  const rows = [
    { sku: 'AC-1', anio: 2026, mes: 2, monto: 500, piezas: 5 }, { sku: 'AC-1', anio: 2025, mes: 11, monto: 100, piezas: 1 },
    { sku: 'AC-2', anio: 2025, mes: 12, monto: 300, piezas: 3 },
    { sku: 'AC-3', anio: 2026, mes: 1, monto: 50, piezas: 1 }, { sku: 'AC-3', anio: 2025, mes: 10, monto: 50, piezas: 1 },   // sin diferencia: fuera
    { sku: 'AC-4', anio: 2026, mes: 8, monto: 999, piezas: 9 },                                                              // fuera de los dos periodos
  ];
  const mv = cmp.moversDe(rows, c.periodos);
  assert.deepEqual(mv.up.map((s) => [s.sku, s.d]), [['AC-1', 400]]);
  assert.deepEqual(mv.down.map((s) => [s.sku, s.d]), [['AC-2', -300]]);
  assert.equal(cmp.moversDe(null, c.periodos), null);

  const serie = cmp.serieComparada(c.totales, c.periodos);
  assert.equal(serie.length, 3);
  assert.equal(serie[0].A_lbl, 'Ene 2026'); assert.equal(serie[0].B_lbl, 'Oct 2025'); assert.equal(serie[0].label, 'Ene');
  assert.equal(serie[2].A, 150); assert.equal(serie[2].B, 100);

  const txt = cmp.textoResumen({ nombre: 'Global', periodos: c.periodos, totales: c.totales });
  assert.match(txt, /Sell In Global · Ene–Mar 2026 vs Oct–Dic 2025/);
  assert.match(txt, /\+50\.0%/); assert.match(txt, /Contribución/);
  assert.ok(!/Contribución|MC/.test(cmp.textoResumen({ periodos: c.periodos, totales: c.totales, ocultarSensible: true })));

  const erp = cmp.agregarErp([{ anio: 2026, mes: 1, fact_neta: 10, piezas_venta_neta: 1, contribucion: 2 }, { anio: 2026, mes: 1, fact_neta: 5, piezas_venta_neta: 2, contribucion: 1 }]);
  assert.deepEqual(erp, [{ anio: 2026, mes: 1, monto: 15, piezas: 3, fact_neta: 15, contribucion: 3 }]);
  assert.equal(cmp.comparar({ fact: [], med: [] }).sinDatos, true);
});

test('ComparadorVista · A vs B con Δ, selectores de 48 px, contribución sólo con permiso, movers', () => {
  const c = cmp.comparar({ fact, med, preset: 'ytd', hoy: HOY });
  const movers = { up: [{ sku: 'AC-943154', mA: 500, mB: 100, pA: 5, pB: 1, d: 400 }], down: [{ sku: 'BR-942539', mA: 0, mB: 300, pA: 0, pB: 3, d: -300 }] };
  const con = render(h(ComparadorVista, { c, preset: 'ytd', sensible: true, movers, moversAbierto: true, onSku() {}, onCopiar() {} }));
  sano(con, 'comparador sensible');
  for (const t of ['Ene–Sep 2026', 'Ene–Sep 2025', 'Facturación · A', 'Piezas · A', 'Ticket promedio · A', 'Contribución · A', 'MC 30.0% vs 20.0%', '+50.0%', 'Subieron', 'Bajaron', 'AC-943154', 'BR-942539', 'Copiar resumen', 'Elegir período A', 'Elegir período B']) assert.ok(con.includes(t), `falta «${t}»`);
  assert.ok(!con.includes('Mes · 3 años'), 'el preset de 3 años no va en el celular');
  assert.ok(con.includes('min-height:48px'), 'selectores de período con objetivo táctil ≥ 44 px');
  assert.ok(!con.includes('Qué movió la diferencia'), 'con los movers abiertos ya no se ofrece el botón');

  const sin = render(h(ComparadorVista, { c, preset: 'ytd', sensible: false }), 'paper');
  sano(sin, 'comparador sin sensible');
  assert.ok(!/Contribución|MC \d/.test(sin), 'sin permiso sensible no hay contribución ni MC');
  assert.ok(sin.includes('Diferencia A − B') && sin.includes('Qué movió la diferencia'));

  const vacio = render(h(ComparadorVista, { c: cmp.comparar({ fact: [], med: [] }) }));
  assert.ok(vacio.includes('Sin facturación para comparar'));
});

// ───────────────────────── 2 · Libro de Excel del cliente ─────────────────────────
test('libroCliente · mismas hojas que la web; MC y contribución sólo con permiso; blob xlsx', async () => {
  const rows = [];
  for (let m = 1; m <= 9; m++) {
    rows.push({ anio: 2026, mes: m, cliente: '00183', cliente_nombre: 'CVA', cliente_key: 'mayoreo', canal: 'mayoreo', fact_neta: 1000, contribucion: 200, piezas_venta_neta: 10 });
    rows.push({ anio: 2025, mes: m, cliente: '00183', cliente_nombre: 'CVA', cliente_key: 'mayoreo', canal: 'mayoreo', fact_neta: 800, contribucion: 160, piezas_venta_neta: 8 });
  }
  const cliente = agregarClientes(rows, 2026, 9, 'ytd').clientes.find((c) => c.cliente === '00183');
  const cuotas = mapaCuotas([]);
  const detalleSku = [
    { anio: 2026, mes: 9, articulo: 'AC-943154', marca: 'Acteck', categoria: 'Monitores', fact_neta: 600, contribucion: 120, piezas_venta_neta: 6 },
    { anio: 2026, mes: 8, articulo: 'AC-943154', marca: 'Acteck', categoria: 'Monitores', fact_neta: 400, contribucion: 80, piezas_venta_neta: 4 },
    { anio: 2025, mes: 9, articulo: 'AC-943154', marca: 'Acteck', categoria: 'Monitores', fact_neta: 999, contribucion: 1, piezas_venta_neta: 9 },   // fuera de los 12 meses
    { anio: 2026, mes: 9, articulo: 'BR-942539', marca: 'Balam Rush', categoria: 'Monitores', fact_neta: 300, contribucion: 30, piezas_venta_neta: 3 },
  ];
  const skuSellOut = [{ anio: 2026, mes: 9, sku: 'AC-943154', marca: 'Acteck', categoria: 'Monitores', importe: 900, cantidad: 7 }];
  const roadmap = [{ sku: 'AC-943154', descripcion: 'Monitor Vivid 27', categoria: 'Monitores' }];

  const con = libroCliente({ cliente, anio: 2026, mesMax: 9, verSensible: true, cuotas, detalleSku, skuSellOut, roadmap });
  assert.equal(con.titulo, 'CVA · 2026');
  assert.deepEqual(con.hojas.map((x) => x.nombre), ['Resumen', 'Sell In por SKU', 'Sell Out por SKU']);   // 00183 = CVA reporta sell out
  const si = con.hojas[1];
  assert.equal(si.filas[0].sku, 'AC-943154'); assert.equal(si.filas[0].total, 1000); assert.equal(si.filas[0].piezas, 10);
  assert.equal(si.filas[0].m11, 600); assert.equal(si.filas[0].m10, 400); assert.equal(si.filas[0].descripcion, 'Monitor Vivid 27');
  assert.equal(si.filas[0].mc, 20);
  assert.ok(si.columnas.some((c) => c.key === 'mc'));
  assert.ok(con.hojas[0].filas.some((f) => f.k === '% MC YTD'));
  assert.equal(con.hojas[2].filas[0].total, 900);

  const sin = libroCliente({ cliente, anio: 2026, mesMax: 9, verSensible: false, cuotas, detalleSku, skuSellOut, roadmap });
  assert.ok(!sin.hojas[1].columnas.some((c) => c.key === 'mc'));
  assert.ok(!sin.hojas[0].filas.some((f) => /MC|Contribución/.test(f.k)));
  assert.ok(sin.hojas[1].filas.every((f) => !('mc' in f) && !('contribucion' in f)), 'sin permiso las filas no llevan contribución');

  // Cliente sin cuenta de sell out: dos hojas.
  const otro = agregarClientes(rows.map((r) => ({ ...r, cliente: '99999', cliente_nombre: 'OTRO' })), 2026, 9, 'ytd').clientes[0];
  assert.deepEqual(libroCliente({ cliente: otro, anio: 2026, mesMax: 9, detalleSku }).hojas.map((x) => x.nombre), ['Resumen', 'Sell In por SKU']);

  const { blob, nombre } = await exportarExcelBlob(sin);
  assert.match(nombre, /^Cliente 00183 CVA 2026 · \d{4}-\d{2}-\d{2}\.xlsx$/);
  assert.ok(blob.size > 2000, 'el xlsx trae contenido');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(String.fromCharCode(bytes[0], bytes[1]), 'PK', 'es un zip (xlsx)');
});

// ───────────────────────── 3 · Tablero y Matriz de proyectos ─────────────────────────
const hoyP = new Date(2026, 10, 18);
const horizonte = pr.mesesHorizonte(hoyP, 6);
const res = pr.calcular({
  proyectos: [
    { id: 'p1', nombre: 'Bocinas Buen Fin', cliente: 'digitalife', anio: 2026, mes: 11, probabilidad: 'confirmado', responsable: 'Fernando' },
    { id: 'p2', nombre: 'Gabinetes Batauro', cliente: 'pcel', anio: 2026, mes: 12, probabilidad: 'probable' },
    { id: 'p3', nombre: 'Regreso a clases', cliente: 'dicotech', anio: 2027, mes: 8, probabilidad: 'prospecto' },
  ],
  lineas: [
    { id: 'l1', proyecto_id: 'p1', sku: 'AC-935777', piezas: 100, reservado: 40, precio: 500 },
    { id: 'l2', proyecto_id: 'p2', sku: 'AC-935777', piezas: 80, reservado: 0, precio: 450 },
    { id: 'l3', proyecto_id: 'p2', sku: 'BR-942539', piezas: 50, reservado: 0, precio: 0 },
    { id: 'l4', proyecto_id: 'p3', sku: 'AC-935777', piezas: 30, reservado: 0, precio: 400 },
  ],
  inventario: [{ sku: 'AC-935777', disponible: 120 }, { sku: 'BR-942539', disponible: 500 }],
  transito: [], leadTimes: [], leadProveedor: [], descripciones: new Map([['AC-935777', 'Bocina Portátil']]),
  meses: horizonte, hoy: hoyP,
});

test('TableroVista · secciones por mes con monto, tarjetas con cobertura y «Mover» sólo con edición', () => {
  const columnas = pr.tablero(res);
  assert.equal(columnas[0].proyectos[0].id, 'p1');
  assert.equal(columnas.at(-1).clave, 'fuera');
  const html = render(h(TableroVista, { columnas, puedeEditar: true, onAbrir() {}, onMover() {}, onNuevo() {} }));
  sano(html, 'tablero');
  for (const t of ['noviembre 2026', 'diciembre 2026', 'Más adelante', 'Bocinas Buen Fin', 'Gabinetes Batauro', 'Regreso a clases', '$50K', 'Digitalife', 'Confirmado', '100 %', 'faltan 60 pz', 'Mover Bocinas Buen Fin a otro mes', 'Proyecto en Nov 26']) assert.ok(html.includes(t), `falta «${t}»`);
  assert.equal((html.match(/data-mes=/g) || []).length, columnas.length);
  assert.ok(!/draggable/.test(html), 'en el celular no se arrastra');
  const lectura = render(h(TableroVista, { columnas, puedeEditar: false, onAbrir() {} }), 'paper');
  sano(lectura, 'tablero lectura');
  assert.ok(!lectura.includes('Mover ') && !lectura.includes('Proyecto en '), 'sin permiso de edición no hay «Mover» ni «＋ Proyecto»');
  // La tarjeta sola (sin precio) no rompe.
  const t = render(h(TarjetaProyectoM, { proyecto: { id: 'x', nombre: 'Sin precio', cliente: 'pcel', probabilidad: 'probable', pz: 0, monto: 0, cubiertoPct: null, faltante: 0 } }));
  assert.ok(t.includes('sin precio') && t.includes('sin SKUs') && t.includes('—'));
});

test('MatrizVista · SKU × mes coloreado por cobertura y selector Necesidad · Faltante · Reservado', () => {
  const nec = pr.matriz(res, { medida: 'necesidad' });
  assert.equal(nec[0].sku, 'AC-935777');                  // primero el que tiene faltante
  assert.equal(nec[0].faltante, 60);
  const html = render(h(MatrizVista, { filas: nec, horizonte, medida: 'necesidad', onMedida() {}, onSku() {} }));
  sano(html, 'matriz necesidad');
  for (const t of ['Necesidad', 'Faltante', 'Reservado', 'Sólo con faltante', 'AC-935777', 'Bocina Portátil', 'BR-942539', 'Cubierto', 'Justo', 'Falta', 'Nov', 'Dic', 'Abr']) assert.ok(html.includes(t), `falta «${t}»`);
  assert.ok(html.includes('data-tono="rojo"') && html.includes('data-tono="verde"'), 'celdas con tono de cobertura');
  assert.ok(html.includes('position:sticky'), 'primera columna fija');
  assert.ok(html.includes('overflow-x:auto'), 'si no cabe, el desplazamiento es dentro de la tabla');

  const falt = pr.matriz(res, { medida: 'faltante', soloFaltante: true });
  assert.deepEqual(falt.map((r) => r.sku), ['AC-935777']);
  const h2 = render(h(MatrizVista, { filas: falt, horizonte, medida: 'faltante', soloFaltante: true }), 'paper');
  sano(h2, 'matriz faltante');
  assert.ok(h2.includes('>60<') && !h2.includes('BR-942539'));
  const resv = render(h(MatrizVista, { filas: pr.matriz(res, { medida: 'reservado' }), horizonte, medida: 'reservado' }));
  assert.ok(resv.includes('>40<'));
  const vacia = render(h(MatrizVista, { filas: [], horizonte, medida: 'necesidad', soloFaltante: true }));
  assert.ok(vacia.includes('Ningún SKU con faltante'));
});

test('ForecastVista · entradas al Tablero y a la Matriz', () => {
  const ventana = sop.mesesDesde(hoyP, 6, 1);
  const estado = { ...fc.estadoCliente({ key: 'digitalife', label: 'Digitalife', ventana, hoy: hoyP }), lotesLista: [] };
  const base = { estado, clienteSel: 'digitalife', ventana, proyectos: [] };
  const con = render(h(ForecastVista, { ...base, onTablero() {}, onMatriz() {} }));
  assert.ok(con.includes('Tablero por mes') && con.includes('Matriz SKU × mes'));
  assert.ok(!render(h(ForecastVista, base)).includes('Tablero por mes'));
});

// ───────────────────────── 4 · Color de sección en la cabecera ─────────────────────────
test('TituloGrande · sección en su color encima del título (13 px), una sola pieza', () => {
  const sec = seccionDeId('sellIn');
  assert.deepEqual(sec, seccionDe('sellIn', null));
  assert.equal(sec.grupo, 'Dirección Comercial'); assert.equal(sec.color, '#00A3B4');
  assert.equal(seccionDeId('sellIn'), sec, 'mismo objeto entre llamadas (no re-renderiza)');
  assert.equal(seccionDeId('forecastReservas').grupo, 'Clientes propios');
  assert.equal(seccionDeId('digitalife:sellIn').grupo, 'Digitalife');
  assert.equal(seccionDeId('digitalife:sellIn').color, '#FF3B30');
  assert.equal(seccionDeId('resumenClientes'), null, 'una página sin grupo no pinta sección');
  assert.equal(seccionDeId(null), null); assert.equal(seccionDeId('noExiste'), null);

  const con = render(h(SeccionContext.Provider, { value: sec }, h(TituloGrande, { titulo: 'Sell In' })));
  assert.ok(con.includes('data-seccion') && con.includes('Dirección Comercial'));
  assert.ok(/color:#00A3B4/i.test(con), 'en el color de la sección');
  assert.ok(con.includes('height:13px') && con.includes('text-transform:uppercase') && con.includes('letter-spacing:0.07em'), '≤ 14 px de alto, mayúsculas con tracking');
  // Sin sección (pestañas raíz sin grupo, pruebas viejas): nada cambia.
  assert.ok(!render(h(TituloGrande, { titulo: 'Clientes' })).includes('data-seccion'));
  // Sección con el mismo nombre que el título (Inicio › Inicio · Digitalife › Digitalife): no se repite.
  assert.ok(!render(h(SeccionContext.Provider, { value: seccionDeId('inicio') }, h(TituloGrande, { titulo: 'Inicio' }))).includes('data-seccion'));
  assert.ok(!render(h(SeccionContext.Provider, { value: seccionDeId('digitalife:home') }, h(TituloGrande, { titulo: 'Digitalife' }))).includes('data-seccion'));
  // Se puede apagar en una pantalla concreta.
  assert.ok(!render(h(SeccionContext.Provider, { value: sec }, h(TituloGrande, { titulo: 'Sell In', seccion: false }))).includes('data-seccion'));
});

test('PlegadoM · los hijos no se montan hasta abrir', () => {
  let montado = 0;
  const Hijo = () => { montado += 1; return h('span', null, 'contenido-plegado'); };
  const cerrado = render(h(PlegadoM, { titulo: 'Comparador de periodos', sub: 'A frente a B' }, h(Hijo)));
  assert.ok(cerrado.includes('Comparador de periodos') && cerrado.includes('A frente a B') && !cerrado.includes('contenido-plegado'));
  assert.equal(montado, 0);
  assert.ok(cerrado.includes('min-height:52px'), 'fila tocable ≥ 44 px');
  const abierto = render(h(PlegadoM, { titulo: 'Comparador de periodos', abiertoInicial: true }, h(Hijo)));
  assert.ok(abierto.includes('contenido-plegado') && abierto.includes('Toca para plegar'));
});
