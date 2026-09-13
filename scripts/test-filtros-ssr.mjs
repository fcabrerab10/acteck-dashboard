// Smoke SSR del componente de filtros del kit (diseño B, "un botón por grupo") + la lógica
// pura de ordenado y búsqueda de opciones, y la carga de todas las pantallas que lo montan.
//   node --test scripts/test-filtros-ssr.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
test.after(() => vite.close());

const kit = await vite.ssrLoadModule('/src/components/kit/Filtros.jsx');

test('el kit y las pantallas que lo montan cargan', async () => {
  for (const m of [
    '/src/components/kit/Filtros.jsx',
    '/src/modules/comercial/sellin/Filtros.jsx',
    '/src/modules/comercial/forecast/FiltrosSOP.jsx',
    '/src/modules/comercial/InventarioGlobal.jsx',
    '/src/modules/comercial/ForecastClientesTab.jsx',
    '/src/modules/comercial/SellInCliente.jsx',
    '/src/modules/comercial/SellOutGlobal.jsx',
    '/src/modules/comercial/EstrategiaPrecios.jsx',
    '/src/modules/comercial/ForecastReservas.jsx',
    '/src/modules/comercial/propuestas/Armar.jsx',
    '/src/modules/comercial/tracking/TablaPedidos.jsx',
    '/src/modules/interno/HistorialCambios.jsx',
  ]) {
    const mod = await vite.ssrLoadModule(m);
    assert.equal(typeof mod.default, 'function', `${m} debe exportar default`);
  }
  const idx = await vite.ssrLoadModule('/src/components/kit/index.js');
  assert.equal(typeof idx.Filtros, 'function', 'el kit debe exportar Filtros');
});

test('el adaptador de sellin/Filtros es el mismo componente del kit', async () => {
  const adaptador = await vite.ssrLoadModule('/src/modules/comercial/sellin/Filtros.jsx');
  assert.equal(adaptador.default, kit.default, 'sellin/Filtros debe reexportar el kit');
});

test('la fila pinta un botón por grupo, con badge y pastillas de lo activo', async () => {
  const { ThemeProvider } = await vite.ssrLoadModule('/src/lib/themeContext.jsx');
  const grupos = [
    { id: 'estado', label: 'Estado', seleccion: new Set(['agotado']), opciones: [{ id: 'agotado', label: 'Agotado', n: 12, tone: 'red' }, { id: 'sana', label: 'Sana', n: 400 }] },
    { id: 'cedis', label: 'CEDIS', multiple: false, seleccion: null, opciones: [{ id: 'GDL', label: 'Guadalajara', n: 300 }] },
    { id: 'marca', label: 'Marca', seleccion: new Set(), opciones: [{ id: 'acteck', label: 'Acteck', n: 500 }] },
  ];
  const html = renderToString(React.createElement(ThemeProvider, null, React.createElement(kit.default, {
    grupos,
    toggles: [{ id: 'soloStock', label: 'Sólo con stock', on: true, n: 208 }],
    activos: 2,
    resumen: '208 de 818 SKUs',
    onToggle: () => {}, onToggleFlag: () => {}, onLimpiar: () => {},
  })));
  for (const l of ['Estado', 'CEDIS', 'Marca', 'Sólo con stock', '208 de 818 SKUs', 'Limpiar']) {
    assert.ok(html.includes(l), `falta "${l}" en la fila`);
  }
  assert.ok(html.includes('aria-expanded="false"'), 'los botones de grupo llevan aria-expanded');
  assert.ok(html.includes('data-filtros-boton="estado"'), 'el botón se puede anclar por su data-attr');
  assert.ok(html.includes('Agotado'), 'la pastilla de lo activo muestra la etiqueta, no el id');
  assert.ok(!html.includes('role="dialog"'), 'el popover no se pinta hasta abrir un grupo');
  assert.ok(!/NaN|undefined/.test(html), 'nada de NaN/undefined en el marcado');
});

test('sin filtros activos no hay fila de pastillas ni Limpiar', async () => {
  const { ThemeProvider } = await vite.ssrLoadModule('/src/lib/themeContext.jsx');
  const html = renderToString(React.createElement(ThemeProvider, null, React.createElement(kit.default, {
    grupos: [{ id: 'marca', label: 'Marca', seleccion: new Set(), opciones: [{ id: 'a', label: 'Acteck', n: 5 }] }],
    activos: 0, onToggle: () => {}, onLimpiar: () => {},
  })));
  assert.ok(html.includes('Marca'));
  assert.ok(!html.includes('Limpiar'), 'sin activos no se ofrece Limpiar');
});

