// Pruebas del buzón de salida (src/lib/buzon.js) — cola offline, FIFO, ids temporales,
// reintento y descarte. IndexedDB se sustituye por un Map inyectado con configurarAlmacen().
//   node --test scripts/test-buzon.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  configurarAlmacen, escribir, encolar, sincronizar, reintentar, descartar, vaciar,
  leerCola, esTemp, resolverTemps, quedanTemps, describir, esErrorDeRed, estadoBuzon,
} from '../src/lib/buzon.js';

// ── Almacén falso (un Map, como el IndexedDB de idb-keyval) ──
const mapa = new Map();
configurarAlmacen({
  async leer() { return JSON.parse(JSON.stringify(mapa.get('cola') || [])); },
  async escribir(cola) { if (!cola.length) mapa.delete('cola'); else mapa.set('cola', JSON.parse(JSON.stringify(cola))); },
});

// navigator.onLine lo controla cada prueba.
globalThis.navigator ??= {};
const ponerSenal = (v) => { globalThis.navigator.onLine = v; };
globalThis.window ??= { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };

const limpiar = async () => { mapa.clear(); await vaciar(); };

// Aplicador falso: registra lo que le llega y devuelve una fila con id real.
function aplicadorFalso({ fallaVeces = 0, idBase = 1 } = {}) {
  const vistos = [];
  let n = idBase;
  let fallos = fallaVeces;
  const fn = async (item) => {
    if (fallos > 0) { fallos -= 1; throw new Error('Failed to fetch'); }
    vistos.push(item);
    return { id: `real_${n++}`, ...(Array.isArray(item.filas) ? item.filas[0] : item.filas) };
  };
  fn.vistos = vistos;
  return fn;
}

// ───────────────────────────── Helpers puros ─────────────────────────────
test('esTemp / resolverTemps / quedanTemps', () => {
  assert.equal(esTemp('tmp_abc'), true);
  assert.equal(esTemp('real_1'), false);
  assert.equal(esTemp(42), false);

  const mapaIds = new Map([['tmp_a', 'real_9']]);
  assert.deepEqual(resolverTemps({ item_id: 'tmp_a', hijos: ['tmp_a', 'tmp_b'] }, mapaIds), { item_id: 'real_9', hijos: ['real_9', 'tmp_b'] });
  assert.equal(quedanTemps({ a: { b: ['tmp_z'] } }), true);
  assert.equal(quedanTemps({ a: { b: ['real_1'] } }), false);
});

test('esErrorDeRed distingue red de error de datos', () => {
  assert.equal(esErrorDeRed(new Error('Failed to fetch')), true);
  assert.equal(esErrorDeRed(new Error('timeout')), true);
  assert.equal(esErrorDeRed(new Error('new row violates row-level security policy')), false);
  assert.equal(esErrorDeRed(new Error('duplicate key value violates unique constraint')), false);
});

test('describir arma un texto legible', () => {
  assert.equal(describir({ tabla: 'agenda_items', op: 'insert', filas: { titulo: 'Llamar a PCEL' } }), 'Agenda · alta "Llamar a PCEL"');
  assert.equal(describir({ tabla: 'pagos', op: 'update', filas: {} }), 'Pago · cambio');
});

// ───────────────────────────── Encolar sin señal ─────────────────────────────
test('sin señal: escribir encola y resuelve optimista con id temporal', async () => {
  await limpiar();
  ponerSenal(false);
  const aplicar = aplicadorFalso();
  const r = await escribir({ tabla: 'agenda_items', op: 'insert', filas: { titulo: 'Punto de la visita' }, origen: 'agenda', aplicar });

  assert.equal(r.offline, true);
  assert.equal(esTemp(r.data.id), true, 'la fila optimista trae id temporal');
  assert.equal(r.data._pendiente, true);
  assert.equal(aplicar.vistos.length, 0, 'sin señal no se toca la red');

  const cola = await leerCola();
  assert.equal(cola.length, 1);
  assert.equal(cola[0].tabla, 'agenda_items');
  assert.equal(cola[0].op, 'insert');
  assert.equal(cola[0].tempId, r.data.id);
  assert.equal(estadoBuzon().pendientes, 1);
});

