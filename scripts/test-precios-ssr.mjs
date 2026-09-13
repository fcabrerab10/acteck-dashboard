// Smoke SSR de todo lo que se tocó el 2026-09-12 (listas de precios 5 → 10, historia de
// precios y EAN): carga cada módulo con el pipeline de Vite para atrapar imports rotos,
// ciclos y JSX malo, y prueba los helpers puros que se agregaron o cambiaron.
//   node --test scripts/test-precios-ssr.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
test.after(() => vite.close());

const PANTALLAS = [
  '/src/modules/comercial/EstrategiaPrecios.jsx',
  '/src/modules/comercial/precios/TablaPrecios.jsx',
  '/src/modules/comercial/precios/DrillSku.jsx',
  '/src/modules/comercial/precios/Simulador.jsx',
  '/src/modules/comercial/precios/PanelElasticidad.jsx',
  '/src/modules/comercial/precios/PanelPrecioBajo.jsx',
  '/src/modules/comercial/precios/PrecioBajoSku.jsx',
  '/src/modules/comercial/precios/Competencia.jsx',
  '/src/modules/comercial/PropuestasTab.jsx',
  '/src/modules/comercial/propuestas/Revisar.jsx',
  '/src/modules/comercial/CreditoCobranzaV2.jsx',
  '/src/movil/FichaProducto.jsx',
];

test('los módulos tocados cargan y exportan default', async () => {
  for (const m of PANTALLAS) {
    const mod = await vite.ssrLoadModule(m);
    assert.equal(typeof mod.default, 'function', `${m} debe exportar default`);
  }
});

test('los módulos sin JSX cargan y exportan lo que consumen los demás', async () => {
  const ean = await vite.ssrLoadModule('/src/lib/ean.js');
  for (const f of ['useEan', 'mapaEan', 'eanLegible', 'clavesSku']) assert.equal(typeof ean[f], 'function', `ean.js debe exportar ${f}`);
  const datos = await vite.ssrLoadModule('/src/modules/comercial/precios/datos.js');
  for (const h of ['useDatosPrecios', 'useDrillPrecios', 'useElasticidadCategoria']) assert.equal(typeof datos[h], 'function', `datos.js debe exportar ${h}`);
  const excel = await vite.ssrLoadModule('/src/modules/comercial/propuestas/excelPropuesta.js');
  for (const f of ['construirWorkbookPropuesta', 'exportarPropuestaExcel', 'propuestaExcelBlob']) assert.equal(typeof excel[f], 'function', `excelPropuesta.js debe exportar ${f}`);
});

test('LISTAS son las 10 del puente, con etiqueta y color propios', async () => {
  const t = await vite.ssrLoadModule('/src/modules/comercial/precios/textos.js');
  assert.equal(t.LISTAS.length, 10);
  assert.equal(t.LISTAS[0], 'Mayoreo AAA', 'Mayoreo AAA sigue primero');
  assert.equal(new Set(t.LISTAS).size, 10, 'sin repetidas');
  const theme = { accent: '#1', purple: '#2', orange: '#3', green: '#4', teal: '#5', textMuted: '#999' };
  const colores = t.LISTAS.map((l) => t.listaColor(theme, l));
  assert.equal(new Set(colores).size, 10, 'cada lista con color distinto');
  assert.equal(t.listaColor(theme, 'LISTA QUE NO EXISTE'), '#999', 'lista desconocida → muted');
  for (const l of t.LISTAS) assert.ok(t.listaLbl(l).length > 0 && t.listaLbl(l).length <= 14, `etiqueta corta para ${l}`);
  assert.equal(t.listaLbl('OTRA COSA'), 'OTRA COSA', 'sin etiqueta cae al nombre crudo');
});

test('ordenarListas: catálogo primero, desconocidas al final y sin repetidas', async () => {
  const { ordenarListas } = await vite.ssrLoadModule('/src/modules/comercial/precios/textos.js');
  assert.deepEqual(ordenarListas(['AMAZON', 'Mayoreo AAA', 'DICOTECH']), ['Mayoreo AAA', 'DICOTECH', 'AMAZON']);
  assert.deepEqual(ordenarListas(['ZZZ NUEVA', 'AAA NUEVA', 'Mayoreo AAA']), ['Mayoreo AAA', 'AAA NUEVA', 'ZZZ NUEVA']);
  assert.deepEqual(ordenarListas(['DICOTECH', 'DICOTECH', null, '']), ['DICOTECH']);
  assert.deepEqual(ordenarListas(undefined), []);
});

