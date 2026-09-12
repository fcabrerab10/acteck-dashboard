// Smoke de TODAS las pantallas (web y móvil): carga cada módulo .jsx con el pipeline de Vite en SSR.
// Atrapa imports rotos, JSX inválido y ReferenceErrors a nivel de módulo antes de subir a producción.
// No renderiza (las pantallas necesitan red): sólo importa. Los módulos que exigen `window` al
// importarse se listan en TOLERADOS.
//   node --test scripts/test-pantallas-ssr.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { fileURLToPath } from 'node:url';
const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const CARPETAS = ['src/modules', 'src/movil', 'src/components', 'src/lib'];
const TOLERADOS = new Set([]); // módulos que sólo cargan en navegador

function listar(dir) {
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (n.startsWith('_archivo') || n === 'node_modules') continue;
    if (statSync(p).isDirectory()) out.push(...listar(p));
    else if (/\.(jsx|js)$/.test(n) && !/\.test\./.test(n)) out.push(p);
  }
  return out;
}

const archivos = CARPETAS.flatMap((c) => listar(join(RAIZ, c))).map((p) => '/' + relative(RAIZ, p));
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
test.after(async () => { await vite.close(); setTimeout(() => process.exit(process.exitCode || 0), 200).unref(); });

// Globals mínimos que algunos módulos leen al importarse (sin simular un navegador completo).
globalThis.window ??= globalThis;
globalThis.navigator ??= { userAgent: 'node', language: 'es-MX', onLine: true };
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {}, clear() {} };
globalThis.sessionStorage ??= globalThis.localStorage;
globalThis.document ??= { createElement: () => ({ style: {}, setAttribute() {}, getContext: () => null }), addEventListener() {}, removeEventListener() {}, documentElement: { style: {}, dataset: {} }, body: { style: {} }, querySelector: () => null, getElementById: () => null, head: { appendChild() {} } };
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.requestAnimationFrame ??= (f) => setTimeout(f, 0);
globalThis.location ??= { hash: '', href: 'http://localhost/', origin: 'http://localhost', search: '' };
globalThis.addEventListener ??= () => {};
globalThis.removeEventListener ??= () => {};

test(`cargan los ${archivos.length} módulos de src (web + móvil)`, async () => {
  const fallas = [];
  let i = 0;
  for (const m of archivos) {
    i += 1;
    if (i % 50 === 0) process.stderr.write(`  … ${i}/${archivos.length}\n`);
    // Un módulo que se cuelga al importarse (await de red a nivel superior) se reporta, no detiene la prueba.
    let timer;
    const tope = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('import colgado > 20 s')), 20000); });
    try { await Promise.race([vite.ssrLoadModule(m), tope]); }
    catch (e) {
      if (!TOLERADOS.has(m)) fallas.push(`${m}: ${String(e.message || e).split('\n')[0].slice(0, 160)}`);
    } finally { clearTimeout(timer); }
  }
  assert.deepEqual(fallas, [], `módulos que no cargan:\n${fallas.join('\n')}`);
});