test('con señal: escribir va directo a la red y no encola', async () => {
  await limpiar();
  ponerSenal(true);
  const aplicar = aplicadorFalso();
  const r = await escribir({ tabla: 'proyectos', op: 'insert', filas: { nombre: 'Proyecto X' }, aplicar });
  assert.equal(r.offline, false);
  assert.equal(r.data.id, 'real_1');
  assert.deepEqual(await leerCola(), []);
});

test('con señal pero la red falla: cae al buzón', async () => {
  await limpiar();
  ponerSenal(true);
  const aplicar = aplicadorFalso({ fallaVeces: 1 });
  const r = await escribir({ tabla: 'marketing_actividades', op: 'insert', filas: { nombre: 'Demo en tienda' }, aplicar });
  assert.equal(r.offline, true);
  assert.equal((await leerCola()).length, 1);
});

test('un error de DATOS no se encola: se propaga', async () => {
  await limpiar();
  ponerSenal(true);
  const aplicar = async () => { throw new Error('new row violates row-level security policy for table "pagos"'); };
  await assert.rejects(() => escribir({ tabla: 'pagos', op: 'update', filas: { estado: 'pagado' }, match: { id: 7 }, aplicar }), /row-level security/);
  assert.deepEqual(await leerCola(), [], 'la cola queda limpia');
});

// ───────────────────────────── Sincronización FIFO ─────────────────────────────
test('sincronizar aplica la cola en orden de llegada y la vacía', async () => {
  await limpiar();
  ponerSenal(false);
  const aplicar = aplicadorFalso();
  await escribir({ tabla: 'agenda_items', op: 'insert', filas: { titulo: 'uno' }, aplicar });
  await escribir({ tabla: 'agenda_items', op: 'insert', filas: { titulo: 'dos' }, aplicar });
  await escribir({ tabla: 'agenda_items', op: 'insert', filas: { titulo: 'tres' }, aplicar });

  ponerSenal(true);
  const r = await sincronizar({ aplicar });
  assert.equal(r.subidos, 3);
  assert.equal(r.restantes, 0);
  assert.equal(r.error, null);
  assert.deepEqual(aplicar.vistos.map((x) => x.filas.titulo), ['uno', 'dos', 'tres'], 'FIFO');
  assert.deepEqual(await leerCola(), []);
  assert.equal(estadoBuzon().pendientes, 0);
});

test('los ids temporales se sustituyen por los reales en lo que venía después', async () => {
  await limpiar();
  ponerSenal(false);
  const aplicar = aplicadorFalso();
  // Alta de una tarea sin señal…
  const alta = await escribir({ tabla: 'agenda_items', op: 'insert', filas: { titulo: 'Acuerdo de la visita' }, aplicar });
  const temp = alta.data.id;
  // …y acto seguido una subtarea y una edición que la referencian.
  await escribir({ tabla: 'agenda_subtareas', op: 'insert', filas: { item_id: temp, titulo: 'Mandar cotización' }, aplicar });
  await escribir({ tabla: 'agenda_items', op: 'update', filas: { estado: 'hecha' }, match: { id: temp }, aplicar });

  ponerSenal(true);
  const r = await sincronizar({ aplicar });
  assert.equal(r.subidos, 3);
  assert.equal(aplicar.vistos[1].filas.item_id, 'real_1', 'la subtarea apunta al id real del alta');
  assert.equal(aplicar.vistos[2].match.id, 'real_1', 'la edición también');
});

