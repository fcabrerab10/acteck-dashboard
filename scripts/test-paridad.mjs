// Congruencia web ↔ celular (2026-11-11). Falla cuando algo queda en un solo lado SIN anotarse en scripts/paridad.json:
//   1) una página global del menú (arbol.js) sin ruta en el celular (movil/rutas.js) y sin motivo;
//   2) un import nuevo desde src/modules/** hacia src/movil/** (el motor compartido debe vivir en modules o lib);
//   3) un bloque del registro sin `estado`.
// Para actualizar la lista de imports permitidos tras mover un motor: PARIDAD_ACTUALIZAR=1 node scripts/test-paridad.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');
const reg = JSON.parse(leer('scripts/paridad.json'));

function archivos(dir, out = []) {
  for (const e of fs.readdirSync(path.join(RAIZ, dir), { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) archivos(p, out); else if (/\.(jsx?|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

test('toda página global del menú tiene pantalla en el celular (o motivo anotado)', () => {
  const arbol = leer('src/components/nav/arbol.js');
  const rutas = leer('src/movil/rutas.js');
  const globales = rutas.slice(rutas.indexOf('const GLOBALES'), rutas.indexOf('const CLIENTE'));
  const paginas = [...arbol.slice(arbol.indexOf('const GRUPOS_BASE'), arbol.indexOf('export const idNodo')).matchAll(/pagina: '(\w+)'/g)].map((m) => m[1]);
  const faltan = paginas.filter((p) => !new RegExp(`\\b${p}:`).test(globales) && !reg.paginasSoloWeb[p]);
  assert.deepEqual(faltan, [], `Páginas sin ruta móvil ni motivo en scripts/paridad.json: ${faltan.join(', ')}`);
});

test('no hay imports nuevos de modules → movil', () => {
  const hallados = [];
  for (const f of archivos('src/modules')) {
    for (const m of leer(f).matchAll(/from '((?:\.\.\/)+movil\/[^']+)'/g)) hallados.push(`${f} → ${m[1].replace(/^(\.\.\/)+/, '')}`);
  }
  hallados.sort();
  if (process.env.PARIDAD_ACTUALIZAR) {
    reg.importsModulesAMovil = hallados;
    fs.writeFileSync(path.join(RAIZ, 'scripts/paridad.json'), `${JSON.stringify(reg, null, 2)}\n`);
    return;
  }
  const nuevos = hallados.filter((h) => !reg.importsModulesAMovil.includes(h));
  assert.deepEqual(nuevos, [], `Imports nuevos de modules hacia movil (mueve el motor a modules/ o lib/):\n${nuevos.join('\n')}`);
});

test('cada bloque del registro tiene estado', () => {
  for (const b of reg.bloques) {
    assert.ok(['web', 'movil'].includes(b.falta), `${b.pantalla} · ${b.bloque}: «falta» debe ser web o movil`);
    assert.match(String(b.estado), /^(pendiente|decision|hecho)/, `${b.pantalla} · ${b.bloque}`);
  }
  const pend = reg.bloques.filter((b) => b.estado.startsWith('pendiente'));
  console.log(`  paridad: ${pend.length} bloques pendientes de emparejar (${pend.filter((b) => b.falta === 'web').length} faltan en web, ${pend.filter((b) => b.falta === 'movil').length} en celular)`);
});
