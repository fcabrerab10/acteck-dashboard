// Pruebas puras de src/lib/dispositivo.js: qué modo corresponde a cada ancho, cuántas columnas
// caben en cada monitor y cómo se guardan las preferencias por dispositivo (con un localStorage falso).
//   node --test scripts/test-dispositivo.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
test.after(async () => { await vite.close(); setTimeout(() => process.exit(process.exitCode || 0), 200).unref(); });

const disp = await vite.ssrLoadModule('/src/lib/dispositivo.js');
const { modoDe, orientacionDe, maxColumnas, normalizarPaneles, leerPrefsDispositivo, setPrefDispositivo, DEFAULTS_DISPOSITIVO, LS_DISPOSITIVO } = disp;

// localStorage de mentira (el real no existe en Node y el modo privado de Safari lanza).
function falso(inicial = {}) {
  const datos = new Map(Object.entries(inicial));
  return {
    getItem: (k) => (datos.has(k) ? datos.get(k) : null),
    setItem: (k, v) => datos.set(k, String(v)),
    removeItem: (k) => datos.delete(k),
    _datos: datos,
  };
}

test('el modo sale del ancho (y el táctil sólo desempata tabletas)', () => {
  assert.equal(modoDe({ ancho: 390, alto: 844, touch: true }), 'telefono');      // iPhone 14
  assert.equal(modoDe({ ancho: 430, alto: 932, touch: true }), 'telefono');      // iPhone 16 Pro Max
  assert.equal(modoDe({ ancho: 699, alto: 900, touch: true }), 'telefono');
  assert.equal(modoDe({ ancho: 700, alto: 1000, touch: true }), 'tabletaCompacta');
  assert.equal(modoDe({ ancho: 834, alto: 1194, touch: true }), 'tabletaCompacta'); // iPad Pro 11 vertical
  assert.equal(modoDe({ ancho: 1024, alto: 1366, touch: true }), 'tabletaCompacta'); // iPad mini vertical
  assert.equal(modoDe({ ancho: 1194, alto: 834, touch: true }), 'tableta');        // iPad Pro 11 horizontal
  assert.equal(modoDe({ ancho: 1194, alto: 834, touch: false }), 'laptop');        // ventana angosta en Mac
  assert.equal(modoDe({ ancho: 1280, alto: 800, touch: false }), 'laptop');
  assert.equal(modoDe({ ancho: 1440, alto: 900, touch: false }), 'laptop');        // la Mac de Fernando
  assert.equal(modoDe({ ancho: 1899, alto: 1000, touch: false }), 'laptop');
  assert.equal(modoDe({ ancho: 1900, alto: 1000, touch: false }), 'panoramico');
  assert.equal(modoDe({ ancho: 2560, alto: 1440, touch: false }), 'panoramico');   // 27"
  assert.equal(modoDe({ ancho: 3440, alto: 1440, touch: false }), 'panoramico');   // 34"
  assert.equal(modoDe({ ancho: 5120, alto: 1440, touch: false }), 'panoramico');   // 49"
});

test('sin datos (SSR) no se rompe: cae en laptop', () => {
  assert.equal(modoDe(), 'laptop');
  assert.equal(modoDe({ ancho: 0 }), 'laptop');
  assert.equal(modoDe({ ancho: NaN }), 'laptop');
});

test('orientación', () => {
  assert.equal(orientacionDe({ ancho: 1194, alto: 834 }), 'horizontal');
  assert.equal(orientacionDe({ ancho: 834, alto: 1194 }), 'vertical');
});

test('columnas que caben: 900 px por columna, tope 4', () => {
  assert.equal(maxColumnas(1440), 1);
  assert.equal(maxColumnas(1900), 2);
  assert.equal(maxColumnas(2560), 2);   // 27"
  assert.equal(maxColumnas(3440), 3);   // 34"
  assert.equal(maxColumnas(5120), 4);   // 49" (daría 5, pero el tope es 4)
  assert.equal(maxColumnas(undefined), 1);
});

