// Pruebas puras de src/lib/dispositivo.js: qué modo corresponde a cada ancho, cuántas columnas
// caben en cada monitor y cómo se guardan las preferencias por dispositivo (con un localStorage falso).
//   node --test scripts/test-dispositivo.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
test.after(async () => { await vite.close(); setTimeout(() => process.exit(process.exitCode || 0), 200).unref(); });

const disp = await vite.ssrLoadModule('/src/lib/dispositivo.js');
const {
  modoDe, orientacionDe, maxColumnas, normalizarPaneles, leerPrefsDispositivo, setPrefDispositivo,
  DEFAULTS_DISPOSITIVO, LS_DISPOSITIVO,
  DISPOSICIONES, DISPOSICION_POR_ID, disposicionDisponible, disposicionesDisponibles,
  disposicionEfectiva, disposicionParaSlots, migrarPaneles, panelesEfectivos, intercambiarSlots,
  rectosDisposicion, posicionSlot,
} = disp;

// Los tres monitores de la oficina.
const M27 = { ancho: 2560, alto: 1440 };
const M34 = { ancho: 3440, alto: 1440 };
const M49 = { ancho: 5120, alto: 1440 };
const idsDisponibles = (m) => disposicionesDisponibles(m).filter((d) => d.disponible).map((d) => d.id).sort();

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
  setPrefDispositivo('panoramico', 'paneles', { disposicion: 'dos', slots: [{ pagina: 'inicio' }, { pagina: 'sellOut' }] }, st);
  const pano = leerPrefsDispositivo('panoramico', st);
  assert.equal(pano.anchoMax, 1900);
  assert.equal(pano.paneles.disposicion, 'dos');
  assert.equal(pano.paneles.slots.length, 2);
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
  assert.deepEqual(p.paneles, { disposicion: 'uno', slots: [] });
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

// ─── Disposiciones (layouts) ───

test('cada disposición declara su rejilla y sus huecos', () => {
  assert.equal(DISPOSICIONES.length, 7);
  const esperado = {
    uno:             { slots: 1, cols: 1, filas: 1, areas: '"a"' },
    dos:             { slots: 2, cols: 2, filas: 1, areas: '"a b"' },
    tres:            { slots: 3, cols: 3, filas: 1, areas: '"a b c"' },
    dosArriba1Lado:  { slots: 3, cols: 2, filas: 2, areas: '"a c" "b c"' },
    unoLado2Derecha: { slots: 3, cols: 2, filas: 2, areas: '"a b" "a c"' },
    unoArriba2Abajo: { slots: 3, cols: 2, filas: 2, areas: '"a a" "b c"' },
    cuatro:          { slots: 4, cols: 2, filas: 2, areas: '"a b" "c d"' },
  };
  Object.entries(esperado).forEach(([id, e]) => {
    const d = DISPOSICION_POR_ID[id];
    assert.ok(d, `falta la disposición ${id}`);
    assert.equal(d.slots, e.slots, id);
    assert.equal(d.cols, e.cols, id);
    assert.equal(d.filas, e.filas, id);
    assert.equal(d.gridTemplateAreas, e.areas, id);
    assert.ok(d.nombre && d.descripcion, `${id} necesita nombre y descripción`);
  });
});

test('qué disposiciones caben en cada monitor (900 px de ancho · 420 px de alto por hueco)', () => {
  // Una laptop de 1440 px no da ni para dos: sólo "uno".
  assert.deepEqual(idsDisponibles({ ancho: 1440, alto: 900 }), ['uno']);
  // 27" (2560 × 1440): todo menos los tres en fila (necesitarían 2700 px).
  assert.deepEqual(idsDisponibles(M27),
    ['cuatro', 'dos', 'dosArriba1Lado', 'uno', 'unoArriba2Abajo', 'unoLado2Derecha']);
  // 34" añade "tres".
  assert.deepEqual(idsDisponibles(M34),
    ['cuatro', 'dos', 'dosArriba1Lado', 'tres', 'uno', 'unoArriba2Abajo', 'unoLado2Derecha']);
  // 49": todas.
  assert.equal(idsDisponibles(M49).length, DISPOSICIONES.length);
});