test('listasDeDatos y listasVisibles: las listas salen de los datos, no de un arreglo en duro', async () => {
  const c = await vite.ssrLoadModule('/src/modules/comercial/precios/calculo.js');
  const { MAX_COLUMNAS_LISTA } = await vite.ssrLoadModule('/src/modules/comercial/precios/textos.js');
  const precios = [
    { sku: 'A', lista: 'AMAZON', precio: 10 }, { sku: 'A', lista: 'Mayoreo AAA', precio: 12 },
    { sku: 'B', lista: 'Mayoreo PMM', precio: 11 }, { sku: 'B', lista: 'LISTA NUEVA DEL PUENTE', precio: 9 },
  ];
  const listas = c.listasDeDatos(precios);
  assert.deepEqual(listas, ['Mayoreo AAA', 'Mayoreo PMM', 'AMAZON', 'LISTA NUEVA DEL PUENTE']);
  const f = c.FILTROS_VACIOS();
  assert.deepEqual(c.listasVisibles(f, listas), listas.slice(0, MAX_COLUMNAS_LISTA));
  // Con 12 listas la tabla NO pinta 12 columnas (regla de ancho): corta en MAX_COLUMNAS_LISTA.
  const muchas = Array.from({ length: 12 }, (_, i) => `L${i}`);
  assert.equal(c.listasVisibles(f, muchas).length, MAX_COLUMNAS_LISTA);
  // Con filtro manda el usuario, en el orden del catálogo.
  const conFiltro = { ...f, listas: new Set(['AMAZON', 'Mayoreo AAA']) };
  assert.deepEqual(c.listasVisibles(conFiltro, listas), ['Mayoreo AAA', 'AMAZON']);
});

test('construirFilas cuenta "sin precio" contra las listas que hay en los datos', async () => {
  const c = await vite.ssrLoadModule('/src/modules/comercial/precios/calculo.js');
  const roadmap = [{ sku: 'A', descripcion: 'Mouse', marca: 'Acteck' }, { sku: 'B', descripcion: 'Teclado', marca: 'Acteck' }];
  const precios = [
    { sku: 'A', lista: 'Mayoreo AAA', precio: 100 }, { sku: 'A', lista: 'AMAZON', precio: 120 },
    { sku: 'B', lista: 'Mayoreo AAA', precio: 200 },
  ];
  const filas = c.construirFilas({ roadmap, precios, bajos: [], promos: [], costos: [], cambios: [] });
  const [a, b] = filas;
  assert.equal(a.nListas, 2); assert.equal(a.sinPrecio, false); assert.equal(a.conPrecio, true);
  assert.equal(b.nListas, 1); assert.equal(b.sinPrecio, true, 'B no tiene precio en AMAZON');
  // Las facetas cuentan sobre las listas de los datos.
  const fac = c.facetas(filas, c.FILTROS_VACIOS(), c.listasDeDatos(precios));
  assert.equal(fac.listas.get('Mayoreo AAA'), 2);
  assert.equal(fac.listas.get('AMAZON'), 1);
});

test('serieHistorico detecta los cambios de una lista que no está en el catálogo', async () => {
  const { serieHistorico } = await vite.ssrLoadModule('/src/modules/comercial/precios/calculo.js');
  const historico = [
    { lista: 'LISTA NUEVA', anio: 2026, mes: 8, precio: 100, primera_vez: '2026-08-01T00:00:00Z' },
    { lista: 'LISTA NUEVA', anio: 2026, mes: 9, precio: 110, primera_vez: '2026-09-01T00:00:00Z' },
    { lista: 'Mayoreo AAA', anio: 2026, mes: 9, precio: 50, primera_vez: '2026-09-01T00:00:00Z' },
  ];
  const h = serieHistorico(historico);
  assert.equal(h.meses, 2);
  assert.equal(h.desde, '2026-08-01T00:00:00Z');
  assert.equal(h.cambios.length, 1, 'un cambio, el de LISTA NUEVA');
  assert.equal(h.cambios[0].lista, 'LISTA NUEVA');
  assert.equal(h.cambios[0].de, 100);
  assert.equal(h.cambios[0].a, 110);
  assert.ok(Math.abs(h.cambios[0].deltaPct - 10) < 1e-9);
  // Sin histórico no truena.
  assert.deepEqual(serieHistorico([]), { serie: [], cambios: [], desde: null, meses: 0 });
});

