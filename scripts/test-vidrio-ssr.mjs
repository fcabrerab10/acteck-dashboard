// Deslizador de vidrio (src/lib/vidrio.js) · lo que importa es que "Opaco" sea EXACTAMENTE lo de antes.
// Se resuelve a mano `var(--x, fallback)` con el mapa de variables de cada parada y se compara el
// resultado contra los literales que tenía el chrome antes del cambio (copiados aquí a mano).
//   node --test scripts/test-vidrio-ssr.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

globalThis.window ??= globalThis;
globalThis.navigator ??= { userAgent: 'node', language: 'es-MX' };
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
test.after(async () => { await vite.close(); setTimeout(() => process.exit(process.exitCode || 0), 200).unref(); });

const { varsVidrio, nivelEfectivo, VARS_VIDRIO, NIVELES_VIDRIO } = await vite.ssrLoadModule('/src/lib/vidrio.js');
const navComun = await vite.ssrLoadModule('/src/components/nav/comun.jsx');
const perfilComun = await vite.ssrLoadModule('/src/components/perfil/comun.jsx');
const { leerPrefsDispositivo, DEFAULTS_DISPOSITIVO } = await vite.ssrLoadModule('/src/lib/dispositivo.js');

/** Resuelve `var(--x, fallback)` (una sola capa, que es lo que usa el chrome). */
function resolver(valor, vars = {}) {
  return String(valor).replace(/var\((--[\w-]+)\s*,\s*([\s\S]*?)\)(?=(?:[^()]*\([^()]*\))*[^()]*$)/g,
    (_, name, fb) => (vars[name] != null ? vars[name] : fb));
}

const CLARO = { key: 'claro', mode: 'light', text: '#1D1D1F', border: 'rgba(0,0,0,0.08)' };
const MIDNIGHT = { key: 'midnight', mode: 'dark', text: '#FFF', borderStrong: 'rgba(255,255,255,0.15)' };

test('resolver() entiende var() con fallback (sanidad de la propia prueba)', () => {
  assert.equal(resolver('var(--a, rojo)'), 'rojo');
  assert.equal(resolver('var(--a, rojo)', { '--a': 'azul' }), 'azul');
  assert.equal(resolver('var(--s, 0 0 0 0 rgba(0,0,0,0)), 0 1px 2px #000'), '0 0 0 0 rgba(0,0,0,0), 0 1px 2px #000');
});

test('Opaco no define ninguna variable (manda el fallback)', () => {
  assert.deepEqual(varsVidrio('opaco', CLARO), {});
  assert.deepEqual(varsVidrio(undefined, MIDNIGHT), {});
  assert.equal(nivelEfectivo('vidrio', { forzarOpaco: true }), 'opaco', 'reduced-transparency fuerza Opaco');
  assert.equal(nivelEfectivo('inventado'), 'opaco');
  assert.equal(nivelEfectivo('tintado'), 'tintado');
});

test('Opaco = los literales de antes, byte a byte', () => {
  // chrome (sidebar iPad · barra superior del celular)
  const chromeClaro = navComun.vidrio(CLARO, 'chrome');
  assert.equal(resolver(chromeClaro.background), 'rgba(245,245,247,0.82)');
  assert.equal(resolver(chromeClaro.backdropFilter), 'saturate(180%) blur(24px)');
  assert.equal(resolver(navComun.vidrio(MIDNIGHT, 'chrome').background), 'rgba(10,10,12,0.78)');
  assert.equal(resolver(navComun.vidrio({ key: 'marfil', mode: 'light' }, 'chrome').background), 'rgba(247,243,236,0.86)');

  // popover (Paleta ⌘K)
  const pop = navComun.vidrio(CLARO, 'popover');
  assert.equal(resolver(pop.background), 'rgba(255,255,255,0.92)');
  assert.equal(resolver(pop.backdropFilter), 'saturate(180%) blur(30px)');
  assert.equal(resolver(pop.border), '1px solid rgba(0,0,0,0.08)');
  assert.equal(resolver(pop.boxShadow), '0 0 0 0 rgba(0,0,0,0), 0 2px 6px rgba(0,0,0,0.08), 0 16px 48px rgba(0,0,0,0.16)');

  // HojaLateral / Modal (perfil)
  const hoja = perfilComun.vidrio(CLARO, 14);
  assert.equal(resolver(hoja.background), 'rgba(255,255,255,0.90)');
  assert.equal(resolver(hoja.backdropFilter), 'saturate(180%) blur(24px)');
  assert.equal(resolver(hoja.border), '1px solid rgba(0,0,0,0.08)');
  assert.equal(resolver(hoja.boxShadow), '0 0 0 0 rgba(0,0,0,0), 0 2px 6px rgba(0,0,0,0.08), 0 16px 48px rgba(0,0,0,0.16)');
  assert.equal(resolver(perfilComun.vidrio(MIDNIGHT, 18).background), 'rgba(36,36,40,0.88)');
});

test('Tintado y Vidrio sí cambian el chrome (y sólo el chrome)', () => {
  const t = varsVidrio('tintado', CLARO);
  assert.equal(t['--vidrio-bg'], 'rgba(255,255,255,0.60)');
  assert.equal(t['--vidrio-blur'], 'saturate(180%) blur(10px)');
  const v = varsVidrio('vidrio', CLARO);
  assert.equal(v['--vidrio-bg'], 'rgba(255,255,255,0.55)');
  assert.equal(v['--vidrio-blur'], 'saturate(120%) blur(16px)');
  assert.match(v['--vidrio-shine'], /inset 0 1px 0/);
  assert.equal(varsVidrio('vidrio', MIDNIGHT)['--vidrio-bg'], 'rgba(255,255,255,0.08)');
  // La barra apple.com nunca se aclara: usa la variante -oscuro.
  assert.equal(v['--vidrio-bg-oscuro'], 'rgba(29,29,31,0.55)');
  // Cada parada define TODAS las claves (para que no se mezclen dos niveles).
  ['tintado', 'vidrio'].forEach((n) => assert.deepEqual(Object.keys(varsVidrio(n, CLARO)).sort(), [...VARS_VIDRIO].sort()));
  assert.deepEqual(NIVELES_VIDRIO.map((n) => n.id), ['opaco', 'tintado', 'vidrio']);
});

test('la preferencia vive por dispositivo y arranca en Opaco', () => {
  Object.values(DEFAULTS_DISPOSITIVO).forEach((d) => assert.equal(d.vidrio, 'opaco'));
  const st = { _d: new Map(), getItem: (k) => st._d.get(k) ?? null, setItem: (k, v) => st._d.set(k, String(v)) };
  st.setItem('disp_prefs_v1', JSON.stringify({ laptop: { vidrio: 'basura' }, telefono: { vidrio: 'vidrio' } }));
  assert.equal(leerPrefsDispositivo('laptop', st).vidrio, 'opaco', 'un valor inválido cae a Opaco');
  assert.equal(leerPrefsDispositivo('telefono', st).vidrio, 'vidrio');
});