test('un monitor bajito bloquea las disposiciones apiladas, no las de una fila', () => {
  const bajo = { ancho: 3440, alto: 700 };   // 700 / 2 = 350 < 420
  assert.deepEqual(idsDisponibles(bajo), ['dos', 'tres', 'uno']);
  const { disponible, razon } = disposicionDisponible('cuatro', bajo);
  assert.equal(disponible, false);
  assert.ok(/alto/i.test(razon), 'la razón habla del alto');
});

test('cuando no cabe se explica el porqué y se cae a la mayor que sí quepa', () => {
  const r = disposicionDisponible('tres', M27);
  assert.equal(r.disponible, false);
  assert.ok(/900 px/.test(r.razon) && /2560/.test(r.razon));
  // "tres" en un 27" cae a la mayor que sí cabe sin perder pantallas: "dos y una alta" (3 huecos).
  assert.equal(disposicionEfectiva('tres', M27), 'dosArriba1Lado');
  // Si además el monitor es bajito, no hay apiladas: baja a "dos".
  assert.equal(disposicionEfectiva('tres', { ancho: 2560, alto: 700 }), 'dos');
  assert.equal(disposicionEfectiva('tres', M34), 'tres');
  assert.equal(disposicionEfectiva('cuatro', { ancho: 1440, alto: 900 }), 'uno');
  assert.equal(disposicionEfectiva('inventada', M49), 'uno');
});

test('disposicionParaSlots elige la primera que cabe con ese número de huecos', () => {
  assert.equal(disposicionParaSlots(1, M27), 'uno');
  assert.equal(disposicionParaSlots(2, M27), 'dos');
  assert.equal(disposicionParaSlots(3, M34), 'tres');
  assert.equal(disposicionParaSlots(3, M27), 'dosArriba1Lado', 'sin ancho para tres en fila, la apilada');
  assert.equal(disposicionParaSlots(4, M27), 'cuatro');
  assert.equal(disposicionParaSlots(0, M27), 'uno');
});

test('migración transparente de las preferencias viejas (array de columnas)', () => {
  assert.deepEqual(migrarPaneles([]), { disposicion: 'uno', slots: [] });
  assert.deepEqual(migrarPaneles([{ pagina: 'inicio' }]), { disposicion: 'uno', slots: [] });
  assert.deepEqual(migrarPaneles([{ pagina: 'inicio' }, { pagina: 'sellOut' }]), {
    disposicion: 'dos',
    slots: [{ pagina: 'inicio', clienteKey: null }, { pagina: 'sellOut', clienteKey: null }],
  });
  assert.equal(migrarPaneles([{ pagina: 'a' }, { pagina: 'b' }, { pagina: 'c' }]).disposicion, 'tres');
  assert.equal(migrarPaneles([{ pagina: 'a' }, { pagina: 'b' }, { pagina: 'c' }, { pagina: 'd' }]).disposicion, 'cuatro');
  // Basura de cualquier tipo → la forma vacía, nunca una excepción.
  [null, undefined, 'no', 7, { disposicion: 'noExiste' }, { disposicion: 'dos', slots: 'x' }]
    .forEach((v) => assert.equal(typeof migrarPaneles(v).disposicion, 'string'));
  assert.deepEqual(migrarPaneles({ disposicion: 'noExiste', slots: [] }), { disposicion: 'uno', slots: [] });
  assert.deepEqual(migrarPaneles({ disposicion: 'dos', slots: 'x' }).slots, [
    { pagina: 'inicio', clienteKey: null }, { pagina: 'inicio', clienteKey: null },
  ]);
});