test('un fallo detiene la cola, la conserva y deja ultimoError', async () => {
  await limpiar();
  ponerSenal(false);
  const buena = aplicadorFalso();
  await escribir({ tabla: 'agenda_items', op: 'insert', filas: { titulo: 'primera' }, aplicar: buena });
  await escribir({ tabla: 'agenda_items', op: 'insert', filas: { titulo: 'segunda' }, aplicar: buena });

  ponerSenal(true);
  let n = 0;
  const aplicarFlaky = async (item) => { n += 1; if (n === 1) return { id: 'real_1' }; throw new Error('Failed to fetch'); };
  const r = await sincronizar({ aplicar: aplicarFlaky });
  assert.equal(r.subidos, 1);
  assert.equal(r.restantes, 1);
  assert.match(r.error, /Agenda · alta "segunda"/);

  const cola = await leerCola();
  assert.equal(cola.length, 1);
  assert.equal(cola[0].filas.titulo, 'segunda');
  assert.equal(cola[0].intentos, 1);
  assert.ok(cola[0].error);
  assert.ok(estadoBuzon().ultimoError);

  // Reintentar con la red buena la sube y limpia el error.
  const r2 = await reintentar({ aplicar: aplicadorFalso({ idBase: 2 }) });
  assert.equal(r2.subidos, 1);
  assert.equal(r2.restantes, 0);
  assert.equal(estadoBuzon().ultimoError, null);
});

test('descartar quita un elemento concreto de la cola', async () => {
  await limpiar();
  ponerSenal(false);
  const aplicar = aplicadorFalso();
  await escribir({ tabla: 'agenda_items', op: 'insert', filas: { titulo: 'se queda' }, aplicar });
  const fuera = await encolar({ tabla: 'agenda_items', op: 'insert', filas: { titulo: 'se va' } });
  assert.equal((await leerCola()).length, 2);

  await descartar(fuera.id);
  const cola = await leerCola();
  assert.equal(cola.length, 1);
  assert.equal(cola[0].filas.titulo, 'se queda');
});

test('si se descarta el alta, lo que dependía de ella no se aplica a ciegas', async () => {
  await limpiar();
  ponerSenal(false);
  const aplicar = aplicadorFalso();
  const alta = await escribir({ tabla: 'agenda_items', op: 'insert', filas: { titulo: 'alta' }, aplicar });
  await escribir({ tabla: 'agenda_subtareas', op: 'insert', filas: { item_id: alta.data.id, titulo: 'hija' }, aplicar });

  const cola = await leerCola();
  await descartar(cola[0].id);          // se descarta el alta

  ponerSenal(true);
  const r = await sincronizar({ aplicar });
  assert.equal(r.subidos, 0);
  assert.match(r.error, /depende de algo que ya no existe/);
  assert.equal(aplicar.vistos.length, 0, 'nunca se manda una fila con id temporal');
});

test('sin señal, sincronizar no toca la red y conserva la cola', async () => {
  await limpiar();
  ponerSenal(false);
  const aplicar = aplicadorFalso();
  await escribir({ tabla: 'agenda_items', op: 'insert', filas: { titulo: 'pendiente' }, aplicar });
  const r = await sincronizar({ aplicar });
  assert.equal(r.subidos, 0);
  assert.equal(r.restantes, 1);
  assert.equal(aplicar.vistos.length, 0);
});

test('el tope de 6 s manda al buzón lo que no responde', async () => {
  await limpiar();
  ponerSenal(true);
  const lento = () => new Promise((res) => setTimeout(() => res({ id: 'tarde' }), 200));
  const r = await escribir({ tabla: 'agenda_items', op: 'insert', filas: { titulo: 'lento' }, aplicar: lento, tope: 20 });
  assert.equal(r.offline, true);
  assert.equal((await leerCola()).length, 1);
});

test('onSincronizado se llama una vez con lo que se subió', async () => {
  await limpiar();
  ponerSenal(false);
  const aplicar = aplicadorFalso();
  await escribir({ tabla: 'agenda_items', op: 'insert', filas: { titulo: 'a' }, aplicar });
  await escribir({ tabla: 'agenda_items', op: 'insert', filas: { titulo: 'b' }, aplicar });
  ponerSenal(true);
  const avisos = [];
  await sincronizar({ aplicar, onSincronizado: (n) => avisos.push(n) });
  assert.deepEqual(avisos, [2]);
});