test('`sel` sigue funcionando como sinónimo de `seleccion` (importadores viejos)', async () => {
  const { ThemeProvider } = await vite.ssrLoadModule('/src/lib/themeContext.jsx');
  const html = renderToString(React.createElement(ThemeProvider, null, React.createElement(kit.default, {
    grupos: [{ id: 'canal', label: 'Canal', sel: new Set(['mayoreo']), opciones: [{ id: 'mayoreo', label: 'Mayoreo', n: 9 }] }],
    activos: 1, onToggle: () => {}, onLimpiar: () => {},
  })));
  assert.ok(html.includes('Mayoreo'), 'la pastilla activa sale del grupo pasado con `sel`');
});

test('ordenarOpciones: marcadas primero, luego por n desc, las de 0 al final', () => {
  const { ordenarOpciones } = kit;
  const ops = [
    { id: 'a', label: 'A', n: 0 },
    { id: 'b', label: 'B', n: 10 },
    { id: 'c', label: 'C', n: 3 },
    { id: 'd', label: 'D', n: 0 },
  ];
  assert.deepEqual(ordenarOpciones(ops, new Set()).map((o) => o.id), ['b', 'c', 'a', 'd'], 'las de 0 al final, alfabéticas entre sí');
  assert.deepEqual(ordenarOpciones(ops, new Set(['d'])).map((o) => o.id), ['d', 'b', 'c', 'a'], 'una marcada con 0 resultados va primero igual');
  assert.deepEqual(ordenarOpciones(ops, 'c').map((o) => o.id), ['c', 'b', 'a', 'd'], 'selección de valor único');
  assert.deepEqual(ordenarOpciones([], new Set()), [], 'sin opciones no revienta');
  const orig = [...ops];
  ordenarOpciones(ops, new Set(['b']));
  assert.deepEqual(ops, orig, 'no muta el arreglo que recibe');
});

test('filtrarOpciones: palabras en cualquier orden y sin acentos', () => {
  const { filtrarOpciones } = kit;
  const ops = [
    { id: '1', label: 'Mouse Inalámbrico Negro' },
    { id: '2', label: 'Teclado Balam Rush' },
    { id: 'AC-93', label: 'Diadema' },
  ];
  assert.deepEqual(filtrarOpciones(ops, 'negro inalambrico').map((o) => o.id), ['1'], 'sin acentos y en cualquier orden');
  assert.deepEqual(filtrarOpciones(ops, 'BALAM').map((o) => o.id), ['2'], 'ignora mayúsculas');
  assert.deepEqual(filtrarOpciones(ops, 'ac-93').map((o) => o.id), ['AC-93'], 'también busca en el id');
  assert.equal(filtrarOpciones(ops, '   ').length, 3, 'búsqueda vacía = todas');
  assert.equal(filtrarOpciones(ops, 'zzz').length, 0);
});

test('normaliza / estaSel / cuentaSel / idsSel / etiquetaDe', () => {
  const { normaliza, estaSel, cuentaSel, idsSel, etiquetaDe } = kit;
  assert.equal(normaliza(' Inalámbrico Ñ '), 'inalambrico n', 'NFD también deshace la ñ, igual que sellin/textos');
  assert.equal(normaliza(null), '');

  assert.equal(estaSel(new Set(['a']), 'a'), true);
  assert.equal(estaSel(new Set(), 'a'), false);
  assert.equal(estaSel('a', 'a'), true);
  assert.equal(estaSel(null, 'a'), false);
  assert.equal(estaSel('', ''), false, 'cadena vacía no cuenta como selección');

  assert.equal(cuentaSel(new Set(['a', 'b'])), 2);
  assert.equal(cuentaSel(null), 0);
  assert.equal(cuentaSel('GDL'), 1);

  assert.deepEqual(idsSel(new Set(['a'])), ['a']);
  assert.deepEqual(idsSel('GDL'), ['GDL']);
  assert.deepEqual(idsSel(undefined), []);

  const g = { opciones: [{ id: 'x', label: 'Equis' }] };
  assert.equal(etiquetaDe(g, 'x'), 'Equis');
  assert.equal(etiquetaDe(g, 'y'), 'y', 'sin opción, cae al id');
});