test('eanLegible agrupa el código y clavesSku deduplica y ordena', async () => {
  const { eanLegible, clavesSku } = await vite.ssrLoadModule('/src/lib/ean.js');
  assert.equal(eanLegible('7506215944458'), '7 506215 944458');
  assert.equal(eanLegible('12345678'), '1234 5678');
  assert.equal(eanLegible(null), '');
  assert.equal(eanLegible('75062-15944458'), '7 506215 944458', 'ignora separadores');
  assert.deepEqual(clavesSku([' B ', 'A', 'A', null, '']), ['A', 'B']);
  assert.deepEqual(clavesSku(undefined), []);
});

test('el texto de la propuesta lleva el EAN cuando lo hay', async () => {
  const { textoPropuesta } = await vite.ssrLoadModule('/src/modules/comercial/propuestas/textos.js');
  const lineas = [{ sku: 'AC-928984', descripcion: 'Mouse Óptico / 1000 DPI', piezas: 100, precio: 92 }, { sku: 'AC-000', descripcion: 'Sin codigo de barras', piezas: 10, precio: 5 }];
  const eanPorSku = new Map([['AC-928984', '7506215289845']]);
  const txt = textoPropuesta({ clienteLabel: 'Digitalife', nombre: 'Cierre', anio: 2026, mes: 9, lineas, eanPorSku });
  assert.ok(txt.includes('  EAN 7506215289845'), 'el EAN va bajo su SKU');
  assert.equal((txt.match(/EAN/g) || []).length, 1, 'sólo el SKU que tiene EAN');
  assert.ok(!/costo|margen|lista/i.test(txt), 'nada sensible en el texto');
  // Sin el mapa, el texto es el de antes.
  assert.ok(!textoPropuesta({ clienteLabel: 'Digitalife', nombre: 'Cierre', anio: 2026, mes: 9, lineas }).includes('EAN'));
});

test('el texto de disponibilidad lleva el EAN cuando lo hay', async () => {
  const { textoDisponibilidad } = await vite.ssrLoadModule('/src/lib/whatsapp.js');
  const items = [{ sku: 'AC-1', descripcion: 'Mouse', ean: '7506215944458', disponible: 10, proximoArribo: null, enCamino: 0, precio: 99 }];
  const txt = textoDisponibilidad(items, { fecha: 'hoy' });
  assert.ok(txt.includes('  EAN: 7506215944458'));
  assert.ok(!textoDisponibilidad([{ ...items[0], ean: null }], { fecha: 'hoy' }).includes('EAN'));
});

test('el puente carga las 10 listas y compara el nombre normalizado', async () => {
  const M = await vite.ssrLoadModule('/bridge/lib/mappers.mjs');
  assert.equal(M.LISTAS_PRECIOS.length, 10);
  for (const l of ['Mayoreo AAA', 'Mayoreo PMM', 'Ingram Retail', 'MERCADO LIBRE FULL', 'AMAZON', 'SVENSKA PROVISIONAL']) {
    assert.ok(M.LISTAS_PRECIOS.includes(l), `falta ${l}`);
  }
  assert.equal(M.normalizarLista('  mayoreo   aaa '), 'MAYOREO AAA');
  assert.equal(M.normalizarLista('Méxíco'), 'MEXICO');
  const ctx = { anio: 2026, mes: 9 };
  assert.deepEqual(M.preciosERP({ Lista: 'MAYOREO PMM', Articulo: 'AC-1', Precio: 99.5, Moneda: 'PESOS' }, ctx),
    { sku: 'AC-1', lista: 'MAYOREO PMM', moneda: 'PESOS', anio: 2026, mes: 9, precio: 99.5 });
  assert.equal(M.preciosERP({ Lista: 'Mayoreo B1', Articulo: 'AC-1', Precio: 10 }, ctx), null, 'lista fuera del top 10');
  assert.equal(M.preciosERP({ Lista: 'AMAZON', Articulo: 'AC-1', Precio: 0 }, ctx), null, 'precio 0 se descarta');
  assert.equal(M.preciosERP({ Lista: 'AMAZON', Precio: 10 }, ctx), null, 'sin artículo se descarta');
});

test('las 10 listas del puente coinciden con el catálogo de la pantalla', async () => {
  const M = await vite.ssrLoadModule('/bridge/lib/mappers.mjs');
  const { LISTAS } = await vite.ssrLoadModule('/src/modules/comercial/precios/textos.js');
  assert.deepEqual([...M.LISTAS_PRECIOS].sort(), [...LISTAS].sort(), 'bridge y pantalla deben nombrar las mismas listas');
});