test('panelesEfectivos recorta a lo que cabe y rellena los huecos', () => {
  const guardado = { disposicion: 'cuatro', slots: [{ pagina: 'inicio' }, { pagina: 'sellOut' }, { pagina: 'agenda' }, { pagina: 'sellIn', clienteKey: 'pcel' }] };
  assert.deepEqual(panelesEfectivos(guardado, M27).slots.length, 4);
  // En una laptop no hay paneles: exactamente como antes de todo esto.
  assert.deepEqual(panelesEfectivos(guardado, { ancho: 1440, alto: 900 }), { disposicion: 'uno', slots: [] });
  // Un "tres en fila" guardado en el 34" se reacomoda en el 27" sin perder ninguna pantalla.
  const tres = { disposicion: 'tres', slots: [{ pagina: 'a' }, { pagina: 'b' }, { pagina: 'c' }] };
  const en27 = panelesEfectivos(tres, M27);
  assert.equal(en27.disposicion, 'dosArriba1Lado');
  assert.deepEqual(en27.slots.map((s) => s.pagina), ['a', 'b', 'c']);
  // En un monitor bajito sí hay que recortar: quedan las dos primeras.
  const bajito = panelesEfectivos(tres, { ancho: 2560, alto: 700 });
  assert.equal(bajito.disposicion, 'dos');
  assert.deepEqual(bajito.slots.map((s) => s.pagina), ['a', 'b']);
  // Y vuelve a ser "tres" al regresar al monitor grande (lo guardado no se toca).
  assert.equal(panelesEfectivos(tres, M34).disposicion, 'tres');
  // La forma vieja sigue funcionando sin migración explícita.
  assert.equal(panelesEfectivos([{ pagina: 'a' }, { pagina: 'b' }], M27).disposicion, 'dos');
});

test('intercambiar huecos (incluido el 0, que es la pestaña activa)', () => {
  const s = [{ pagina: 'a', clienteKey: null }, { pagina: 'b', clienteKey: null }, { pagina: 'c', clienteKey: null }];
  assert.deepEqual(intercambiarSlots(s, 0, 2).map((x) => x.pagina), ['c', 'b', 'a']);
  assert.deepEqual(intercambiarSlots(s, 1, 2).map((x) => x.pagina), ['a', 'c', 'b']);
  assert.deepEqual(s.map((x) => x.pagina), ['a', 'b', 'c'], 'no muta el original');
  // Índices que no valen: todo igual, sin lanzar.
  assert.deepEqual(intercambiarSlots(s, 0, 0).map((x) => x.pagina), ['a', 'b', 'c']);
  assert.deepEqual(intercambiarSlots(s, 0, 9).map((x) => x.pagina), ['a', 'b', 'c']);
  assert.deepEqual(intercambiarSlots(null, 0, 1), []);
});

test('pictogramas y posiciones: rectángulos normalizados por hueco', () => {
  assert.deepEqual(rectosDisposicion('uno'), [{ x: 0, y: 0, w: 1, h: 1 }]);
  assert.deepEqual(rectosDisposicion('dos'), [
    { x: 0, y: 0, w: 0.5, h: 1 }, { x: 0.5, y: 0, w: 0.5, h: 1 },
  ]);
  // "a c" / "b c": la c ocupa la columna derecha completa.
  assert.deepEqual(rectosDisposicion('dosArriba1Lado')[2], { x: 0.5, y: 0, w: 0.5, h: 1 });
  // "a a" / "b c": la a ocupa toda la fila de arriba.
  assert.deepEqual(rectosDisposicion('unoArriba2Abajo')[0], { x: 0, y: 0, w: 1, h: 0.5 });
  assert.deepEqual(rectosDisposicion('inventada'), []);
  // Posiciones: el vecino de "a" en "a a"/"b c" está en otra fila (→ flecha ▼ en la UI).
  assert.deepEqual(posicionSlot('unoArriba2Abajo', 0), { fila: 0, col: 0 });
  assert.deepEqual(posicionSlot('unoArriba2Abajo', 1), { fila: 1, col: 0 });
  assert.deepEqual(posicionSlot('dos', 1), { fila: 0, col: 1 });
});
