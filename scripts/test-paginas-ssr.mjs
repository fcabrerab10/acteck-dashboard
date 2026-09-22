// Smoke SSR del enrutado por pantalla: PaginaContenido (el switch que antes vivía en App.jsx)
// y Paneles (el modo de varias columnas del monitor panorámico).
//   node --test scripts/test-paginas-ssr.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';

globalThis.window ??= globalThis;
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {}, clear() {} };
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
globalThis.addEventListener ??= () => {};
globalThis.removeEventListener ??= () => {};

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
test.after(async () => { await vite.close(); setTimeout(() => process.exit(process.exitCode || 0), 200).unref(); });

const { ThemeProvider } = await vite.ssrLoadModule('/src/lib/themeContext.jsx');
const { default: PaginaContenido } = await vite.ssrLoadModule('/src/components/PaginaContenido.jsx');
const paneles = await vite.ssrLoadModule('/src/components/nav/Paneles.jsx');
const { construirArbol } = await vite.ssrLoadModule('/src/components/nav/arbol.js');

const SUPER = { user_id: 'u1', nombre: 'Fernando', es_super_admin: true, activo: true, permisos: {} };
const pintar = (el) => renderToString(React.createElement(ThemeProvider, null, el));

test('los dos módulos cargan y exportan lo que se espera', () => {
  assert.equal(typeof PaginaContenido, 'function');
  assert.equal(typeof paneles.default, 'function');
  assert.equal(typeof paneles.opcionesDePaginas, 'function');
});

test('PaginaContenido respeta los permisos (sin perfil, nadie pasa)', () => {
  const html = pintar(React.createElement(PaginaContenido, { pagina: 'visionGeneral', clienteKey: null, perfil: null }));
  assert.ok(/No tienes acceso/.test(html), 'sin perfil debe salir SinAcceso');
  assert.ok(!/NaN/.test(html));
});

test('PaginaContenido con una página desconocida no pinta nada (ni truena)', () => {
  const html = pintar(React.createElement(PaginaContenido, { pagina: 'noExiste', clienteKey: null, perfil: SUPER }));
  assert.equal(typeof html, 'string');
  assert.ok(!/NaN|undefined/.test(html));
});

test('el selector de paneles ofrece las pantallas del árbol del perfil', () => {
  const arbol = construirArbol(SUPER);
  const ops = paneles.opcionesDePaginas(arbol);
  assert.ok(ops.length > 5, 'un super admin ve muchas pantallas');
  assert.ok(ops.every((o) => o.pagina && typeof o.label === 'string'));
  assert.ok(ops.some((o) => o.clienteKey === 'digitalife' && o.label.includes('Digitalife')), 'las de cliente llevan el nombre del cliente');
  assert.ok(!ops.some((o) => o.pagina === undefined));
});

test('Paneles con UNA columna: sólo la principal, sin botón de cerrar', () => {
  const arbol = construirArbol(SUPER);
  const html = pintar(React.createElement(paneles.default, {
    columnas: [{ pagina: 'inicio', clienteKey: null }],
    arbol,
    paginaProps: { perfil: SUPER, onNavegar: () => {} },
  }));
  assert.ok(html.includes('Principal'));
  assert.ok(!html.includes('Panel 2'));
  assert.ok(!html.includes('Quitar este panel'), 'la única columna no se puede cerrar');
});

test('Paneles con DOS columnas: dos pantallas, cada una con su cabecera y su scroll', () => {
  const arbol = construirArbol(SUPER);
  const html = pintar(React.createElement(paneles.default, {
    columnas: [{ pagina: 'inicio', clienteKey: null }, { pagina: 'sellIn', clienteKey: 'digitalife' }],
    arbol,
    paginaProps: { perfil: SUPER, onNavegar: () => {} },
  }));
  assert.ok(html.includes('Principal'));
  assert.ok(html.includes('Panel 2'));
  assert.ok(html.includes('Quitar este panel'), 'la segunda sí se puede cerrar');
  assert.ok(html.includes('data-panel-scroll="0"') && html.includes('data-panel-scroll="1"'), 'cada columna tiene su propio scroll');
  assert.ok(/repeat\(2, minmax\(0, 1fr\)\)/.test(html), 'la rejilla es de 2 columnas');
  assert.ok(!/NaN/.test(html));
});

test('Paneles respeta el ancho máximo cuando se le pasa', () => {
  const html = pintar(React.createElement(paneles.default, {
    columnas: [{ pagina: 'inicio', clienteKey: null }, { pagina: 'agenda', clienteKey: null }],
    arbol: construirArbol(SUPER),
    anchoMax: 1900,
    paginaProps: { perfil: SUPER, onNavegar: () => {} },
  }));
  assert.ok(html.includes('max-width:1900px'), 'el tope de ancho llega al DOM');
});
