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
const { DISPOSICIONES, DISPOSICION_POR_ID } = await vite.ssrLoadModule('/src/lib/dispositivo.js');
const selector = await vite.ssrLoadModule('/src/components/nav/SelectorDisposicion.jsx');

const paginasDePrueba = (n) => Array.from({ length: n }, (_, i) => (
  i === 0 ? { pagina: 'inicio', clienteKey: null } : { pagina: 'sellIn', clienteKey: 'digitalife' }
));

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

test('Paneles con UN hueco: sólo el principal, sin cerrar ni mover', () => {
  const arbol = construirArbol(SUPER);
  const html = pintar(React.createElement(paneles.default, {
    disposicion: 'uno',
    slots: [{ pagina: 'inicio', clienteKey: null }],
    arbol,
    paginaProps: { perfil: SUPER, onNavegar: () => {} },
  }));
  assert.ok(html.includes('Principal'));
  assert.ok(!html.includes('Panel 2'));
  assert.ok(!html.includes('Quitar este panel'), 'el único hueco no se puede cerrar');
  assert.ok(!html.includes('Mover este panel'), 'ni mover');
  assert.ok(html.includes('data-disposicion="uno"'));
});

test('Paneles con DOS huecos: dos pantallas, cada una con su cabecera y su scroll', () => {
  const arbol = construirArbol(SUPER);
  const html = pintar(React.createElement(paneles.default, {
    disposicion: 'dos',
    slots: paginasDePrueba(2),
    arbol,
    paginaProps: { perfil: SUPER, onNavegar: () => {} },
  }));
  assert.ok(html.includes('Principal'));
  assert.ok(html.includes('Panel 2'));
  assert.ok(html.includes('Quitar este panel'), 'el segundo sí se puede cerrar');
  assert.ok(html.includes('data-panel-scroll="0"') && html.includes('data-panel-scroll="1"'), 'cada hueco tiene su propio scroll');
  assert.ok(/grid-template-areas:&quot;a b&quot;|grid-template-areas:"a b"/.test(html), 'la rejilla lleva sus áreas');
  assert.ok(html.includes('Mover este panel hacia adelante'), 'hay botones de intercambio');
  assert.ok(!/NaN/.test(html));
});

test('cada disposición se pinta con sus áreas y su número exacto de huecos', () => {
  const arbol = construirArbol(SUPER);
  DISPOSICIONES.forEach((d) => {
    const html = pintar(React.createElement(paneles.default, {
      disposicion: d.id,
      slots: paginasDePrueba(d.slots),
      arbol,
      paginaProps: { perfil: SUPER, onNavegar: () => {} },
    }));
    assert.ok(html.includes(`data-disposicion="${d.id}"`), `${d.id}: la rejilla se identifica`);
    // Las áreas de la rejilla llegan al DOM (React escapa las comillas).
    const areas = d.gridTemplateAreas.replace(/"/g, '&quot;');
    assert.ok(html.includes(`grid-template-areas:${areas}`), `${d.id}: grid-template-areas`);
    assert.ok(html.includes(`grid-template-columns:repeat(${d.cols}, minmax(0, 1fr))`), `${d.id}: columnas`);
    assert.ok(html.includes(`grid-template-rows:repeat(${d.filas}, minmax(0, 1fr))`), `${d.id}: filas`);
    // Un hueco por slot, cada uno en su área y con su propio scroll.
    for (let i = 0; i < d.slots; i += 1) {
      assert.ok(html.includes(`data-panel-scroll="${i}"`), `${d.id}: falta el hueco ${i}`);
      assert.ok(html.includes(`grid-area:${String.fromCharCode(97 + i)}`), `${d.id}: el hueco ${i} no tiene área`);
    }
    assert.ok(!html.includes(`data-panel-scroll="${d.slots}"`), `${d.id}: sobra un hueco`);
    assert.ok(!/NaN|undefined/.test(html), `${d.id}: HTML limpio`);
  });
});

test('los huecos de sobra se ignoran y la disposición desconocida cae en una que quepa', () => {
  const arbol = construirArbol(SUPER);
  const html = pintar(React.createElement(paneles.default, {
    disposicion: 'dos',
    slots: paginasDePrueba(4),   // sobran dos
    arbol,
    paginaProps: { perfil: SUPER, onNavegar: () => {} },
  }));
  assert.ok(html.includes('data-panel-scroll="1"'));
  assert.ok(!html.includes('data-panel-scroll="2"'), 'la disposición manda sobre la lista');

  const html2 = pintar(React.createElement(paneles.default, {
    disposicion: 'noExiste',
    slots: paginasDePrueba(2),
    arbol,
    paginaProps: { perfil: SUPER, onNavegar: () => {} },
  }));
  assert.ok(/data-disposicion="(uno|dos)"/.test(html2), 'no se rompe con una disposición inventada');
});

test('la forma vieja (columnas) sigue montando sin disposición explícita', () => {
  // Sin `disposicion`, la elige el monitor; en SSR (1440 px) eso es "uno".
  const html = pintar(React.createElement(paneles.default, {
    columnas: paginasDePrueba(2),
    arbol: construirArbol(SUPER),
    paginaProps: { perfil: SUPER, onNavegar: () => {} },
  }));
  assert.ok(html.includes('data-panel-scroll="0"'), 'al menos la principal se pinta');
  assert.ok(/data-disposicion="[a-zA-Z0-9]+"/.test(html));
  assert.ok(!/NaN|undefined/.test(html));

  // Con la disposición dicha, los dos huecos.
  const dos = pintar(React.createElement(paneles.default, {
    disposicion: 'dos',
    columnas: paginasDePrueba(2),
    arbol: construirArbol(SUPER),
    paginaProps: { perfil: SUPER, onNavegar: () => {} },
  }));
  assert.ok(dos.includes('data-panel-scroll="0"') && dos.includes('data-panel-scroll="1"'));
});

test('con varios huecos la rejilla usa todo el ancho (el anchoMax es para una sola pantalla)', () => {
  const html = pintar(React.createElement(paneles.default, {
    disposicion: 'dos',
    slots: paginasDePrueba(2),
    arbol: construirArbol(SUPER),
    anchoMax: 1900,
    paginaProps: { perfil: SUPER, onNavegar: () => {} },
  }));
  assert.ok(!html.includes('max-width:1900px'), 'con dos paneles no se topa el ancho');

  const uno = pintar(React.createElement(paneles.default, {
    disposicion: 'uno',
    slots: paginasDePrueba(1),
    arbol: construirArbol(SUPER),
    anchoMax: 1900,
    paginaProps: { perfil: SUPER, onNavegar: () => {} },
  }));
  assert.ok(uno.includes('max-width:1900px'), 'con una sola pantalla sí');
});

test('el selector de disposición pinta las 7 opciones y marca las que no caben', () => {
  const html = pintar(React.createElement(selector.default, { valor: 'dos', ancho: 2560, alto: 1440 }));
  DISPOSICIONES.forEach((d) => assert.ok(html.includes(d.nombre), `falta ${d.nombre}`));
  assert.ok(html.includes('aria-pressed="true"'), 'la activa se marca');
  assert.ok(html.includes('disabled'), 'en 2560 px "tres en fila" queda deshabilitada');
  assert.ok(html.includes(DISPOSICION_POR_ID.tres.nombre));
  assert.ok(!/NaN/.test(html));

  const ancho = pintar(React.createElement(selector.default, { valor: 'cuatro', ancho: 5120, alto: 1440 }));
  assert.ok(!ancho.includes('disabled'), 'en 49" caben todas');
});