test('normalizarPaneles rellena y recorta sin inventar páginas', () => {
  assert.deepEqual(normalizarPaneles([], 2), [
    { pagina: 'inicio', clienteKey: null },
    { pagina: 'inicio', clienteKey: null },
  ]);
  assert.deepEqual(normalizarPaneles([{ pagina: 'sellIn', clienteKey: 'digitalife' }, { pagina: 'agenda' }], 1), [
    { pagina: 'sellIn', clienteKey: 'digitalife' },
  ]);
  assert.deepEqual(normalizarPaneles([{ pagina: 'sellOut' }, null, { malo: true }], 3), [
    { pagina: 'sellOut', clienteKey: null },
    { pagina: 'inicio', clienteKey: null },
    { pagina: 'inicio', clienteKey: null },
  ]);
});

test('preferencias por dispositivo: defaults, guardado y aislamiento entre modos', () => {
  const st = falso();
  // Sin nada guardado: los defaults del modo.
  assert.deepEqual(leerPrefsDispositivo('laptop', st), DEFAULTS_DISPOSITIVO.laptop);
  assert.equal(leerPrefsDispositivo('tableta', st).sidebar, 'iconos');
  assert.equal(leerPrefsDispositivo('laptop', st).sidebar, 'completa');

  // Guardar en un modo no toca a los demás.
  setPrefDispositivo('laptop', 'densidad', 'compacta', st);
  assert.equal(leerPrefsDispositivo('laptop', st).densidad, 'compacta');
  assert.equal(leerPrefsDispositivo('panoramico', st).densidad, 'comoda');

  setPrefDispositivo('panoramico', 'anchoMax', 1900, st);
  setPrefDispositivo('panoramico', 'paneles', [{ pagina: 'inicio' }, { pagina: 'sellOut' }], st);
  const pano = leerPrefsDispositivo('panoramico', st);
  assert.equal(pano.anchoMax, 1900);
  assert.equal(pano.paneles.length, 2);
  assert.equal(leerPrefsDispositivo('laptop', st).densidad, 'compacta', 'lo de laptop sigue ahí');

  // Se guarda todo bajo una sola llave.
  assert.ok(st.getItem(LS_DISPOSITIVO).includes('panoramico'));
});

test('valores corruptos en localStorage no rompen nada', () => {
  const st = falso({ [LS_DISPOSITIVO]: '{ esto no es json' });
  assert.deepEqual(leerPrefsDispositivo('laptop', st), DEFAULTS_DISPOSITIVO.laptop);

  const st2 = falso({ [LS_DISPOSITIVO]: JSON.stringify({ laptop: { densidad: 'gigante', sidebar: 7, anchoMax: 'ancho', paneles: 'no' } }) });
  const p = leerPrefsDispositivo('laptop', st2);
  assert.equal(p.densidad, 'comoda');
  assert.equal(p.sidebar, 'completa');
  assert.equal(p.anchoMax, 1600);
  assert.deepEqual(p.paneles, []);
});

test('sin localStorage (SSR) devuelve los defaults', () => {
  assert.deepEqual(leerPrefsDispositivo('panoramico', null), DEFAULTS_DISPOSITIVO.panoramico);
});

test('las variables CSS de densidad existen para los dos valores', () => {
  assert.equal(disp.VARS_DENSIDAD.comoda['--dens-panel-pad'], '10px 12px', 'cómoda = lo de siempre');
  assert.ok(disp.VARS_DENSIDAD.compacta['--dens-panel-pad']);
  assert.ok(disp.VARS_DENSIDAD.compacta['--dens-fila-pad']);
  assert.ok(disp.VARS_DENSIDAD.compacta['--dens-kpi-pad']);
  // aplicarDensidad no debe explotar aunque no haya document.
  disp.aplicarDensidad('compacta');
});
